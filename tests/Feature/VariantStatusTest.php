<?php

use App\Enums\ProductStatus;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\Stock\RestockedPreorders;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');
    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:00', 'Asia/Manila'));
    $this->specialist = User::factory()->specialist()->create();
});

/**
 * The Add / Edit Product form for Bagong Product in Navy Blue and Red, size
 * S, each with the status given, changed by $overrides.
 *
 * @param  array{navy: string, red: string}  $statuses
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function bagongProductForm(array $statuses, array $overrides = []): array
{
    return array_merge([
        'name' => 'Bagong Product',
        'item_code' => '',
        'sold_by_piece' => '1',
        'price' => '150',
        'low_stock_alert_at' => '5',
        'preorders_close_on' => '2026-11-30',
        'expected_arrival_from' => '2026-12-14',
        'expected_arrival_to' => '2026-12-21',
        'photos' => [['file' => UploadedFile::fake()->image('front.jpg'), 'label' => 'Front']],
        'packs' => [],
        'options' => [['name' => 'Size', 'choices' => ['S']], ['name' => 'Color', 'choices' => ['Navy Blue', 'Red']]],
        'variants' => [
            ['combination' => 'Size: S | Color: Navy Blue', 'status' => $statuses['navy'], 'estore_item_code' => 'BP-01-S-NAVY', 'estore_pack_key' => '', 'price' => ''],
            ['combination' => 'Size: S | Color: Red', 'status' => $statuses['red'], 'estore_item_code' => 'BP-01-S-RED', 'estore_pack_key' => '', 'price' => ''],
        ],
    ], $overrides);
}

/**
 * A saved Bagong Product: Navy Blue with the stock and status given, Red a
 * Draft with no stock.
 *
 * @return array{0: Product, 1: ProductVariant, 2: ProductVariant}
 */
function savedBagongProduct(int $navyStock, ProductStatus $navyStatus = ProductStatus::Available): array
{
    $product = Product::factory()->create(['name' => 'Bagong Product', 'item_code' => 'BP-01', 'status' => ProductStatus::Available, 'price_centavos' => 15000]);
    $product->options()->create(['name' => 'Size', 'choices' => ['S'], 'position' => 0]);
    $product->options()->create(['name' => 'Color', 'choices' => ['Navy Blue', 'Red'], 'position' => 1]);
    $navy = ProductVariant::factory()->for($product)->create([
        'combination' => 'Size: S | Color: Navy Blue', 'status' => $navyStatus, 'estore_item_code' => 'BP-01-S-NAVY',
        'choices' => [['option' => 'Size', 'choice' => 'S'], ['option' => 'Color', 'choice' => 'Navy Blue']],
    ]);
    $navy->forceFill(['stock_on_hand' => $navyStock])->save();
    $red = ProductVariant::factory()->for($product)->create([
        'combination' => 'Size: S | Color: Red', 'status' => ProductStatus::Draft, 'estore_item_code' => 'BP-01-S-RED', 'position' => 1,
        'choices' => [['option' => 'Size', 'choice' => 'S'], ['option' => 'Color', 'choice' => 'Red']],
    ]);

    return [$product, $navy, $red];
}

test('each variant keeps its own status and Item Code, and the product shows as its variants add up', function () {
    $this->actingAs($this->specialist)
        ->post(route('products.store'), bagongProductForm(['navy' => 'preorder', 'red' => 'draft']))
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.message', 'Bagong Product has been saved with 2 variants. It is open for preorders until Nov 30, 2026 and expected to arrive Dec 14 – Dec 21, 2026. 1 variant stays hidden as a Draft.');

    $product = Product::sole();

    expect($product->status)->toBe(ProductStatus::Preorder)
        ->and($product->item_code)->toBe('BP-01')
        ->and($product->variants->mapWithKeys(fn (ProductVariant $variant): array => [$variant->estore_item_code => $variant->status])->all())
        ->toBe(['BP-01-S-NAVY' => ProductStatus::Preorder, 'BP-01-S-RED' => ProductStatus::Draft]);
});

