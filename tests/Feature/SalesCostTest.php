<?php

use App\Enums\ProductStatus;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductPack;
use App\Models\ProductVariant;
use App\Models\PurchaseOrder;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\Stock\StockCost;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-09 10:00', 'Asia/Manila'));
    $this->specialist = User::factory()->specialist()->create();
    $this->student = User::factory()->student()->create();
});

/**
 * STI Jacket at ₱400 a piece; Head Office sells it by the Pack of 5.
 */
function costedJacket(): ProductVariant
{
    $product = Product::factory()->create(['name' => 'STI Jacket', 'status' => ProductStatus::Available, 'price_centavos' => 40000, 'sale_price_centavos' => 35000, 'low_stock_alert_at' => 0]);
    $pack = ProductPack::factory()->for($product)->create(['name' => 'Pack', 'pieces' => 5]);

    return ProductVariant::factory()->for($product)->create(['estore_item_code' => 'UJKT01-02', 'estore_pack_id' => $pack->id]);
}

/**
 * An uploaded eStore order of the jacket at this price per Pack, received in full.
 */
function receivedJacketOrder(int $packs, int $pricePerPack): PurchaseOrder
{
    $order = PurchaseOrder::factory()->withItems([[
        'item_code' => 'UJKT01-02', 'description' => 'STI Jacket', 'quantity_ordered' => $packs, 'quantity_delivered' => 0,
        'unit_price_centavos' => $pricePerPack, 'amount_centavos' => $packs * $pricePerPack,
    ]])->create();

    test()->actingAs(test()->specialist)->post(route('deliveries.store'), [
        'received_on' => now()->toDateString(),
        'items' => [['purchase_order_item_id' => itemOf($order, 'UJKT01-02'), 'quantity_received' => $packs]],
    ])->assertSessionHasNoErrors();

    return $order;
}

/**
 * The student orders this many pieces and the Specialist releases them.
 */
function releasedJackets(ProductVariant $variant, int $pieces): Order
{
    CartItem::factory()->for(test()->student, 'student')->for($variant, 'variant')->create(['quantity' => $pieces]);
    test()->actingAs(test()->student)->post(route('my-orders.store'))->assertSessionHasNoErrors();
    $order = Order::query()->latest('id')->firstOrFail();

    test()->actingAs(test()->specialist)->post(route('orders.release', $order), ['paid' => true])->assertSessionHasNoErrors();

    return $order;
}

test('a delivery carries its eStore price, per piece from the price per pack', function () {
    $variant = costedJacket();
    receivedJacketOrder(packs: 2, pricePerPack: 100000);

    expect(StockMovement::sole())
        ->quantity->toBe(10)
        ->cost_centavos->toBe(100000 * 2)
        ->and($variant->refresh()->uncosted_pieces)->toBe(0);
});

test('a sale costs the oldest delivered pieces first, at the price they were ordered at', function () {
    $variant = costedJacket();
    receivedJacketOrder(packs: 2, pricePerPack: 100000); // 10 pcs at ₱200
    receivedJacketOrder(packs: 1, pricePerPack: 125000); // 5 pcs at ₱250

    $first = releasedJackets($variant, 8);
    $second = releasedJackets($variant, 4);

    expect($first->items->sole()->refresh()->cost_centavos)->toBe(8 * 20000)
        ->and($second->items->sole()->refresh()->cost_centavos)->toBe(2 * 20000 + 2 * 25000);
});

test('a release undone and released again keeps its cost', function () {
    $variant = costedJacket();
    receivedJacketOrder(packs: 1, pricePerPack: 100000);
    receivedJacketOrder(packs: 1, pricePerPack: 150000);
    $order = releasedJackets($variant, 3);

    $this->post(route('orders.undo-release', $order))->assertSessionHasNoErrors();
    $this->post(route('orders.release', $order), ['paid' => true])->assertSessionHasNoErrors();

    expect($order->items->sole()->refresh()->cost_centavos)->toBe(3 * 20000);
});

test('an order keeps its normal price, so a sale price shows as a discount', function () {
    $variant = costedJacket();
    receivedJacketOrder(packs: 1, pricePerPack: 100000);
    $variant->product->update(['status' => ProductStatus::OnSale]);

    releasedJackets($variant, 2);

    expect(OrderItem::sole())
        ->unit_price_centavos->toBe(35000)
        ->normal_unit_price_centavos->toBe(40000)
        ->line_total_centavos->toBe(70000)
        ->cost_centavos->toBe(2 * 20000);
});

