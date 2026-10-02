<?php

use App\Enums\ProductStatus;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\ProductPack;
use App\Models\ProductPhoto;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * A product with one variant holding $stock pieces. When $received, the
 * variant has a stock movement, as it does once a delivery arrived.
 *
 * @param  array<string, mixed>  $attributes
 */
function shopProduct(string $name, int $stock, array $attributes = [], bool $received = true): Product
{
    $product = Product::factory()->create(['name' => $name, 'status' => ProductStatus::Available, 'price_centavos' => 35000, ...$attributes]);
    $variant = ProductVariant::factory()->for($product)->create(['stock_on_hand' => $stock]);

    if ($received) {
        StockMovement::factory()->for($variant, 'variant')->create();
    }

    return $product;
}

test('anyone can browse the storefront without signing in', function () {
    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('storefront/home')
            ->where('auth.user', null)
        );
});

test('signed-in staff can also open the storefront', function () {
    $this->actingAs(User::factory()->specialist()->create())
        ->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('storefront/home'));
});

test('each product shows in the right section, and drafts and items never received stay hidden', function () {
    shopProduct('42nd Anniversary Shirt', 0, ['status' => ProductStatus::Preorder], received: false);
    shopProduct('Lanyard', 30, ['status' => ProductStatus::OnSale, 'sale_price_centavos' => 30000]);
    shopProduct('Old Tumbler', 0, ['status' => ProductStatus::OnSale, 'sale_price_centavos' => 20000]);
    shopProduct('Chibi Keychain', 45);
    shopProduct('PE Shirt', 0, received: false);
    shopProduct('Secret Hoodie', 10, ['status' => ProductStatus::Draft]);

    $this->get('/')
        ->assertInertia(fn (Assert $page) => $page
            ->where('comingSoon', fn ($products) => collect($products)->pluck('name')->all() === ['42nd Anniversary Shirt'])
            ->where('onSale', fn ($products) => collect($products)->pluck('name')->all() === ['Lanyard'])
            ->where('merchandise.data', fn ($products) => collect($products)->pluck('name')->sort()->values()->all() === ['Chibi Keychain', 'Lanyard', 'Old Tumbler'])
        );
});

test('the feed shows the newest first and sold-out products last', function () {
    shopProduct('Sold Out Shirt', 0, ['created_at' => now()]);
    shopProduct('Older Keychain', 5, ['created_at' => now()->subDays(3)]);
    shopProduct('Newer Lanyard', 9, ['created_at' => now()->subDay()]);

    $this->get('/')
        ->assertInertia(fn (Assert $page) => $page
            ->where('merchandise.data.0.name', 'Newer Lanyard')
            ->where('merchandise.data.1.name', 'Older Keychain')
            ->where('merchandise.data.2.name', 'Sold Out Shirt')
            ->where('merchandise.data.2.sold_out', true)
        );
});

test('the feed can be searched and narrowed to in stock or sold out', function () {
    shopProduct('Chibi Keychain', 45);
    shopProduct('Chibi Pin', 0);
    shopProduct('Lanyard', 30);

    $this->get('/?search=chibi')
        ->assertInertia(fn (Assert $page) => $page
            ->has('merchandise.data', 2)
            ->where('filters', ['search' => 'chibi', 'show' => null])
        );

    $this->get('/?show=in_stock')
        ->assertInertia(fn (Assert $page) => $page
            ->where('merchandise.data', fn ($products) => collect($products)->pluck('name')->sort()->values()->all() === ['Chibi Keychain', 'Lanyard'])
        );

    $this->get('/?show=sold_out')
        ->assertInertia(fn (Assert $page) => $page
            ->has('merchandise.data', 1)
            ->where('merchandise.data.0.name', 'Chibi Pin')
        );
});

test('the feed loads 20 products at a time as the visitor scrolls', function () {
    foreach (range(1, 25) as $number) {
        shopProduct("Keychain {$number}", 5);
    }

    $this->get('/')->assertInertia(fn (Assert $page) => $page->has('merchandise.data', 20));
    $this->get('/?page=2')->assertInertia(fn (Assert $page) => $page->has('merchandise.data', 5));
});

