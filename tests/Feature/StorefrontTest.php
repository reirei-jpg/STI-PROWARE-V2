<?php

use App\Enums\DeliveryStatus;
use App\Enums\ProductStatus;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\ProductPack;
use App\Models\ProductPhoto;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\Stock\RestockedPreorders;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Sanctum;

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

test('All Merchandise shows NEW first, then on sale, then the rest, sold out last', function () {
    shopProduct('Sold Out Shirt', 0, ['created_at' => now()]);
    shopProduct('Old Keychain', 5, ['created_at' => now()->subDays(9)]);
    shopProduct('Newer Lanyard', 9, ['created_at' => now()->subDays(5)]);
    shopProduct('Tumbler On Sale', 9, ['status' => ProductStatus::OnSale, 'sale_price_centavos' => 30000, 'sale_ends_at' => now()->addDays(4)]);
    shopProduct('Mug On Sale', 9, ['status' => ProductStatus::OnSale, 'sale_price_centavos' => 30000, 'sale_ends_at' => now()->addDays(2)]);
    shopProduct('New Cap', 9, ['new_until' => now()->addDays(2)]);
    shopProduct('Newest Pin On Sale', 9, ['status' => ProductStatus::OnSale, 'sale_price_centavos' => 30000, 'sale_ends_at' => now()->addDays(5), 'new_until' => now()->addDays(3)]);
    shopProduct('No Longer New Bag', 9, ['new_until' => now()->subMinute(), 'created_at' => now()->subDays(4)]);

    $this->get('/')
        ->assertInertia(fn (Assert $page) => $page
            ->where('merchandise.data', fn ($products) => collect($products)->pluck('name')->all() === [
                'Newest Pin On Sale', 'New Cap', 'Mug On Sale', 'Tumbler On Sale', 'No Longer New Bag', 'Newer Lanyard', 'Old Keychain', 'Sold Out Shirt',
            ])
            ->where('merchandise.data', fn ($products) => collect($products)->where('is_new', true)->pluck('name')->all() === ['Newest Pin On Sale', 'New Cap'])
        );
});

test('a product is NEW for 3 days after its first stock arrives, and not again for later stock', function () {
    $product = shopProduct('STI Umbrella', 0, received: false);
    $variant = $product->variants()->sole();

    $variant->forceFill(['stock_on_hand' => 10])->save();
    app(RestockedPreorders::class)->check($variant);
    expect($product->refresh()->isNew())->toBeTrue();

    $this->travel(3)->days();
    $variant->forceFill(['stock_on_hand' => 20])->save();
    app(RestockedPreorders::class)->check($variant);
    expect($product->refresh()->isNew())->toBeFalse();
});

test('a Coming Soon product that arrives leaves Coming Soon at once for All Merchandise, saying new stock is available for a day and NEW for 3 days', function () {
    $product = shopProduct('STI Hoodie', 0, ['status' => ProductStatus::Preorder], received: false);
    $variant = $product->variants()->sole();
    StockMovement::factory()->for($variant, 'variant')->create();
    $variant->forceFill(['stock_on_hand' => 10])->save();

    app(RestockedPreorders::class)->check($variant);

    expect($product->refresh()->status)->toBe(ProductStatus::Available);
    $this->get('/')
        ->assertInertia(fn (Assert $page) => $page
            ->has('comingSoon', 0)
            ->where('merchandise.data.0.name', 'STI Hoodie')
            ->where('merchandise.data.0.is_new', true)
            ->where('merchandise.data.0.new_stock', true)
            ->where('merchandise.data.0.accepts_preorders', false)
        );

    $this->travel(25)->hours();
    $this->get('/')
        ->assertInertia(fn (Assert $page) => $page
            ->where('merchandise.data.0.name', 'STI Hoodie')
            ->where('merchandise.data.0.is_new', true)
            ->where('merchandise.data.0.new_stock', false)
        );

    $this->travel(2)->days();
    $this->getJson(route('api.v1.storefront.merchandise'))->assertJsonPath('data.0.is_new', false);
});

test('a sold-out product says Available soon while an uploaded eStore order still has pieces of it coming', function () {
    $umbrella = shopProduct('STI Umbrella', 0);
    $umbrella->variants()->sole()->forceFill(['estore_item_code' => 'PRUM01-01'])->save();
    $lanyard = shopProduct('STI Lanyard', 5);
    $lanyard->variants()->sole()->forceFill(['estore_item_code' => 'PRLY01-01'])->save();
    $availableSoon = fn (): array => collect($this->getJson(route('api.v1.storefront.merchandise'))->json('data'))->where('available_soon', true)->pluck('name')->all();

    expect($availableSoon())->toBe([]);

    $order = orderWith(['PRUM01-01' => 10, 'PRLY01-01' => 10]);
    expect($availableSoon())->toBe(['STI Umbrella'])
        ->and($this->getJson(route('api.v1.storefront.product', $umbrella))->json('variants.0.available_soon'))->toBeTrue();

    $order->items()->update(['quantity_delivered' => 10]);
    $order->forceFill(['delivery_status' => DeliveryStatus::Completed])->save();
    expect($availableSoon())->toBe([]);
});

