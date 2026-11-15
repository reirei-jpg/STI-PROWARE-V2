<?php

use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductPack;
use App\Models\ProductVariant;
use App\Models\PurchaseOrder;
use App\Models\User;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-11-15 10:00', 'Asia/Manila'));
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

/**
 * A released order of $pieces of the product's size $variant at $priceEach.
 */
function soldPieces(Product $product, int $pieces, int $priceEach, ?ProductVariant $variant = null, ?string $buyer = null, ?int $costEach = null): void
{
    $variant ??= $product->variants()->firstOrFail();
    $order = Order::factory()
        ->for(User::factory()->student()->create($buyer === null ? [] : ['name' => $buyer]), 'student')
        ->create(['status' => OrderStatus::PickedUp, 'picked_up_at' => now()]);
    OrderItem::factory()->for($order)->create([
        'product_id' => $product->id,
        'product_variant_id' => $variant->id,
        'product_name' => $product->name,
        'variant_label' => $variant->choices === [] ? null : $variant->label(),
        'set_key' => null,
        'unit_name' => 'Piece',
        'pieces_per_unit' => 1,
        'quantity' => $pieces,
        'quantity_short' => 0,
        'unit_price_centavos' => $priceEach,
        'normal_unit_price_centavos' => $priceEach,
        'line_total_centavos' => $pieces * $priceEach,
        'cost_centavos' => $costEach === null ? null : $pieces * $costEach,
    ]);
}

test('What we sold shows each product\'s eStore Unit Price now and how it changed, and a search by eStore code', function () {
    $tumbler = pricedProduct('STI Thermal Tumbler', 'MTT01-001', 30000);
    orderedAt('MTT01-001', 20000, '31001', '2026-10-01');
    orderedAt('MTT01-001', 25000, '31002', '2026-11-01');
    soldPieces($tumbler, 2, 30000);
    $lanyard = pricedProduct('STI Lanyard', 'MLY01-001', 6000, piecesPerPack: 10);
    orderedAt('MLY01-001', 40000, '31003', '2026-11-02');
    soldPieces($lanyard, 5, 6000);
    $umbrella = pricedProduct('STI Umbrella', 'MUM01-001', 25000);
    soldPieces($umbrella, 1, 25000);
    // Never sold: not on What we sold.
    pricedProduct('STI Cap', 'UCP01-001', 15000);

    $this->actingAs($this->specialist)
        ->get(route('sales-reports.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.tab', 'sold')
            ->has('sold.data', 3)
            // No Cost on these sales yet, so no profit: the most pieces sold first.
            ->where('sold.data.0.product_name', 'STI Lanyard')
            ->where('sold.data.0.estore_unit_price_centavos', 40000)
            ->where('sold.data.0.estore_pieces_per_unit', 10)
            ->where('sold.data.0.estore_cost_per_piece_centavos', 4000)
            ->where('sold.data.0.estore_change_centavos', null)
            ->where('sold.data.1.product_name', 'STI Thermal Tumbler')
            ->where('sold.data.1.item_code', 'MTT01-001')
            ->where('sold.data.1.estore_unit_price_centavos', 25000)
            ->where('sold.data.1.estore_order_number', '31002')
            ->where('sold.data.1.estore_change_centavos', 5000)
            ->where('sold.data.1.estore_previous_order_number', '31001')
            ->where('sold.data.2.product_name', 'STI Umbrella')
            // Never on an eStore order.
            ->where('sold.data.2.estore_unit_price_centavos', null));

    $this->get(route('sales-reports.index', ['search' => 'mly01']))
        ->assertInertia(fn (Assert $page) => $page->has('sold.data', 1)->where('sold.data.0.product_name', 'STI Lanyard'));
    // The old Prices tab is part of What we sold now.
    $this->get(route('sales-reports.index', ['tab' => 'prices']))
        ->assertSessionHasErrors(['tab' => 'Choose What we spent, What we sold, Best sellers or Given free. Prices are on What we sold.']);
});

