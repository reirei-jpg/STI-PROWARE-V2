<?php

use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\Preorder;
use App\Models\PreorderSlip;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Notifications\PreorderNotPaid;
use App\Notifications\PreorderPayBy;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-11-14 10:00', 'Asia/Manila'));
    $this->specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
    $this->juan = User::factory()->student()->create(['name' => 'Juan Dela Cruz']);
    $this->bea = User::factory()->student()->create(['name' => 'Bea Villareal']);
    $this->hoodie = Product::factory()->create(['name' => 'STI Batch 2027 Hoodie', 'status' => ProductStatus::Preorder, 'price_centavos' => 75000, 'preorders_close_on' => null, 'expected_arrival_from' => '2027-01-10']);
    $this->size = ProductVariant::factory()->for($this->hoodie)->create(['price_centavos' => null]);
});

/**
 * The buyer preorders through the store; returns the batch's slip.
 */
function preorderUnpaidHoodie(User $buyer, int $quantity = 1): PreorderSlip
{
    test()->actingAs($buyer)
        ->post(route('my-preorders.store', test()->hoodie), ['product_variant_id' => test()->size->id, 'quantity' => (string) $quantity])
        ->assertSessionHasNoErrors();

    return PreorderSlip::query()->where('user_id', $buyer->id)->latest('id')->firstOrFail();
}

test('an item with unpaid preorders and no payment dates shows on the dashboard until the dates are set', function () {
    Notification::fake();
    preorderUnpaidHoodie($this->juan, 2);
    $beaSlip = preorderUnpaidHoodie($this->bea);
    // Bea already paid: she is not asked again.
    $this->actingAs($this->specialist)->post(route('preorder-slips.paid', $beaSlip));

    $this->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page
        ->where('stockCards.preorders_to_set_up.count', 1)
        ->where('stockCards.preorders_to_set_up.items.0', [
            'product_id' => $this->hoodie->id, 'product_name' => 'STI Batch 2027 Hoodie', 'coming_soon' => true,
            'buyers' => 1, 'pieces' => 2, 'preorders_close_on' => null, 'expected_arrival_from' => '2027-01-10',
        ]));

    $this->patch(route('preorders.payment-dates', $this->hoodie), ['preorder_pay_from' => '2026-11-15', 'preorders_close_on' => '2026-11-30'])
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.message', 'Payment dates for STI Batch 2027 Hoodie: Nov 15 to Nov 30, 2026. 1 buyer with an unpaid preorder was told to pay by then.');

    Notification::assertSentTo($this->juan, PreorderPayBy::class, fn (PreorderPayBy $notice): bool => $notice->toPush($this->juan)['body']
        === 'Pay ₱1,500.00 at the cashier with your preorder slip from Nov 15 to Nov 30, 2026. If not paid by then, it is dropped.');
    Notification::assertNotSentTo($this->bea, PreorderPayBy::class);

    $this->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page->where('stockCards.preorders_to_set_up.count', 0));
    $this->actingAs($this->juan)->get(route('my-preorders.index'))->assertInertia(fn (Assert $page) => $page
        ->where('preorders.data.0.pay_from', '2026-11-15')
        ->where('preorders.data.0.pay_until', '2026-11-30'));
});

test('wrong payment dates are refused with a reason', function () {
    preorderUnpaidHoodie($this->juan);
    $this->actingAs($this->specialist);

    $this->patch(route('preorders.payment-dates', $this->hoodie), ['preorder_pay_from' => '', 'preorders_close_on' => 'soon'])
        ->assertSessionHasErrors(['preorder_pay_from' => 'Choose the first day buyers can pay.', 'preorders_close_on' => 'Choose a valid close date.']);
    $this->patch(route('preorders.payment-dates', $this->hoodie), ['preorder_pay_from' => '2026-11-13', 'preorders_close_on' => '2026-11-12'])
        ->assertSessionHasErrors(['preorder_pay_from' => 'The start date cannot be in the past.', 'preorders_close_on' => 'The close date cannot be before the start date.']);
    $this->patch(route('preorders.payment-dates', $this->hoodie), ['preorder_pay_from' => '2026-11-15', 'preorders_close_on' => '2027-01-10'])
        ->assertSessionHasErrors(['preorders_close_on' => 'The close date must be before the expected arrival (Jan 10, 2027). Change the expected arrival in Edit Product first.']);

    expect($this->hoodie->refresh()->preorder_pay_from)->toBeNull();
});

test('after the close date, unpaid preorders are dropped and their buyers told; paid ones stay', function () {
    Notification::fake();
    preorderUnpaidHoodie($this->juan);
    $beaSlip = preorderUnpaidHoodie($this->bea);
    $this->actingAs($this->specialist)->post(route('preorder-slips.paid', $beaSlip));
    $this->patch(route('preorders.payment-dates', $this->hoodie), ['preorder_pay_from' => '2026-11-14', 'preorders_close_on' => '2026-11-20']);

    // Still on the close date: nothing dropped.
    $this->travelTo(CarbonImmutable::parse('2026-11-20 23:00', 'Asia/Manila'));
    $this->artisan('preorders:drop-unpaid')->expectsOutput('Dropped 0 unpaid preorder(s).');

    $this->travelTo(CarbonImmutable::parse('2026-11-21 00:01', 'Asia/Manila'));
    $this->artisan('preorders:drop-unpaid')->expectsOutput('Dropped 1 unpaid preorder(s).');

    expect(Preorder::query()->where('user_id', $this->juan->id)->sole()->status)->toBe(PreorderStatus::NotPaid)
        ->and(Preorder::query()->where('user_id', $this->bea->id)->sole()->status)->toBe(PreorderStatus::Active)
        // A Coming Soon item keeps its close date: its preorders are closed.
        ->and($this->hoodie->refresh()->preorders_close_on?->toDateString())->toBe('2026-11-20');
    Notification::assertSentTo($this->juan, PreorderNotPaid::class, fn (PreorderNotPaid $notice): bool => $notice->toPush($this->juan)['body'] === 'It was not paid by Nov 20, 2026, so it was dropped.');
    Notification::assertNotSentTo($this->bea, PreorderNotPaid::class);
});

test('a sold-out size gets payment dates for one round; after it the dates clear for the next preorders', function () {
    $lanyard = Product::factory()->create(['name' => 'STI Lanyard', 'status' => ProductStatus::Available]);
    $soldOut = ProductVariant::factory()->for($lanyard)->create(['stock_on_hand' => 0]);
    $this->actingAs($this->juan)->post(route('my-preorders.store', $lanyard), ['product_variant_id' => $soldOut->id, 'quantity' => '1']);

    // On the phone.
    Sanctum::actingAs($this->specialist);
    $this->patchJson(route('api.v1.specialist.preorders.payment-dates', $lanyard), ['preorder_pay_from' => '2026-11-14', 'preorders_close_on' => '2026-11-16'])
        ->assertOk()
        ->assertJsonPath('message', 'Payment dates for STI Lanyard: Nov 14 to Nov 16, 2026. 1 buyer with an unpaid preorder was told to pay by then.');

    $this->travelTo(CarbonImmutable::parse('2026-11-17 08:00', 'Asia/Manila'));
    $this->artisan('preorders:drop-unpaid');

    expect($lanyard->refresh())->preorder_pay_from->toBeNull()->preorders_close_on->toBeNull()
        ->and(Preorder::sole()->status)->toBe(PreorderStatus::NotPaid);
});
