<?php

use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\Preorder;
use App\Models\PreorderSlip;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
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

test('the Specialist scans the slip and marks it paid; the buyer is told and the slip says PAID', function () {
    Notification::fake();
    $slip = preorderThreeHoodies();
    $this->actingAs($this->specialist);

    $this->get(route('orders.slip', ['code' => $slip->code]))->assertInertia(fn (Assert $page) => $page
        ->where('result', null)
        ->where('preorderResult.slip.number', $slip->number)
        ->where('preorderResult.can_mark_paid', true));

    $this->post(route('preorder-slips.paid', $slip))
        ->assertInertiaFlash('toast.message', "Preorder slip {$slip->number} has been marked as paid: ₱2,050.00 from Juan Dela Cruz.");

    expect($slip->refresh())->paid_centavos->toBe(205000)->paid_by->toBe($this->specialist->id);
    Notification::assertSentTo($this->buyer, PreorderPaid::class, fn (PreorderPaid $notice): bool => $notice->toPush($this->buyer)['body']
        === "Your payment of ₱2,050.00 has been recorded. Preorder slip {$slip->number} now says PAID: keep it as your proof of payment.");

    // Not twice; the number typed in finds it too.
    $this->post(route('preorder-slips.paid', $slip))
        ->assertInertiaFlash('toast.message', "Preorder slip {$slip->number} was already paid on Nov 14, 2026 10:00 AM (marked by Carlo Mendoza).");
    $this->get(route('orders.slip', ['code' => strtolower((string) $slip->number)]))
        ->assertInertia(fn (Assert $page) => $page->where('preorderResult.slip.status', 'paid')->where('preorderResult.can_mark_paid', false));
});

test('a paid preorder can no longer be changed or cancelled, and keeps the price it was paid at', function () {
    $slip = preorderThreeHoodies();
    $preorder = Preorder::sole();
    $this->actingAs($this->specialist)->post(route('preorder-slips.paid', $slip));

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

test('on the phone the buyer sees the slip and the Specialist marks it paid', function () {
    $slip = preorderThreeHoodies();

    Sanctum::actingAs($this->buyer);
    $this->getJson(route('api.v1.preorders.slip', $slip))->assertOk()->assertJsonPath('number', $slip->number)->assertJsonPath('status', 'waiting_payment');

    Sanctum::actingAs($this->specialist);
    $this->getJson(route('api.v1.specialist.slips.show', $slip->code))->assertOk()->assertJsonPath('kind', 'preorder')->assertJsonPath('can_mark_paid', true);
    $this->postJson(route('api.v1.specialist.preorder-slips.paid', $slip))->assertOk()->assertJsonPath('message', "Preorder slip {$slip->number} has been marked as paid: ₱2,050.00 from Juan Dela Cruz.");
    $this->postJson(route('api.v1.specialist.preorder-slips.paid', $slip))->assertUnprocessable();

    // Only the Specialist marks slips paid.
    Sanctum::actingAs($this->buyer);
    $this->postJson(route('api.v1.specialist.preorder-slips.paid', $slip))->assertForbidden();
    $this->actingAs($this->buyer)->post(route('preorder-slips.paid', $slip))->assertForbidden();
});

test('a slip asks only for the preorders still waiting, not one already ordered and paid as an order', function () {
    $slip = preorderThreeHoodies();
    $other = ProductVariant::factory()->for($this->hoodie)->create(['price_centavos' => null, 'combination' => 'size:xl', 'choices' => [['option' => 'Size', 'choice' => 'XL']]]);
    Preorder::factory()->forVariant($other)->create(['user_id' => $this->buyer->id, 'batch' => $slip->batch, 'quantity' => 1, 'status' => PreorderStatus::Ordered]);

    expect($slip->refresh()->amountDue())->toBe(205000);
});