test('a product\'s sizes are one row on What we sold; View Details has each size and what Head Office charged on every eStore order', function () {
    $tumbler = pricedProduct('STI Thermal Tumbler', 'MTT01-001', 30000);
    $silver = ProductVariant::factory()->for($tumbler)->create(['combination' => 'Color: Silver', 'choices' => [['option' => 'Color', 'choice' => 'Silver']], 'price_centavos' => 32000]);
    orderedAt('MTT01-001', 20000, '31001', '2026-10-01');
    orderedAt('MTT01-001', 25000, '31002', '2026-11-01');
    orderedAt('MTT01-001', 22000, '31003', '2026-11-10');
    soldPieces($tumbler, 2, 30000, buyer: 'Juan Dela Cruz');
    $this->travel(1)->hours();
    soldPieces($tumbler, 1, 32000, $silver, 'Bea Villareal');

    $this->actingAs($this->specialist)
        ->get(route('sales-reports.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('sold.data', 1)
            ->where('sold.data.0.variants_count', 2)
            ->where('sold.data.0.pieces', 3)
            ->where('sold.data.0.price_from_centavos', 30000)
            ->where('sold.data.0.price_to_centavos', 32000)
            ->where('sold.data.0.price_total_centavos', 92000));

    $this->get(route('sales-reports.index', ['details' => $tumbler->id]))
        ->assertInertia(fn (Assert $page) => $page
            ->missing('sold_details')
            ->reloadOnly('sold_details', fn (Assert $reload) => $reload
                ->where('sold_details.product_name', 'STI Thermal Tumbler')
                ->has('sold_details.variants', 2)
                ->where('sold_details.variants.1.variant_label', 'Silver')
                ->where('sold_details.variants.1.price_each_centavos', 32000)
                // Who bought it is not repeated here (Top buyers and the issuance slips have it).
                ->missing('sold_details.sales')
                ->where('sold_details.estore.orders', fn ($orders) => collect($orders)->map(fn ($order) => [$order['order_number'], $order['unit_price_centavos'], $order['change_centavos']])->all() === [
                    ['31003', 22000, -3000],
                    ['31002', 25000, 5000],
                    ['31001', 20000, null],
                ])));
});

test('a PO\'s details show each item\'s price on the eStore order before it, and What we spent names what was bought', function () {
    orderedAt('MTT01-001', 20000, '31001', '2026-10-01');
    $later = PurchaseOrder::factory()
        ->withItems([
            ['item_code' => 'MTT01-001', 'description' => 'STI Thermal Tumbler', 'quantity_ordered' => 10, 'unit_price_centavos' => 25000, 'amount_centavos' => 250000],
            ['item_code' => 'MLY01-001', 'description' => 'STI Lanyard', 'quantity_ordered' => 5, 'unit_price_centavos' => 40000, 'amount_centavos' => 200000],
        ])
        ->create(['order_number' => '31002', 'date_ordered' => '2026-11-01']);
    $this->actingAs($this->specialist);

    $this->getJson(route('purchase-orders.show', $later))
        ->assertJsonPath('items.0.unit_price_centavos', 25000)
        // "₱200.00 → ₱250.00"
        ->assertJsonPath('items.0.previous_unit_price_centavos', 20000)
        // Its first eStore order.
        ->assertJsonPath('items.1.previous_unit_price_centavos', null);

    $this->get(route('sales-reports.index', ['tab' => 'spent']))->assertInertia(fn (Assert $page) => $page
        ->where('spent.data.0.order_number', '31002')
        ->where('spent.data.0.items_label', 'STI Thermal Tumbler and 1 more')
        ->where('spent.data.0.delivery_status', 'awaiting')
        ->where('spent.data.0.delivery_status_label', 'Awaiting Delivery'));
});

test('What we sold lists the highest profit first, then the most pieces sold; no Cost yet goes last', function () {
    // Big sales, small profit: 10 × (₱300 − ₱280) = ₱200.
    soldPieces(pricedProduct('STI Thermal Tumbler', 'MTT01-001', 30000), 10, 30000, costEach: 28000);
    // Small sales, big profit: 2 × (₱500 − ₱200) = ₱600.
    soldPieces(pricedProduct('STI Varsity Hoodie', 'UVH01-001', 50000), 2, 50000, costEach: 20000);
    // Same profit as the Tumbler, fewer pieces: 1 × (₱450 − ₱250) = ₱200.
    soldPieces(pricedProduct('STI Sweatpants', 'USW01-001', 45000), 1, 45000, costEach: 25000);
    // No Cost yet: last, the most pieces first.
    soldPieces(pricedProduct('STI Lanyard', 'MLY01-001', 6000), 5, 6000);
    soldPieces(pricedProduct('STI Ballpen', 'MBP01-001', 1500), 50, 1500);

    $this->actingAs($this->specialist)->get(route('sales-reports.index'))->assertInertia(fn (Assert $page) => $page
        ->where('sold.data', fn ($rows) => collect($rows)->map(fn ($row) => [$row['product_name'], $row['profit_centavos']])->all() === [
            ['STI Varsity Hoodie', 60000],
            ['STI Thermal Tumbler', 20000],
            ['STI Sweatpants', 20000],
            ['STI Ballpen', null],
            ['STI Lanyard', null],
        ]));
});
