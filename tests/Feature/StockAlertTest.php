<?php

use App\Enums\ProductStatus;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\Stock\LowStockAlerts;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->specialist = User::factory()->specialist()->create();
});

/**
 * A variant of a product with this many pieces, warned at 5 by default.
 *
 * @param  array<string, mixed>  $product
 */
function stockedVariant(int $pieces, array $product = []): ProductVariant
{
    return ProductVariant::factory()
        ->for(Product::factory()->create(['name' => 'Chibi Keychain IT', 'status' => ProductStatus::Available, 'low_stock_alert_at' => 5, ...$product]))
        ->create(['estore_item_code' => 'PRCU01-01', 'stock_on_hand' => $pieces]);
}

/**
 * Take pieces out of a variant's stock through Correct stock.
 */
function takeOut(ProductVariant $variant, int $pieces): void
{
    test()->post(route('products.stock.correct', $variant->product_id), [
        'product_variant_id' => $variant->id,
        'reason' => 'damaged',
        'pieces_to_remove' => (string) $pieces,
    ])->assertSessionHasNoErrors();
}

test('the specialist is warned once when a variant falls to the low-stock number', function () {
    $variant = stockedVariant(8);
    $schoolAdmin = User::factory()->schoolAdmin()->create();
    $this->actingAs($this->specialist);

    takeOut($variant, 2);
    expect($this->specialist->notifications()->count())->toBe(0);

    takeOut($variant, 2);
    takeOut($variant, 1);

    expect($this->specialist->notifications()->count())->toBe(1)
        ->and($this->specialist->notifications()->sole()->data)->toBe([
            'kind' => 'low_stock',
            'product_id' => $variant->product_id,
            'product_name' => 'Chibi Keychain IT',
            'stock_on_hand' => 4,
            'alert_at' => 5,
        ])
        ->and($schoolAdmin->notifications()->count())->toBe(0);
});

test('after a delivery brings the stock back up, the next drop warns again', function () {
    $variant = stockedVariant(6);
    $order = orderWith(['PRCU01-01' => 20]);
    $this->actingAs($this->specialist);

    takeOut($variant, 2);
    $this->post(route('deliveries.store'), [
        'received_on' => now()->toDateString(),
        'items' => [['purchase_order_item_id' => itemOf($order, 'PRCU01-01'), 'quantity_received' => 10]],
    ]);

    expect($variant->refresh()->low_stock_notified_at)->toBeNull();

    takeOut($variant, 12);

    expect($this->specialist->notifications()->get()->pluck('data.stock_on_hand')->sort()->values()->all())->toBe([2, 4]);
});

test('a product warned at 0 is only warned when it runs out', function () {
    $variant = stockedVariant(3, ['low_stock_alert_at' => 0]);
    $this->actingAs($this->specialist);

    takeOut($variant, 2);
    expect($this->specialist->notifications()->count())->toBe(0);

    takeOut($variant, 1);

    expect($this->specialist->notifications()->sole()->data)
        ->toMatchArray(['stock_on_hand' => 0, 'alert_at' => 0]);
});

test('products students cannot buy yet are not watched', function (ProductStatus $status) {
    $variant = stockedVariant(6, ['status' => $status]);
    $this->actingAs($this->specialist);

    takeOut($variant, 5);

    expect($this->specialist->notifications()->count())->toBe(0);
})->with([
    'draft' => [ProductStatus::Draft],
    'preorder' => [ProductStatus::Preorder],
]);

test('lowering the number below the stock lets it be warned again', function () {
    $variant = stockedVariant(6);
    $this->actingAs($this->specialist);
    takeOut($variant, 2);

    $variant->product->update(['low_stock_alert_at' => 3]);
    app(LowStockAlerts::class)->rearm($variant->product);

    expect($variant->refresh()->low_stock_notified_at)->toBeNull();

    takeOut($variant, 1);

    expect($this->specialist->notifications()->count())->toBe(2);
});

test('opening a low-stock notice shows the product\'s stock history', function () {
    $variant = stockedVariant(5);
    $this->actingAs($this->specialist);
    takeOut($variant, 1);
    $notice = $this->specialist->notifications()->sole();

    $this->post(route('notifications.open', $notice->id))
        ->assertRedirect(route('products.stock', $variant->product_id));

    expect($notice->fresh()->read_at)->not->toBeNull();
});

test('the products list marks and filters products that are low on stock', function () {
    stockedVariant(3);
    $plenty = Product::factory()->create(['name' => 'Lanyard']);
    ProductVariant::factory()->for($plenty)->create(['stock_on_hand' => 40]);
    $draft = Product::factory()->create(['name' => 'Anniversary Shirt', 'status' => ProductStatus::Draft]);
    ProductVariant::factory()->for($draft)->create(['stock_on_hand' => 0]);

    $this->actingAs($this->specialist)
        ->get(route('products.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('lowStockCount', 1)
            ->where('products.data', fn ($rows) => collect($rows)->pluck('low_stock', 'name')->sortKeys()->all() === [
                'Anniversary Shirt' => false,
                'Chibi Keychain IT' => true,
                'Lanyard' => false,
            ])
        );

    $this->get(route('products.index', ['stock' => 'low']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('products.data', 1)
            ->where('products.data.0.name', 'Chibi Keychain IT')
            ->where('filters.stock', 'low')
        );
});

test('the product form saves the low-stock number', function () {
    $product = Product::factory()->create(['low_stock_alert_at' => 5]);
    ProductVariant::factory()->for($product)->create();
    $this->actingAs($this->specialist);

    $this->get(route('products.edit', $product))
        ->assertInertia(fn (Assert $page) => $page->where('product.low_stock_alert_at', '5'));

    $this->put(route('products.update', $product), [
        'name' => 'Lanyard',
        'sold_by_piece' => '1',
        'price' => '50',
        'status' => 'draft',
        'sale_price' => '',
        'low_stock_alert_at' => '12',
        'photos' => [],
        'packs' => [],
        'options' => [],
        'variants' => [['combination' => '', 'estore_item_code' => '', 'estore_pack_key' => '', 'price' => '']],
    ])->assertSessionHasNoErrors();

    expect($product->refresh()->low_stock_alert_at)->toBe(12);
});