test('a recount that adds pieces needs their eStore price', function () {
    $variant = costedJacket();
    receivedJacketOrder(packs: 1, pricePerPack: 100000);
    $this->actingAs($this->specialist);

    $this->post(route('products.stock.correct', $variant->product), ['product_variant_id' => $variant->id, 'reason' => 'recount', 'actual_count' => 7])
        ->assertSessionHasErrors(['unit_cost' => 'Enter the eStore price per piece of the 2 pcs you are adding, so every piece has a cost.']);

    $this->post(route('products.stock.correct', $variant->product), ['product_variant_id' => $variant->id, 'reason' => 'recount', 'actual_count' => 7, 'unit_cost' => '210.50'])
        ->assertSessionHasNoErrors();

    expect(StockMovement::query()->latest('id')->first()->cost_centavos)->toBe(2 * 21050);

    // A count that takes pieces out needs no price.
    $this->post(route('products.stock.correct', $variant->product), ['product_variant_id' => $variant->id, 'reason' => 'recount', 'actual_count' => 6])
        ->assertSessionHasNoErrors();
});

test('the sales report shows sales, cost, profit and discounts for the period', function () {
    $variant = costedJacket();
    receivedJacketOrder(packs: 2, pricePerPack: 100000); // ₱200 a piece
    releasedJackets($variant, 2); // 2 × ₱400
    $variant->product->update(['status' => ProductStatus::OnSale]);
    releasedJackets($variant, 3); // 3 × ₱350, ₱50 off each
    $this->actingAs($this->specialist);

    $this->get(route('sales-reports.index'))->assertInertia(fn (Assert $page) => $page
        ->component('sales-reports/index')
        ->where('filters.period', 'month')
        ->where('summary.orders', 2)
        ->where('summary.pieces', 5)
        ->where('summary.sales_centavos', 2 * 40000 + 3 * 35000)
        ->where('summary.cost_centavos', 5 * 20000)
        ->where('summary.profit_centavos', 185000 - 100000)
        ->where('summary.margin_percent', 45.9)
        ->where('summary.discount_centavos', 3 * 5000)
        ->where('summary.on_sale_pieces', 3)
        ->where('products.data.0.product_name', 'STI Jacket')
        ->where('products.data.0.profit_centavos', 85000)
        ->missing('details')
        ->reloadOnly('details', fn (Assert $reload) => $reload->where('details', null))
    );

    $this->get(route('sales-reports.index', ['details' => $variant->id]))->assertInertia(fn (Assert $page) => $page
        ->reloadOnly('details', fn (Assert $reload) => $reload
            ->where('details.releases_count', 2)
            ->where('details.releases.0.on_sale', true)
            ->where('details.releases.0.profit_centavos', 3 * 35000 - 3 * 20000)
            ->where('details.releases.1.on_sale', false)));

    // A day with no releases.
    $this->get(route('sales-reports.index', ['period' => 'custom', 'date_from' => '2026-09-01', 'date_to' => '2026-09-30']))
        ->assertInertia(fn (Assert $page) => $page->where('summary.sales_centavos', 0)->where('summary.margin_percent', null));

    $csv = $this->get(route('sales-reports.export'))->assertDownload('sales-2026-10-01-to-2026-10-09.csv')->streamedContent();
    expect($csv)->toContain('"STI Jacket",,5,1850.00,1000.00,850.00,150.00,3,0');
});

test('only the Specialist sees sales reports and sets eStore prices', function () {
    $variant = costedJacket();

    foreach ([$this->student, User::factory()->schoolAdmin()->create()] as $user) {
        $this->actingAs($user)->get(route('sales-reports.index'))->assertForbidden();
        $this->post(route('sales-reports.price', $variant), ['unit_cost' => '10'])->assertForbidden();
    }
});

test('stock from before deliveries were recorded waits for its price, then its sales are costed', function () {
    $variant = costedJacket();
    $variant->forceFill(['stock_on_hand' => 4])->save();
    StockCost::replay($variant->id);
    expect($variant->refresh()->uncosted_pieces)->toBe(4);

    $order = releasedJackets($variant, 3);
    expect($order->items->sole()->refresh()->cost_centavos)->toBeNull()
        ->and($variant->refresh()->uncosted_pieces)->toBe(1);

    $this->actingAs($this->specialist)->get(route('sales-reports.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('needingPrice.0.variant_id', $variant->id)
            ->where('needingPrice.0.uncosted_pieces', 1)
            ->where('summary.uncosted_lines', 1));

    $this->post(route('sales-reports.price', $variant), ['unit_cost' => ''])
        ->assertSessionHasErrors(['unit_cost' => 'Enter the eStore price per piece, e.g. 250 or 18.50.']);
    $this->post(route('sales-reports.price', $variant), ['unit_cost' => '180'])
        ->assertInertiaFlash('toast.message', 'eStore price of STI Jacket set to ₱180.00 per piece. Its sales were costed again.');

    expect($order->items->sole()->refresh()->cost_centavos)->toBe(3 * 18000)
        ->and($variant->refresh()->uncosted_pieces)->toBe(0);
});
