<?php

use App\Enums\ProductStatus;
use App\Models\Product;
use App\Models\ProductPack;
use App\Models\ProductVariant;
use App\Models\PurchaseOrder;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->specialist = User::factory()->specialist()->create();
});

/**
 * A product sold at $price per piece, linked to the eStore code, Head
 * Office sending it in packs of $piecesPerPack (1: by the piece).
 */
function pricedProduct(string $name, string $code, int $price, int $piecesPerPack = 1): Product
{
    $product = Product::factory()->create(['name' => $name, 'status' => ProductStatus::Available, 'price_centavos' => $price, 'sale_price_centavos' => null]);
    $pack = $piecesPerPack > 1 ? ProductPack::factory()->for($product)->create(['name' => 'Pack', 'pieces' => $piecesPerPack]) : null;
    ProductVariant::factory()->for($product)->create(['estore_item_code' => $code, 'estore_pack_id' => $pack?->id, 'price_centavos' => null]);

    return $product;
}

/**
 * An uploaded eStore order of the code at this Unit Price.
 */
function orderedAt(string $code, int $unitPrice, string $orderNumber, string $date): PurchaseOrder
{
    return PurchaseOrder::factory()
        ->withItems([['item_code' => $code, 'quantity_ordered' => 10, 'unit_price_centavos' => $unitPrice, 'amount_centavos' => 10 * $unitPrice]])
        ->create(['order_number' => $orderNumber, 'date_ordered' => $date]);
}

test('Prices shows each product\'s eStore Unit Price beside its Selling Price, the profit per piece and the price change', function () {
    $tumbler = pricedProduct('STI Thermal Tumbler', 'MTT01-001', 30000);
    orderedAt('MTT01-001', 20000, '31001', '2026-10-01');
    orderedAt('MTT01-001', 25000, '31002', '2026-11-01');
    pricedProduct('STI Lanyard', 'MLY01-001', 6000, piecesPerPack: 10);
    orderedAt('MLY01-001', 40000, '31003', '2026-11-02');
    $cap = pricedProduct('STI Cap', 'UCP01-001', 15000);
    orderedAt('UCP01-001', 18000, '31004', '2026-11-03');
    pricedProduct('STI Umbrella', 'MUM01-001', 25000);

    $this->actingAs($this->specialist)
        ->get(route('sales-reports.index', ['tab' => 'prices']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.show', 'all')
            ->has('prices.data', 4)
            ->where('prices.data.0.product_name', 'STI Cap')
            ->where('prices.data.0.below_cost', true)
            ->where('prices.data.0.profit_per_piece_centavos', -3000)
            ->where('prices.data.1.product_name', 'STI Lanyard')
            ->where('prices.data.1.unit_price_centavos', 40000)
            ->where('prices.data.1.cost_per_piece_centavos', 4000)
            ->where('prices.data.1.profit_per_piece_centavos', 2000)
            ->where('prices.data.1.margin_percent', 33)
            ->where('prices.data.2.product_name', 'STI Thermal Tumbler')
            ->where('prices.data.2.order_number', '31002')
            ->where('prices.data.2.cost_per_piece_centavos', 25000)
            ->where('prices.data.2.price_from_centavos', 30000)
            ->where('prices.data.2.profit_per_piece_centavos', 5000)
            ->where('prices.data.2.change_centavos', 5000)
            ->where('prices.data.2.previous_order_number', '31001')
            // Never ordered from the eStore yet.
            ->where('prices.data.3.product_name', 'STI Umbrella')
            ->where('prices.data.3.unit_price_centavos', null)
            ->where('prices.data.3.profit_per_piece_centavos', null));

    $this->get(route('sales-reports.index', ['tab' => 'prices', 'show' => 'below_cost']))
        ->assertInertia(fn (Assert $page) => $page->has('prices.data', 1)->where('prices.data.0.product_id', $cap->id));
    $this->get(route('sales-reports.index', ['tab' => 'prices', 'show' => 'changed']))
        ->assertInertia(fn (Assert $page) => $page->has('prices.data', 1)->where('prices.data.0.product_id', $tumbler->id));
    $this->get(route('sales-reports.index', ['tab' => 'prices', 'search' => 'mly01']))
        ->assertInertia(fn (Assert $page) => $page->has('prices.data', 1)->where('prices.data.0.product_name', 'STI Lanyard'));
    $this->get(route('sales-reports.index', ['tab' => 'prices', 'show' => 'cheapest']))
        ->assertSessionHasErrors('show');
});

test('View Details lists every eStore order of the product with its Unit Price, newest first', function () {
    $tumbler = pricedProduct('STI Thermal Tumbler', 'MTT01-001', 30000);
    orderedAt('MTT01-001', 20000, '31001', '2026-10-01');
    orderedAt('MTT01-001', 25000, '31002', '2026-11-01');
    orderedAt('MTT01-001', 22000, '31003', '2026-11-10');

    $this->actingAs($this->specialist)
        ->get(route('sales-reports.index', ['tab' => 'prices', 'history' => $tumbler->id]))
        ->assertInertia(fn (Assert $page) => $page
            ->missing('price_history')
            ->reloadOnly('price_history', fn (Assert $reload) => $reload
                ->where('price_history.product_name', 'STI Thermal Tumbler')
                ->where('price_history.price_from_centavos', 30000)
                ->where('price_history.orders', fn ($orders) => collect($orders)->map(fn ($order) => [$order['order_number'], $order['unit_price_centavos'], $order['change_centavos']])->all() === [
                    ['31003', 22000, -3000],
                    ['31002', 25000, 5000],
                    ['31001', 20000, null],
                ])));
});
