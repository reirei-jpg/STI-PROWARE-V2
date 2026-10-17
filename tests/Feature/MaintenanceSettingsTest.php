<?php

use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Setting;
use App\Models\StockMovement;
use App\Models\User;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-09 10:00', 'Asia/Manila'));
    $this->specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
    $this->student = User::factory()->student()->create(['name' => 'Juan Dela Cruz']);
});

/**
 * An Available STI Pin Set at ₱90 a piece with 50 pieces on the shelf.
 */
function maintenancePinSet(): ProductVariant
{
    $variant = ProductVariant::factory()
        ->for(Product::factory()->create(['name' => 'STI Pin Set', 'price_centavos' => 9000, 'status' => ProductStatus::Available, 'low_stock_alert_at' => 0]))
        ->create(['stock_on_hand' => 50]);
    StockMovement::factory()->for($variant, 'variant')->create();

    return $variant;
}

test('the page lists every setting by area, with its default until someone changes it', function () {
    $this->actingAs($this->specialist)->get(route('maintenance.index'))->assertInertia(fn (Assert $page) => $page
        ->component('maintenance/index')
        ->where('areas', fn ($areas) => collect($areas)->pluck('area')->all() === ['Orders', 'Deliveries', 'Products & Sales', 'Free Uniforms', 'Issuance Slip'])
        ->where('areas.0.settings.0.label', 'Days an order holds its items')
        ->where('areas.0.settings.0.choices.0', ['value' => 1, 'label' => '1 day'])
        ->where('areas.0.settings.4.label', 'Most of one item a student can order')
        ->where('areas.0.settings.4.value', 99)
        ->where('areas.4.settings.0.value', 'STI COLLEGE-ORMOC, INC.')
        ->where('areas.4.settings.0.changed_by', null));
});

test('several settings are saved with one button, and saving nothing new says so', function () {
    $this->actingAs($this->specialist);

    $this->patch(route('maintenance.update'), [
        Setting::ORDER_HOLD_DAYS => 2,
        Setting::ORDER_PAUSE_DAYS => 14,
        Setting::SLOW_MOVING_DAYS => 30,
    ])->assertInertiaFlash('toast.message', 'These settings have been saved: How long ordering is paused, Days without a sale before an item is slow-moving.');

    $this->patch(route('maintenance.update'), [Setting::ORDER_PAUSE_DAYS => 14])
        ->assertInertiaFlash('toast.message', 'There were no changes to save.');

    $this->patch(route('maintenance.update'), [Setting::ORDER_PAUSE_DAYS => 6, Setting::CART_MAX_PER_ITEM => 7])
        ->assertSessionHasErrors([
            Setting::ORDER_PAUSE_DAYS => 'Choose 3, 5, 7 or 14 days.',
            Setting::CART_MAX_PER_ITEM => 'Choose 5, 10, 20, 50 or 99 pcs.',
        ])
        ->assertInertiaFlash('toast.message', 'The settings were not saved. Correct the 2 highlighted settings.');

    expect(maintenanceSetting(Setting::ORDER_PAUSE_DAYS))->toMatchArray(['value' => 14, 'changed_by' => 'Carlo Mendoza']);
});

test('ordering is paused after the set number of expired orders, within the set days, for the set length', function () {
    $this->actingAs($this->specialist)->patch(route('maintenance.update'), [
        Setting::ORDER_PAUSE_AFTER_EXPIRED => 2,
        Setting::ORDER_PAUSE_WINDOW_DAYS => 14,
        Setting::ORDER_PAUSE_DAYS => 3,
    ])->assertSessionHasNoErrors();

    // One that expired 20 days ago (outside the 14 days) does not count.
    foreach (['2026-09-19', '2026-10-01', '2026-10-08'] as $day) {
        Order::factory()->for($this->student, 'student')->create(['status' => OrderStatus::Cancelled, 'expired_at' => "{$day} 00:30"]);
    }
    CartItem::factory()->for($this->student, 'student')->for(maintenancePinSet(), 'variant')->create(['quantity' => 1]);

    $this->actingAs($this->student)->post(route('my-orders.store'))
        ->assertSessionHasErrors(['cart' => 'Ordering is paused until Oct 11, 2026, because 2 of your orders expired without being picked up. Ask the PROWARE office if this is a mistake.']);

    $this->travelTo(CarbonImmutable::parse('2026-10-11 09:00', 'Asia/Manila'));
    $this->post(route('my-orders.store'))->assertSessionHasNoErrors();
});

test('a student cannot add or preorder more of one item than the set most', function () {
    $variant = maintenancePinSet();
    $this->actingAs($this->specialist)->patch(route('maintenance.update'), [Setting::CART_MAX_PER_ITEM => 5]);

    $this->actingAs($this->student)
        ->post(route('cart.store', $variant->product_id), ['product_variant_id' => $variant->id, 'quantity' => 6])
        ->assertSessionHasErrors(['quantity' => 'For more than 5, contact the PROWARE office.']);
    $this->getJson(route('storefront.product', $variant->product_id))->assertJsonPath('max_per_item', 5);

    $mug = Product::factory()->create(['name' => 'STI Mug', 'status' => ProductStatus::Preorder, 'preorders_close_on' => '2026-10-20']);
    $mugVariant = ProductVariant::factory()->for($mug)->create();
    $this->post(route('my-preorders.store', $mug), ['product_variant_id' => $mugVariant->id, 'quantity' => 6])
        ->assertSessionHasErrors(['quantity' => 'For more than 5, contact the PROWARE office.']);
});

test('slow-moving days and the low-stock number for new products follow Maintenance', function () {
    $this->actingAs($this->specialist)->patch(route('maintenance.update'), [
        Setting::SLOW_MOVING_DAYS => 30,
        Setting::DEFAULT_LOW_STOCK_ALERT => 10,
    ])->assertSessionHasNoErrors();

    $this->get(route('products.index', ['stock' => 'slow']))->assertInertia(fn (Assert $page) => $page
        ->where('filters.slow_days', 30)
        ->where('defaultSlowDays', 30));
    $this->get(route('products.create'))->assertInertia(fn (Assert $page) => $page
        ->where('defaultLowStockAlert', 10));
});
