<?php

use App\Enums\ProductStatus;
use App\Models\CartItem;
use App\Models\Product;
use App\Models\ProductPack;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use Carbon\CarbonImmutable;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-19 10:00', 'Asia/Manila'));
    $this->student = User::factory()->student()->create(['name' => 'Juan Dela Cruz', 'email' => 'delacruz.123456@sti.edu.ph']);
});

/**
 * An Available STI Tumbler at ₱450 in Black (4 left) and White (10 left).
 *
 * @return array{0: Product, 1: ProductVariant, 2: ProductVariant}
 */
function tumblerInTwoColors(): array
{
    $product = Product::factory()->create(['name' => 'STI Tumbler', 'price_centavos' => 45000, 'status' => ProductStatus::Available, 'low_stock_alert_at' => 0]);
    $black = ProductVariant::factory()->for($product)->create(['combination' => 'Color: Black', 'choices' => [['option' => 'Color', 'choice' => 'Black']], 'stock_on_hand' => 4, 'position' => 0]);
    $white = ProductVariant::factory()->for($product)->create(['combination' => 'Color: White', 'choices' => [['option' => 'Color', 'choice' => 'White']], 'stock_on_hand' => 10, 'position' => 1]);
    StockMovement::factory()->for($black, 'variant')->create();
    StockMovement::factory()->for($white, 'variant')->create();

    return [$product, $black, $white];
}

/**
 * An Available STI Ballpen at ₱15 a piece and ₱150 a Box of 12, 30 left.
 *
 * @return array{0: Product, 1: ProductVariant, 2: ProductPack}
 */
function ballpenWithBoxes(): array
{
    $product = Product::factory()->create(['name' => 'STI Ballpen', 'price_centavos' => 1500, 'status' => ProductStatus::Available, 'low_stock_alert_at' => 0]);
    $variant = ProductVariant::factory()->for($product)->create(['stock_on_hand' => 30]);
    StockMovement::factory()->for($variant, 'variant')->create();
    $box = ProductPack::factory()->for($product)->soldToStudents(15000)->create(['name' => 'Box', 'pieces' => 12]);

    return [$product, $variant, $box];
}

test('several sizes or colors can be added to the cart at once', function () {
    [$product, $black, $white] = tumblerInTwoColors();

    $this->actingAs($this->student)
        ->post(route('cart.store', $product), ['items' => [
            ['product_variant_id' => $black->id, 'product_pack_id' => '', 'quantity' => '2'],
            ['product_variant_id' => $white->id, 'product_pack_id' => '', 'quantity' => '3'],
        ]])
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.message', '2 pcs of STI Tumbler (Black) and 3 pcs of STI Tumbler (White) have been added to your cart.');

    expect(CartItem::query()->orderBy('id')->pluck('quantity', 'product_variant_id')->all())
        ->toBe([$black->id => 2, $white->id => 3]);
});

test('pieces and boxes of the same item can be added together, within its stock', function () {
    [$product, $variant, $box] = ballpenWithBoxes();
    $this->actingAs($this->student);

    // 2 boxes (24 pcs) and 6 pieces = all 30 pieces.
    $this->post(route('cart.store', $product), ['items' => [
        ['product_variant_id' => $variant->id, 'product_pack_id' => (string) $box->id, 'quantity' => '2'],
        ['product_variant_id' => $variant->id, 'product_pack_id' => '', 'quantity' => '6'],
    ]])
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.message', '2 Boxes of STI Ballpen and 6 pcs of STI Ballpen have been added to your cart.');

    expect(CartItem::count())->toBe(2);
});

test('when one line has too few in stock, nothing is added and that line is named', function () {
    [$product, $black, $white] = tumblerInTwoColors();

    $this->actingAs($this->student)
        ->post(route('cart.store', $product), ['items' => [
            ['product_variant_id' => $white->id, 'product_pack_id' => '', 'quantity' => '1'],
            ['product_variant_id' => $black->id, 'product_pack_id' => '', 'quantity' => '5'],
        ]])
        ->assertSessionHasErrors(['items.1.quantity' => 'You can have at most 4 pcs of STI Tumbler (Black) in your cart (only 4 pcs left).']);

    expect(CartItem::count())->toBe(0);
});

test('the stock check counts the earlier lines of the same item in the list', function () {
    [$product, $variant, $box] = ballpenWithBoxes();

    // 2 boxes take 24 of the 30 pieces, so 7 more pieces do not fit.
    $this->actingAs($this->student)
        ->post(route('cart.store', $product), ['items' => [
            ['product_variant_id' => $variant->id, 'product_pack_id' => (string) $box->id, 'quantity' => '2'],
            ['product_variant_id' => $variant->id, 'product_pack_id' => '', 'quantity' => '7'],
        ]])
        ->assertSessionHasErrors('items.1.quantity');

    expect(CartItem::count())->toBe(0);
});

test('a list for Add to Cart explains what is wrong', function (Closure $items, string $field, string $message) {
    [$product, $black] = tumblerInTwoColors();

    $this->actingAs($this->student)
        ->post(route('cart.store', $product), ['items' => $items($black)])
        ->assertSessionHasErrors([$field => $message]);

    expect(CartItem::count())->toBe(0);
})->with([
    'a size of another product' => [fn (ProductVariant $black) => [
        ['product_variant_id' => ProductVariant::factory()->create()->id, 'quantity' => '1'],
    ], 'items.0.product_variant_id', 'Choose one of this item\'s sizes or colors.'],
    'none' => [fn (ProductVariant $black) => [
        ['product_variant_id' => $black->id, 'quantity' => '0'],
    ], 'items.0.quantity', 'The quantity must be at least 1.'],
    'a pack of another product' => [fn (ProductVariant $black) => [
        ['product_variant_id' => $black->id, 'product_pack_id' => ProductPack::factory()->soldToStudents(1000)->create()->id, 'quantity' => '1'],
    ], 'items.0.product_pack_id', 'Choose one of the packs shown.'],
]);

test('the phone app can add several lines at once', function () {
    [$product, $black, $white] = tumblerInTwoColors();
    Sanctum::actingAs($this->student);

    $this->postJson(route('api.v1.cart.store', $product), ['items' => [
        ['product_variant_id' => $black->id, 'product_pack_id' => null, 'quantity' => 1],
        ['product_variant_id' => $white->id, 'product_pack_id' => null, 'quantity' => 2],
    ]])
        ->assertCreated()
        ->assertJsonPath('message', '1 pc of STI Tumbler (Black) and 2 pcs of STI Tumbler (White) have been added to your cart.');

    expect(CartItem::count())->toBe(2);

    $this->postJson(route('api.v1.cart.store', $product), ['items' => []])
        ->assertJsonValidationErrors(['items' => 'Add at least one size or color.']);
});
