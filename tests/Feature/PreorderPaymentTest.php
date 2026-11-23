<?php

use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\Payment;
use App\Models\Preorder;
use App\Models\PreorderSlip;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Notifications\PaymentRecorded;
use App\Notifications\PaymentUndone;
use App\Notifications\PaymentUndoneForStaff;
use App\Notifications\PreorderPaid;
use App\Services\Preorders\EarlyBird;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-11-14 10:00', 'Asia/Manila'));
    $this->buyer = User::factory()->student()->create(['name' => 'Juan Dela Cruz']);
    $this->specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
    // Coming Soon at ₱750, the first 2 pieces at the early-bird ₱650.
    $this->hoodie = Product::factory()->create([
        'name' => 'STI Batch 2027 Hoodie', 'status' => ProductStatus::Preorder, 'price_centavos' => 75000, 'sale_price_centavos' => null,
        'preorders_close_on' => '2026-11-30', 'early_bird_price_centavos' => 65000, 'early_bird_pieces' => 2,
    ]);
    $this->size = ProductVariant::factory()->for($this->hoodie)->create(['price_centavos' => null]);
});

/**
 * Juan preorders 3 hoodies: 2 at the early-bird price, 1 at the normal price.
 */
function preorderThreeHoodies(): PreorderSlip
{
    test()->actingAs(test()->buyer)
        ->post(route('my-preorders.store', test()->hoodie), ['product_variant_id' => test()->size->id, 'quantity' => '3'])
        ->assertSessionHasNoErrors();

    return PreorderSlip::sole();
}

test('a preorder gets a slip to pay at the cashier, with the early-bird price', function () {
    $slip = preorderThreeHoodies();

    expect($slip->number)->toBe('PR-'.str_pad((string) $slip->id, 4, '0', STR_PAD_LEFT))
        ->and($slip->amountDue())->toBe(2 * 65000 + 75000);

    $this->get(route('my-preorders.index'))->assertInertia(fn (Assert $page) => $page
        ->where('preorders.data.0.slip_number', $slip->number)
        ->where('preorders.data.0.slip_paid', false)
        ->where('preorders.data.0.slip_amount_centavos', 205000));

    $this->get(route('my-preorders.slip', $slip))->assertInertia(fn (Assert $page) => $page
        ->component('storefront/preorder-slip')
        ->where('slip.status', 'waiting_payment')
        ->where('slip.total_centavos', 205000)
        ->where('slip.items.0', ['quantity' => 2, 'item' => 'STI Batch 2027 Hoodie · early bird', 'unit_price_centavos' => 65000, 'amount_centavos' => 130000])
        ->where('slip.items.1.amount_centavos', 75000));

    // Another buyer's slip does not exist for them.
    $this->actingAs(User::factory()->student()->create())->get(route('my-preorders.slip', $slip))->assertNotFound();
});

test('a slip dropped for not being paid by the closing date says so, with nothing to pay', function () {
    $slip = preorderThreeHoodies();
    $this->hoodie->forceFill(['preorder_pay_from' => '2026-11-20'])->save();
    $this->travelTo(CarbonImmutable::parse('2026-12-01 10:00', 'Asia/Manila'));
    $this->artisan('preorders:drop-unpaid')->assertSuccessful();

    $this->actingAs($this->buyer)->get(route('my-preorders.slip', $slip))->assertInertia(fn (Assert $page) => $page
        ->where('slip.status', 'not_paid')
        ->where('slip.status_label', 'Not paid in time')
        ->where('slip.closed_on', '2026-11-30')
        ->where('slip.total_centavos', 0));
    $this->getJson(route('api.v1.preorders.slip', $slip))->assertOk()->assertJsonPath('status', 'not_paid');

    // The cashier cannot take a payment for it, and it is not shown as paid.
    $this->actingAs(User::factory()->cashier()->create())
        ->get(route('cashier.record', ['code' => $slip->code]))
        ->assertInertia(fn (Assert $page) => $page->where('result.can_mark_paid', false)->where('result.slip.status', 'not_paid'));
});

