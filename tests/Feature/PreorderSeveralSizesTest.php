<?php

use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\Preorder;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Notifications\PreorderPlaced;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-19 10:00', 'Asia/Manila'));
    $this->student = User::factory()->student()->create(['name' => 'Juan Dela Cruz', 'email' => 'delacruz.123456@sti.edu.ph']);
});

/**
 * A product with one size per name, each with the stock given.
 *
 * @param  array<string, int>  $stockBySize
 * @return array{0: Product, 1: array<string, ProductVariant>}
 */
function productWithSizes(ProductStatus $status, array $stockBySize, string $name = 'Foundation Week Shirt'): array
{
    $product = Product::factory()->create(['name' => $name, 'status' => $status, 'preorders_close_on' => $status === ProductStatus::Preorder ? '2026-10-30' : null]);
    $variants = [];

    foreach (array_keys($stockBySize) as $position => $size) {
        $variants[$size] = ProductVariant::factory()->for($product)->create([
            'combination' => "Size: {$size}",
            'choices' => [['option' => 'Size', 'choice' => $size]],
            'stock_on_hand' => $stockBySize[$size],
            'position' => $position,
        ]);
    }

    return [$product, $variants];
}

test('a student can preorder several sizes at once', function () {
    [$product, $sizes] = productWithSizes(ProductStatus::Preorder, ['S' => 0, 'M' => 0, 'L' => 0]);

    $this->actingAs($this->student)
        ->post(route('my-preorders.store', $product), ['items' => [
            ['product_variant_id' => $sizes['S']->id, 'quantity' => '2'],
            ['product_variant_id' => $sizes['L']->id, 'quantity' => '3'],
        ]])
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.message', 'Your preorder of Foundation Week Shirt has been placed: 2 × S, 3 × L. It is listed in My Preorders.');

    expect(Preorder::query()->orderBy('id')->get()->map(fn (Preorder $preorder) => [$preorder->product_variant_id, $preorder->quantity, $preorder->status]))
        ->toEqual(collect([
            [$sizes['S']->id, 2, PreorderStatus::Active],
            [$sizes['L']->id, 3, PreorderStatus::Active],
        ]));
});

test('preordering a size already preordered adds to it, and keeps the others', function () {
    [$product, $sizes] = productWithSizes(ProductStatus::Preorder, ['S' => 0, 'M' => 0]);
    Preorder::factory()->forVariant($sizes['S'])->for($this->student, 'student')->create(['quantity' => 1]);

    $this->actingAs($this->student)
        ->post(route('my-preorders.store', $product), ['items' => [
            ['product_variant_id' => $sizes['S']->id, 'quantity' => '4'],
            ['product_variant_id' => $sizes['M']->id, 'quantity' => '1'],
        ]])
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.message', 'Your preorder of Foundation Week Shirt now has: 5 × S, 1 × M. It is listed in My Preorders.');

    expect(Preorder::query()->where('status', PreorderStatus::Active)->pluck('quantity', 'product_variant_id')->all())
        ->toBe([$sizes['S']->id => 5, $sizes['M']->id => 1]);
});

test('a preorder of several sizes explains what is wrong and saves nothing', function (Closure $items, string $field, string $message) {
    [$product, $sizes] = productWithSizes(ProductStatus::Preorder, ['S' => 0, 'M' => 0]);

    $this->actingAs($this->student)
        ->post(route('my-preorders.store', $product), ['items' => $items($sizes)])
        ->assertSessionHasErrors([$field => $message]);

    expect(Preorder::count())->toBe(0);
})->with([
    'nothing added' => [fn (array $sizes) => [], 'items', 'Add at least one size or color.'],
    'the same size twice' => [fn (array $sizes) => [
        ['product_variant_id' => $sizes['S']->id, 'quantity' => '1'],
        ['product_variant_id' => $sizes['S']->id, 'quantity' => '2'],
    ], 'items.1.product_variant_id', 'Each size or color can be listed only once.'],
    'a size of another product' => [fn (array $sizes) => [
        ['product_variant_id' => $sizes['S']->id, 'quantity' => '1'],
        ['product_variant_id' => ProductVariant::factory()->create()->id, 'quantity' => '1'],
    ], 'items.1.product_variant_id', 'Choose one of this item\'s sizes or colors.'],
    'none of one size' => [fn (array $sizes) => [
        ['product_variant_id' => $sizes['S']->id, 'quantity' => '0'],
    ], 'items.0.quantity', 'The quantity must be at least 1.'],
    'more than 99 of one size' => [fn (array $sizes) => [
        ['product_variant_id' => $sizes['M']->id, 'quantity' => '100'],
    ], 'items.0.quantity', 'For more than 99, contact the PROWARE office.'],
]);

test('a closed preorder refuses the whole list', function () {
    [$product, $sizes] = productWithSizes(ProductStatus::Preorder, ['S' => 0, 'M' => 0]);
    $this->travelTo(CarbonImmutable::parse('2026-10-31 08:00', 'Asia/Manila'));

    $this->actingAs($this->student)
        ->post(route('my-preorders.store', $product), ['items' => [
            ['product_variant_id' => $sizes['S']->id, 'quantity' => '1'],
        ]])
        ->assertSessionHasErrors(['items' => 'Preorders for Foundation Week Shirt closed on Oct 30, 2026.']);

    expect(Preorder::count())->toBe(0);
});

test('on an item for sale, a list with a size in stock is refused, naming that size', function () {
    Notification::fake();
    [$product, $sizes] = productWithSizes(ProductStatus::Available, ['XS' => 0, 'M' => 6, '2XL' => 0], 'BSIT Polo');

    $this->actingAs($this->student)
        ->post(route('my-preorders.store', $product), ['items' => [
            ['product_variant_id' => $sizes['XS']->id, 'quantity' => '1'],
            ['product_variant_id' => $sizes['M']->id, 'quantity' => '1'],
        ]])
        ->assertSessionHasErrors(['items.1.product_variant_id' => 'BSIT Polo (M) is in stock. Add it to your cart instead.']);

    expect(Preorder::count())->toBe(0);

    // Only the sold-out sizes: each new one is sent to the Specialist.
    $specialist = User::factory()->specialist()->create();

    $this->post(route('my-preorders.store', $product), ['items' => [
        ['product_variant_id' => $sizes['XS']->id, 'quantity' => '1'],
        ['product_variant_id' => $sizes['2XL']->id, 'quantity' => '2'],
    ]])
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.message', 'Your preorder of BSIT Polo has been placed: 1 × XS, 2 × 2XL. You will be notified when it is back in stock. It is listed in My Preorders.');

    Notification::assertSentToTimes($specialist, PreorderPlaced::class, 2);
});

test('the phone app can preorder several sizes at once', function () {
    [$product, $sizes] = productWithSizes(ProductStatus::Preorder, ['S' => 0, 'M' => 0]);
    Sanctum::actingAs($this->student);

    $this->postJson(route('api.v1.preorders.store', $product), ['items' => [
        ['product_variant_id' => $sizes['S']->id, 'quantity' => 2],
        ['product_variant_id' => $sizes['M']->id, 'quantity' => 1],
    ]])
        ->assertCreated()
        ->assertJsonPath('message', 'Your preorder of Foundation Week Shirt has been placed: 2 × S, 1 × M. It is listed in My Preorders.')
        ->assertJsonCount(2, 'preorders')
        ->assertJsonPath('preorders.1.variant_label', 'M');

    $this->postJson(route('api.v1.preorders.store', $product), ['items' => []])
        ->assertJsonValidationErrors(['items' => 'Add at least one size or color.']);
});