test('a product without an Item Code gets the next free number for its name', function () {
    Product::factory()->create(['name' => 'Bagong Polo', 'item_code' => 'BP-01']);

    $this->actingAs($this->specialist)
        ->post(route('products.store'), bagongProductForm(['navy' => 'draft', 'red' => 'draft'], ['photos' => []]))
        ->assertSessionHasNoErrors();

    expect(Product::query()->where('name', 'Bagong Product')->sole()->item_code)->toBe('BP-02');
});

test('an Item Code another product has is refused', function () {
    Product::factory()->create(['name' => 'Bagong Polo', 'item_code' => 'BP-01']);

    $this->actingAs($this->specialist)
        ->post(route('products.store'), bagongProductForm(['navy' => 'draft', 'red' => 'draft'], ['item_code' => 'bp-01']))
        ->assertSessionHasErrors(['item_code' => 'The Item Code BP-01 already belongs to "Bagong Polo".']);

    expect(Product::count())->toBe(1);
});

test('a variant with no stock cannot be made Available', function () {
    $this->actingAs($this->specialist)
        ->post(route('products.store'), bagongProductForm(['navy' => 'available', 'red' => 'draft']))
        ->assertSessionHasErrors(['variants.0.status' => 'It has no stock yet, so it cannot be Available. Choose Preorder or Draft. It becomes Available by itself when stock arrives.']);

    expect(Product::count())->toBe(0);
});

test('a variant with stock cannot be a Preorder, nor go back to Draft', function () {
    [$product] = savedBagongProduct(navyStock: 5);
    $this->actingAs($this->specialist);

    $this->put(route('products.update', $product), bagongProductForm(['navy' => 'preorder', 'red' => 'draft']))
        ->assertSessionHasErrors(['variants.0.status' => 'It has 5 pcs in stock, so it cannot be a Preorder. Choose Available.']);
    $this->put(route('products.update', $product), bagongProductForm(['navy' => 'draft', 'red' => 'draft']))
        ->assertSessionHasErrors(['variants.0.status' => 'It is in the store with 5 pcs in stock, so it cannot go back to Draft.']);

    expect($product->refresh()->status)->toBe(ProductStatus::Available);
});

test('a sold-out variant that is already Available can stay Available', function () {
    [$product, $navy] = savedBagongProduct(navyStock: 0);

    $this->actingAs($this->specialist)
        ->put(route('products.update', $product), bagongProductForm(['navy' => 'available', 'red' => 'draft']))
        ->assertSessionHasNoErrors();

    expect($navy->refresh()->status)->toBe(ProductStatus::Available);
});

test('a Draft variant is hidden from buyers and cannot be added to the cart', function () {
    [$product, , $red] = savedBagongProduct(navyStock: 5);

    $this->getJson(route('storefront.product', $product))
        ->assertOk()
        ->assertJsonCount(1, 'variants')
        ->assertJsonPath('variants.0.label', 'S / Navy Blue')
        ->assertJsonPath('options.1.choices', ['Navy Blue']);

    $this->actingAs(User::factory()->student()->create())
        ->post(route('cart.store', $product), ['product_variant_id' => $red->id, 'quantity' => '1'])
        ->assertSessionHasErrors(['product_variant_id' => 'Choose one of this item\'s sizes or colors.']);
});

test('a Preorder variant becomes Available when its stock comes in; a Draft one stays hidden', function () {
    [$product, $navy, $red] = savedBagongProduct(navyStock: 0, navyStatus: ProductStatus::Preorder);
    $product->update(['status' => ProductStatus::Preorder]);

    $red->forceFill(['stock_on_hand' => 4])->save();
    app(RestockedPreorders::class)->check($red);

    expect($red->refresh()->status)->toBe(ProductStatus::Draft)
        ->and($product->refresh()->status)->toBe(ProductStatus::Preorder);

    $navy->forceFill(['stock_on_hand' => 10])->save();
    app(RestockedPreorders::class)->check($navy);

    expect($navy->refresh()->status)->toBe(ProductStatus::Available)
        ->and($product->refresh()->status)->toBe(ProductStatus::Available);
});