test('the cashier scans the slip and marks it paid; the buyer is told and the slip says PAID', function () {
    Notification::fake();
    $slip = preorderThreeHoodies();
    $cashier = User::factory()->cashier()->create(['name' => 'Cashier 1']);
    $this->actingAs($cashier);

    $this->get(route('cashier.record', ['code' => $slip->code]))->assertInertia(fn (Assert $page) => $page
        ->component('cashier/record')
        ->where('result.kind', 'preorder')
        ->where('result.slip.number', $slip->number)
        ->where('result.to_collect_centavos', 205000)
        ->where('result.can_mark_paid', true));

    $this->post(route('cashier.preorder-slips.paid', $slip), paidInCash())
        ->assertInertiaFlash('toast.message', "Preorder slip {$slip->number}: payment of ₱2,050.00 from Juan Dela Cruz has been recorded.");

    expect($slip->refresh())->paid_centavos->toBe(205000)->paid_by->toBe($cashier->id);
    Notification::assertSentTo($this->buyer, PreorderPaid::class, fn (PreorderPaid $notice): bool => $notice->toPush($this->buyer)['body']
        === '₱2,050.00 paid (Payment Receipt '.Payment::sole()->receipt_number.'). Keep your preorder slip and receipt as proof of payment.');

    // Not twice; the number typed in finds it too; it is in today's payments.
    $this->post(route('cashier.preorder-slips.paid', $slip), paidInCash())
        ->assertInertiaFlash('toast.message', "Preorder slip {$slip->number} has already been paid (recorded by Cashier 1 on Nov 14, 2026, 10:00 AM).");
    $this->get(route('cashier.record', ['code' => strtolower((string) $slip->number)]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('result.slip.status', 'paid')
            ->where('result.can_mark_paid', false)
            ->where('paidToday.total_centavos', 205000)
            ->where('paidToday.rows.0.number', $slip->number));

    // The Specialist sees it paid, and can no longer mark slips paid.
    $this->actingAs($this->specialist)->get(route('orders.slip', ['code' => $slip->code]))
        ->assertInertia(fn (Assert $page) => $page->where('preorderResult.slip.status', 'paid'));
    $this->post(route('cashier.preorder-slips.paid', $slip), paidInCash())->assertForbidden();
});

test('a paid preorder can no longer be changed or cancelled, and keeps the price it was paid at', function () {
    $slip = preorderThreeHoodies();
    $preorder = Preorder::sole();
    $this->actingAs(User::factory()->cashier()->create())->post(route('cashier.preorder-slips.paid', $slip), paidInCash());

    $this->actingAs($this->buyer)->delete(route('my-preorders.destroy', $preorder))
        ->assertInertiaFlash('toast.message', 'You already paid for your preorder of STI Batch 2027 Hoodie, so it can no longer be cancelled. There is no refund.');
    $this->patch(route('my-preorders.update', $preorder), ['product_variant_id' => $this->size->id, 'quantity' => '1'])
        ->assertSessionHasErrors(['preorder' => 'You already paid for your preorder of STI Batch 2027 Hoodie, so it can no longer be changed.']);

    // Fewer early-bird pieces later do not change what was paid.
    $this->hoodie->forceFill(['early_bird_pieces' => 0])->save();
    EarlyBird::reallocate($this->hoodie);

    expect($preorder->refresh())->status->value->toBe('active')->quantity->toBe(3)->early_bird_pieces->toBe(2);
    $this->get(route('my-preorders.index'))->assertInertia(fn (Assert $page) => $page
        ->where('preorders.data.0.slip_paid', true)
        ->where('preorders.data.0.paid_on', '2026-11-14')
        ->where('preorders.data.0.can_cancel', false)
        ->where('preorders.data.0.can_edit', false));
});

test('on the phone the buyer sees the slip and the cashier marks it paid', function () {
    $slip = preorderThreeHoodies();

    Sanctum::actingAs($this->buyer);
    $this->getJson(route('api.v1.preorders.slip', $slip))->assertOk()->assertJsonPath('number', $slip->number)->assertJsonPath('status', 'waiting_payment');

    Sanctum::actingAs(User::factory()->cashier()->create());
    $this->getJson(route('api.v1.cashier.slip', ['code' => $slip->code]))->assertOk()->assertJsonPath('kind', 'preorder')->assertJsonPath('can_mark_paid', true)->assertJsonPath('to_collect_centavos', 205000);
    $this->postJson(route('api.v1.cashier.preorder-slips.paid', $slip), paidInCash())->assertOk()->assertJsonPath('message', "Preorder slip {$slip->number}: payment of ₱2,050.00 from Juan Dela Cruz has been recorded.");
    $this->postJson(route('api.v1.cashier.preorder-slips.paid', $slip), paidInCash())->assertUnprocessable();

    // Only the cashier marks slips paid: not the buyer, not the Specialist.
    Sanctum::actingAs($this->buyer);
    $this->postJson(route('api.v1.cashier.preorder-slips.paid', $slip), paidInCash())->assertForbidden();
    Sanctum::actingAs($this->specialist);
    $this->postJson(route('api.v1.cashier.preorder-slips.paid', $slip), paidInCash())->assertForbidden();
    $this->actingAs($this->buyer)->post(route('cashier.preorder-slips.paid', $slip), paidInCash())->assertForbidden();
});

test('the Specialist is told of a preorder payment, and the cashier can undo it the same day before the items arrive', function () {
    Notification::fake();
    $slip = preorderThreeHoodies();
    $cashier = User::factory()->cashier()->create(['name' => 'Cashier 1']);
    $this->actingAs($cashier)->post(route('cashier.preorder-slips.paid', $slip), paidInCash());

    Notification::assertSentTo($this->specialist, PaymentRecorded::class, fn (PaymentRecorded $notice): bool => $notice->toPush($this->specialist)['title'] === "Paid: {$slip->number} · Juan Dela Cruz"
        && $notice->toPush($this->specialist)['body'] === '₱2,050.00 paid. The items are released once they arrive.');

    $receipt = Payment::sole()->receipt_number;
    $this->get(route('cashier.record', ['code' => $slip->number]))->assertInertia(fn (Assert $page) => $page->where('result.can_undo', true));
    $this->post(route('cashier.preorder-slips.undo-payment', $slip), ['reason' => 'Recorded on the wrong slip.'])
        ->assertInertiaFlash('toast.message', "The payment for preorder slip {$slip->number} (₱2,050.00 from Juan Dela Cruz) has been undone. Payment Receipt {$receipt} has been voided, and the slip is waiting for payment again.");

    expect($slip->refresh())->paid_at->toBeNull()->paid_by->toBeNull()->paid_centavos->toBeNull()
        ->and(Payment::sole())->preorder_slip_id->toBe($slip->id)->amount_centavos->toBe(205000)->isVoid()->toBeTrue();
    Notification::assertSentTo($this->buyer, PaymentUndone::class, fn (PaymentUndone $notice): bool => $notice->toPush($this->buyer)['body']
        === 'The cashier undid your ₱2,050.00 payment (Payment Receipt '.$receipt.' is void): Recorded on the wrong slip. Pay at the cashier again with your preorder slip.');
    Notification::assertSentTo($this->specialist, PaymentUndoneForStaff::class);

    // Paid again, then its items arrive: the payment can no longer be undone.
    $this->post(route('cashier.preorder-slips.paid', $slip), paidInCash());
    Preorder::sole()->forceFill(['status' => PreorderStatus::Held])->save();
    $this->post(route('cashier.preorder-slips.undo-payment', $slip), ['reason' => 'Recorded by mistake.'])
        ->assertInertiaFlash('toast.message', "The items for preorder slip {$slip->number} have already arrived, so its payment can no longer be undone.");
    expect($slip->refresh()->isPaid())->toBeTrue();
});

test('a slip asks only for the preorders still waiting, not one already ordered and paid as an order', function () {
    $slip = preorderThreeHoodies();
    $other = ProductVariant::factory()->for($this->hoodie)->create(['price_centavos' => null, 'combination' => 'size:xl', 'choices' => [['option' => 'Size', 'choice' => 'XL']]]);
    Preorder::factory()->forVariant($other)->create(['user_id' => $this->buyer->id, 'batch' => $slip->batch, 'quantity' => 1, 'status' => PreorderStatus::Ordered]);

    expect($slip->refresh()->amountDue())->toBe(205000);
});