test('a tile shows the price per piece, the sale price and the packs students can buy', function () {
    $shirt = shopProduct('TM Polo', 20, ['price_centavos' => 35000]);
    ProductVariant::factory()->for($shirt)->create(['combination' => 'Size: XL', 'price_centavos' => 40000, 'stock_on_hand' => 3]);
    $pens = shopProduct('Ballpen', 120, ['sold_by_piece' => false, 'price_centavos' => null]);
    ProductPack::factory()->for($pens)->soldToStudents(10000)->create(['name' => 'Box', 'pieces' => 12]);
    shopProduct('Lanyard', 30, ['status' => ProductStatus::OnSale, 'price_centavos' => 8000, 'sale_price_centavos' => 5000]);

    $tiles = collect($this->get('/')->inertiaProps('merchandise.data'))->keyBy('name');

    expect($tiles['TM Polo']['price'])->toBe(['piece_centavos' => 35000, 'piece_from' => true, 'sale_centavos' => null, 'packs' => []])
        ->and($tiles['Ballpen']['price'])->toBe(['piece_centavos' => null, 'piece_from' => false, 'sale_centavos' => null, 'packs' => [['name' => 'Box', 'pieces' => 12, 'price_centavos' => 10000]]])
        ->and($tiles['Lanyard']['price'])->toMatchArray(['piece_centavos' => 8000, 'sale_centavos' => 5000]);
});

test('a product with few pieces left shows almost sold out with how many are left', function () {
    shopProduct('Chibi Keychain', 3, ['low_stock_alert_at' => 5]);
    shopProduct('Lanyard', 6, ['low_stock_alert_at' => 5]);

    $tiles = collect($this->get('/')->inertiaProps('merchandise.data'))->keyBy('name');

    expect($tiles['Chibi Keychain'])->toMatchArray(['almost_sold_out' => true, 'pieces_left' => 3, 'sold_out' => false])
        ->and($tiles['Lanyard'])->toMatchArray(['almost_sold_out' => false, 'pieces_left' => null]);
});

test('the product view shows its photos, options and which variants are in stock', function () {
    $product = Product::factory()->create(['name' => 'TM Polo', 'status' => ProductStatus::Available, 'low_stock_alert_at' => 5]);
    ProductPhoto::factory()->for($product)->create(['label' => 'Front', 'position' => 0]);
    ProductOption::factory()->for($product)->create(['name' => 'Size', 'choices' => ['S/M', 'M/L', 'XL']]);
    foreach ([['S/M', 20], ['M/L', 2], ['XL', 0]] as $position => [$size, $stock]) {
        ProductVariant::factory()->for($product)->create([
            'combination' => "Size: {$size}",
            'choices' => [['option' => 'Size', 'choice' => $size]],
            'stock_on_hand' => $stock,
            'position' => $position,
        ]);
    }

    $this->getJson(route('storefront.product', $product))
        ->assertOk()
        ->assertJsonPath('name', 'TM Polo')
        ->assertJsonPath('photos.0.label', 'Front')
        ->assertJsonPath('options.0.name', 'Size')
        ->assertJsonPath('variants.0.availability', 'in_stock')
        ->assertJsonPath('variants.0.pieces_left', null)
        ->assertJsonPath('variants.1.availability', 'almost_sold_out')
        ->assertJsonPath('variants.1.pieces_left', 2)
        ->assertJsonPath('variants.2.availability', 'sold_out');
});

test('a preorder product\'s view says its variants are coming soon', function () {
    $product = shopProduct('42nd Anniversary Shirt', 0, ['status' => ProductStatus::Preorder], received: false);

    $this->getJson(route('storefront.product', $product))
        ->assertOk()
        ->assertJsonPath('variants.0.availability', 'coming_soon')
        ->assertJsonPath('sold_out', false);
});

test('a draft product cannot be viewed by students', function () {
    $product = shopProduct('Secret Hoodie', 10, ['status' => ProductStatus::Draft]);

    $this->getJson(route('storefront.product', $product))->assertNotFound();
});
