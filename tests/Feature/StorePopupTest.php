<?php

use App\Enums\ProductStatus;
use App\Enums\StockMovementType;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-26 10:00', 'Asia/Manila'));
});

/**
 * A size's stock history: each entry is [days ago, type, pieces], and the
 * size ends with the last balance on the shelf.
 *
 * @param  list<array{0: int, 1: StockMovementType, 2: int}>  $history
 */
function sizeWithHistory(Product $product, string $size, array $history): ProductVariant
{
    $variant = ProductVariant::factory()->for($product)->create(['combination' => "Size: {$size}", 'choices' => [['option' => 'Size', 'choice' => $size]]]);
    $balance = 0;

    foreach ($history as [$daysAgo, $type, $pieces]) {
        $balance += $pieces;
        StockMovement::factory()->for($variant, 'variant')->create(['type' => $type, 'quantity' => $pieces, 'balance_after' => $balance, 'created_at' => now()->subDays($daysAgo)]);
    }

    $variant->forceFill(['stock_on_hand' => $balance])->save();

    return $variant;
}

test('the store pop-up shows sizes that came back in stock, then what is on sale', function () {
    $soldOutThenBack = [[20, StockMovementType::Delivery, 10], [10, StockMovementType::Sale, -10], [2, StockMovementType::Delivery, 5]];

    $polo = Product::factory()->create(['name' => 'BSIT Polo', 'status' => ProductStatus::Available]);
    sizeWithHistory($polo, 'S', $soldOutThenBack);
    sizeWithHistory($polo, 'M', [[1, StockMovementType::Delivery, 8]]); // first arrival, not back
    sizeWithHistory($polo, 'L', [[20, StockMovementType::Delivery, 10], [2, StockMovementType::Delivery, 5]]); // never ran out

    $tote = Product::factory()->create(['name' => 'STI Tote Bag', 'status' => ProductStatus::OnSale, 'sale_price_centavos' => 15000, 'sale_ends_at' => now()->addDays(2)]);
    sizeWithHistory($tote, 'One Size', [[5, StockMovementType::Delivery, 4]]);

    $longAgo = Product::factory()->create(['name' => 'PE Shirt', 'status' => ProductStatus::Available]);
    sizeWithHistory($longAgo, 'S', [[30, StockMovementType::Delivery, 10], [20, StockMovementType::Sale, -10], [8, StockMovementType::Delivery, 5]]);

    $soldAgain = Product::factory()->create(['name' => 'STI Cap', 'status' => ProductStatus::Available]);
    sizeWithHistory($soldAgain, 'Free', [[20, StockMovementType::Delivery, 3], [10, StockMovementType::Sale, -3], [3, StockMovementType::Delivery, 2], [1, StockMovementType::Sale, -2]]);

    $draft = Product::factory()->create(['name' => 'Secret Hoodie', 'status' => ProductStatus::Draft]);
    sizeWithHistory($draft, 'M', $soldOutThenBack);

    $this->get('/')
        ->assertInertia(fn (Assert $page) => $page
            ->has('spotlight', 2)
            ->where('spotlight.0.reason', 'back_in_stock')
            ->where('spotlight.0.product.name', 'BSIT Polo')
            ->where('spotlight.0.back_in_stock', ['S'])
            ->where('spotlight.1.reason', 'on_sale')
            ->where('spotlight.1.product.name', 'STI Tote Bag')
            ->where('spotlight.1.product.price.sale_centavos', 15000)
        );
});

test('a product on sale that came back shows once, as back in stock', function () {
    $tote = Product::factory()->create(['name' => 'STI Tote Bag', 'status' => ProductStatus::OnSale, 'sale_price_centavos' => 15000, 'sale_ends_at' => now()->addDays(2)]);
    sizeWithHistory($tote, 'One Size', [[20, StockMovementType::Delivery, 4], [10, StockMovementType::Sale, -4], [1, StockMovementType::Delivery, 6]]);

    $this->get('/')
        ->assertInertia(fn (Assert $page) => $page
            ->has('spotlight', 1)
            ->where('spotlight.0.reason', 'back_in_stock')
        );
});

test('the store pop-up is empty when nothing is on sale or back in stock, whatever the search', function () {
    $product = Product::factory()->create(['name' => 'Chibi Keychain', 'status' => ProductStatus::Available]);
    sizeWithHistory($product, 'Free', [[3, StockMovementType::Delivery, 20]]);

    $this->get('/?search=keychain')
        ->assertInertia(fn (Assert $page) => $page->where('spotlight', []));
});

test('the phone app gets the same store pop-up, not narrowed by the search', function () {
    $tote = Product::factory()->create(['name' => 'STI Tote Bag', 'status' => ProductStatus::OnSale, 'sale_price_centavos' => 15000, 'sale_ends_at' => now()->addDays(2)]);
    sizeWithHistory($tote, 'One Size', [[5, StockMovementType::Delivery, 4]]);

    $this->getJson(route('api.v1.storefront.home', ['search' => 'polo']))
        ->assertOk()
        ->assertJsonCount(0, 'on_sale')
        ->assertJsonPath('spotlight.0.reason', 'on_sale')
        ->assertJsonPath('spotlight.0.product.name', 'STI Tote Bag');
});