test('a delivery to a sold-out product makes it NEW again, but not one to a product that still had stock', function () {
    $umbrella = shopProduct('STI Umbrella', 0, ['new_until' => now()->subMonth()]);
    $umbrella->variants()->sole()->forceFill(['estore_item_code' => 'PRUM01-01'])->save();
    $lanyard = shopProduct('STI Lanyard', 5, ['new_until' => now()->subMonth()]);
    $lanyard->variants()->sole()->forceFill(['estore_item_code' => 'PRLY01-01'])->save();
    $order = orderWith(['PRUM01-01' => 10, 'PRLY01-01' => 10]);

    $this->actingAs(User::factory()->specialist()->create())->post(route('deliveries.store'), [
        'received_on' => now()->toDateString(),
        'items' => [
            ['purchase_order_item_id' => itemOf($order, 'PRUM01-01'), 'quantity_received' => 10],
            ['purchase_order_item_id' => itemOf($order, 'PRLY01-01'), 'quantity_received' => 10],
        ],
    ])->assertSessionHasNoErrors();

    expect($umbrella->refresh()->isNew())->toBeTrue()
        ->and($lanyard->refresh()->isNew())->toBeFalse();
});

test('the All Merchandise search narrows only All Merchandise, on the website and the phone', function () {
    shopProduct('Chibi Hoodie', 0, ['status' => ProductStatus::Preorder], received: false);
    shopProduct('Chibi Keychain', 45);
    shopProduct('Lanyard', 30);

    $this->get('/?find=chibi')
        ->assertInertia(fn (Assert $page) => $page
            ->where('merchandise.data', fn ($products) => collect($products)->pluck('name')->all() === ['Chibi Keychain'])
            ->where('comingSoon', fn ($products) => collect($products)->pluck('name')->all() === ['Chibi Hoodie'])
            ->where('filters', ['search' => null, 'find' => 'chibi', 'show' => null])
        );

    $this->getJson(route('api.v1.storefront.merchandise', ['find' => 'lanyard']))
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Lanyard');
});

test('the feed can be searched and narrowed to in stock or sold out', function () {
    shopProduct('Chibi Keychain', 45);
    shopProduct('Chibi Pin', 0);
    shopProduct('Lanyard', 30);

    $this->get('/?search=chibi')
        ->assertInertia(fn (Assert $page) => $page
            ->has('merchandise.data', 2)
            ->where('filters', ['search' => 'chibi', 'find' => null, 'show' => null])
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

test('a search covers every section on the website and the phone', function () {
    shopProduct('Chibi Hoodie', 0, ['status' => ProductStatus::Preorder], received: false);
    shopProduct('Anniversary Shirt', 0, ['status' => ProductStatus::Preorder], received: false);
    shopProduct('Chibi Lanyard', 30, ['status' => ProductStatus::OnSale, 'sale_price_centavos' => 30000]);
    shopProduct('Old Tumbler', 30, ['status' => ProductStatus::OnSale, 'sale_price_centavos' => 20000]);
    shopProduct('Chibi Keychain', 45);
    shopProduct('Ballpen', 45);

    $this->get('/?search=CHIBI')
        ->assertInertia(fn (Assert $page) => $page
            ->where('comingSoon', fn ($products) => collect($products)->pluck('name')->all() === ['Chibi Hoodie'])
            ->where('onSale', fn ($products) => collect($products)->pluck('name')->all() === ['Chibi Lanyard'])
            ->where('merchandise.data', fn ($products) => collect($products)->pluck('name')->sort()->values()->all() === ['Chibi Keychain', 'Chibi Lanyard'])
        );

    Sanctum::actingAs(User::factory()->student()->create());

    $this->getJson(route('api.v1.storefront.home', ['search' => 'chibi']))
        ->assertOk()
        ->assertJsonCount(1, 'coming_soon')
        ->assertJsonPath('coming_soon.0.name', 'Chibi Hoodie')
        ->assertJsonCount(1, 'on_sale')
        ->assertJsonPath('on_sale.0.name', 'Chibi Lanyard');
    $this->getJson(route('api.v1.storefront.home'))
        ->assertJsonCount(2, 'coming_soon')
        ->assertJsonCount(2, 'on_sale');
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
        ->and($tiles['Ballpen']['price'])->toBe(['piece_centavos' => null, 'piece_from' => false, 'sale_centavos' => null, 'packs' => [['name' => 'Box', 'pieces' => 12, 'price_centavos' => 10000, 'sale_price_centavos' => null]]])
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

test('each variant says its choice for each option, so size and color can be picked on their own rows', function () {
    $flask = Product::factory()->create(['name' => 'STI Aqua Flask', 'status' => ProductStatus::Available]);
    ProductOption::factory()->for($flask)->create(['name' => 'Capacity', 'choices' => ['14 oz', '22 oz'], 'position' => 0]);
    ProductOption::factory()->for($flask)->create(['name' => 'Color', 'choices' => ['Black', 'Cyan'], 'position' => 1]);
    ProductVariant::factory()->for($flask)->create([
        'combination' => 'Capacity: 14 oz | Color: Black',
        'choices' => [['option' => 'Capacity', 'choice' => '14 oz'], ['option' => 'Color', 'choice' => 'Black']],
        'stock_on_hand' => 5,
    ]);
    $ballpen = Product::factory()->create(['name' => 'STI Ballpen', 'status' => ProductStatus::Available]);
    ProductVariant::factory()->for($ballpen)->create(['stock_on_hand' => 5]);

    $this->getJson(route('storefront.product', $flask))
        ->assertJsonPath('variants.0.choices', ['Capacity' => '14 oz', 'Color' => 'Black']);
    // A product without options sends an empty object, not a list.
    expect($this->get(route('storefront.product', $ballpen))->getContent())->toContain('"choices":{}');
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
