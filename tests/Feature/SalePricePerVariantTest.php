<?php

use App\Enums\ProductStatus;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\Shop\ShopPrice;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->specialist = User::factory()->specialist()->create();
    $this->travelTo(CarbonImmutable::parse('2026-10-03 10:00', 'Asia/Manila'));
});

/**
 * An Available STI Jacket: S and M at ₱300, XL at ₱350 (its own price),
 * each with stock that arrived a month ago.
 *
 * @return Collection<int, ProductVariant> S, M, XL
 */
function jacketSizes(): Collection
{
    $product = Product::factory()->create(['name' => 'STI Jacket', 'status' => ProductStatus::Available, 'price_centavos' => 30000]);

    foreach (['S' => null, 'M' => null, 'XL' => 35000] as $size => $price) {
        $variant = ProductVariant::factory()->for($product)->create([
            'combination' => "Size: {$size}",
            'choices' => [['option' => 'Size', 'choice' => $size]],
            'price_centavos' => $price,
            'stock_on_hand' => 10,
            'position' => $product->variants()->count(),
        ]);
        StockMovement::factory()->for($variant, 'variant')->create(['created_at' => now()->subDays(30)]);
    }

    return $product->variants()->get();
}

test('sizes with different prices get a sale price per price', function () {
    [$small, $medium, $extraLarge] = jacketSizes()->all();
    $product = $small->product;
    $this->actingAs($this->specialist);

    $this->getJson(route('products.sale.show', $product))
        ->assertJsonPath('price_groups.0.price_centavos', 30000)
        ->assertJsonPath('price_groups.0.variants.*.label', ['S', 'M'])
        ->assertJsonPath('price_groups.1.price_centavos', 35000)
        ->assertJsonPath('price_groups.1.variants.*.label', ['XL']);

    $this->post(route('products.sale.store', $product), ['group_sale_prices' => ['30000' => '250', '35000' => ''], 'days' => '7'])
        ->assertSessionHasNoErrors();

    expect($product->refresh()->status)->toBe(ProductStatus::OnSale)
        ->and($product->sale_price_centavos)->toBeNull()
        ->and(ShopPrice::perPiece($small->refresh()))->toBe(25000)
        ->and(ShopPrice::perPiece($medium->refresh()))->toBe(25000)
        ->and(ShopPrice::perPiece($extraLarge->refresh()))->toBe(35000);

    $details = $this->getJson(route('storefront.product', $product))->json();
    expect($details['price'])->toMatchArray(['piece_centavos' => 30000, 'sale_centavos' => 25000, 'piece_from' => true])
        ->and(array_column($details['variants'], 'sale_price_centavos', 'label'))->toBe(['S' => 25000, 'M' => 25000, 'XL' => null]);

    $this->get(route('products.index'))->assertInertia(fn (Assert $page) => $page
        ->where('products.data.0.sale_price_centavos', 25000)
        ->where('products.data.0.sale_by_variant', true)
    );
});

test('each sale price must be lower than the normal price of its sizes', function () {
    $product = jacketSizes()->first()->product;

    $this->actingAs($this->specialist)
        ->post(route('products.sale.store', $product), ['group_sale_prices' => ['30000' => '', '35000' => '360'], 'days' => '7'])
        ->assertSessionHasErrors(['group_sale_prices.35000' => 'The sale price must be lower than ₱350.00, their normal price.']);

    $this->post(route('products.sale.store', $product), ['group_sale_prices' => ['30000' => '', '35000' => ''], 'days' => '7'])
        ->assertSessionHasErrors(['sale_price' => 'Enter a sale price for the piece or for a pack.']);

    expect($product->refresh()->status)->toBe(ProductStatus::Available);
});

test('variants with the same price share one sale price, and ending the sale clears every price', function () {
    $product = Product::factory()->create(['name' => 'STI Umbrella', 'status' => ProductStatus::Available, 'price_centavos' => 30000]);
    foreach (['Black', 'Red'] as $position => $color) {
        ProductVariant::factory()->for($product)->create([
            'combination' => "Color: {$color}",
            'choices' => [['option' => 'Color', 'choice' => $color]],
            'stock_on_hand' => 5,
            'position' => $position,
        ]);
    }
    $this->actingAs($this->specialist);

    $this->getJson(route('products.sale.show', $product))
        ->assertJsonCount(1, 'price_groups')
        ->assertJsonPath('price_groups.0.variants.*.label', ['Black', 'Red']);

    $this->post(route('products.sale.store', $product), ['sale_price' => '250', 'days' => '7'])->assertSessionHasNoErrors();

    expect($product->variants()->get()->map(fn (ProductVariant $variant): ?int => ShopPrice::perPiece($variant))->all())->toBe([25000, 25000]);

    $this->post(route('products.sale.store', $product), ['group_sale_prices' => ['30000' => '240'], 'sale_price' => '', 'days' => '7']);
    $this->delete(route('products.sale.destroy', $product));

    expect($product->refresh()->status)->toBe(ProductStatus::Available)
        ->and($product->variants()->whereNotNull('sale_price_centavos')->count())->toBe(0)
        ->and(ShopPrice::perPiece($product->variants()->first()))->toBe(30000);
});
