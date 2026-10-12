<?php

use App\Enums\ProductStatus;
use App\Enums\StockCorrectionReason;
use App\Enums\StockMovementType;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductPack;
use App\Models\ProductVariant;
use App\Models\PurchaseOrder;
use App\Models\Setting;
use App\Models\StockMovement;
use App\Models\UniformSet;
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
    ]])->create(['date_ordered' => now()->toDateString(), 'total_amount_centavos' => $packs * $pricePerPack]);

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

test('the sales report shows what was spent, sold at Cost and Price, the profit and sales on sale', function () {
    $variant = costedJacket();
    receivedJacketOrder(packs: 2, pricePerPack: 100000); // Cost ₱200 a piece
    releasedJackets($variant, 2); // 2 × ₱400
    $variant->product->update(['status' => ProductStatus::OnSale]);
    releasedJackets($variant, 3); // 3 × ₱350 on sale
    $this->actingAs($this->specialist);

    $this->get(route('sales-reports.index'))->assertInertia(fn (Assert $page) => $page
        ->component('sales-reports/index')
        ->where('filters.tab', 'sold')
        ->where('summary.spent_centavos', 200000)
        ->where('summary.purchase_orders', 1)
        ->where('summary.price_centavos', 2 * 40000 + 3 * 35000)
        ->where('summary.cost_centavos', 5 * 20000)
        ->where('summary.profit_centavos', 185000 - 100000)
        ->where('summary.below_cost_lines', 0)
        // One row per price: the sale price is its own row.
        ->where('sold.data.0.price_each_centavos', 35000)
        ->where('sold.data.0.normal_each_centavos', 40000)
        ->where('sold.data.0.cost_each_centavos', 20000)
        ->where('sold.data.0.quantity', 3)
        ->where('sold.data.0.profit_centavos', 3 * 15000)
        ->where('sold.data.1.price_each_centavos', 40000)
        ->where('sold.data.1.normal_each_centavos', null)
        ->where('sold.data.1.profit_centavos', 2 * 20000)
        ->where('spent', null)
    );

    $this->get(route('sales-reports.index', ['tab' => 'spent']))->assertInertia(fn (Assert $page) => $page
        ->where('spent.data.0.total_centavos', 200000)
        ->where('spent.data.0.items_count', 1)
        ->where('sold', null));

    // A period with nothing.
    $this->get(route('sales-reports.index', ['period' => 'custom', 'date_from' => '2026-09-01', 'date_to' => '2026-09-30']))
        ->assertInertia(fn (Assert $page) => $page->where('summary.price_centavos', 0)->where('summary.spent_centavos', 0));

    $csv = $this->get(route('sales-reports.export'))->assertDownload('sales-2026-10-01-to-2026-10-09.csv')->streamedContent();
    expect($csv)->toContain('"STI Jacket",,Piece,3,200.00,350.00,400.00,1050.00,600.00,450.00,');
});

test('an item put on sale below its Cost shows what was lost', function () {
    $variant = costedJacket();
    receivedJacketOrder(packs: 1, pricePerPack: 100000); // Cost ₱200
    $variant->product->update(['status' => ProductStatus::OnSale, 'sale_price_centavos' => 15000]);
    releasedJackets($variant, 2); // 2 × ₱150

    $this->actingAs($this->specialist)->get(route('sales-reports.index'))->assertInertia(fn (Assert $page) => $page
        ->where('summary.below_cost_lines', 1)
        ->where('summary.below_cost_loss_centavos', 2 * 5000)
        ->where('summary.profit_centavos', -10000)
        ->where('sold.data.0.below_cost', true)
        ->where('sold.data.0.loss_centavos', 10000));
});

test('the Selling Price cannot be set below the Cost on the eStore order', function () {
    $variant = costedJacket(); // Head Office sends it by the Pack of 5
    receivedJacketOrder(packs: 1, pricePerPack: 100000); // Cost ₱200 a piece
    $pack = $variant->estorePack;
    $form = fn (string $price, string $packPrice = '') => [
        'name' => 'STI Jacket', 'sold_by_piece' => '1', 'price' => $price, 'status' => 'draft', 'sale_price' => '',
        'low_stock_alert_at' => '0', 'photos' => [], 'options' => [],
        'packs' => [['key' => (string) $pack->id, 'id' => $pack->id, 'name' => 'Pack', 'pieces' => '5', 'sold_to_students' => $packPrice === '' ? '0' : '1', 'price' => $packPrice]],
        'variants' => [['combination' => '', 'estore_item_code' => 'UJKT01-02', 'estore_pack_key' => (string) $pack->id, 'price' => '']],
    ];
    $this->actingAs($this->specialist);

    $this->get(route('products.edit', $variant->product))
        ->assertInertia(fn (Assert $page) => $page->where('costs', ['UJKT01-02' => 100000]));

    $this->put(route('products.update', $variant->product), $form('150'))
        ->assertSessionHasErrors(['price' => 'The Selling Price (₱150.00) is below the Cost on the eStore order (₱200.00 per piece). Check the price from Head Office.']);
    $this->put(route('products.update', $variant->product), $form('400', '900'))
        ->assertSessionHasErrors(['packs.0.price' => 'The Selling Price (₱900.00) is below the Cost on the eStore order (₱1,000.00 per Pack). Check the price from Head Office.']);
    $this->put(route('products.update', $variant->product), $form('200', '1000'))
        ->assertSessionHasNoErrors();
});

test('free uniform sets count in Given free at Cost and at Price, never as a sale', function () {
    $variant = costedJacket();
    receivedJacketOrder(packs: 1, pricePerPack: 100000); // Cost ₱200
    Setting::put(Setting::PROMO_GROUP_SIZE, 2);
    $set = UniformSet::factory()->create(['name' => 'BSIT', 'blouse_product_id' => null, 'polo_product_id' => $variant->product_id, 'pants_product_id' => $variant->product_id]);
    $this->actingAs($this->specialist);

    $this->post(route('free-uniforms.store'), [
        'enrolled_on' => now()->toDateString(),
        'students' => collect(['Student 1' => '2026-01234', 'Juan Dela Cruz' => '2026-01235'])->map(fn (string $form, string $name): array => [
            'name' => $name, 'enrollment_form_number' => $form, 'uniform_set_id' => $set->id,
            'top_kind' => 'polo', 'top_variant_id' => $variant->id, 'pants_variant_id' => $variant->id,
        ])->values()->all(),
    ])->assertSessionHasNoErrors();

    expect($variant->refresh()->stock_on_hand)->toBe(1);

    $this->get(route('sales-reports.index', ['tab' => 'free']))->assertInertia(fn (Assert $page) => $page
        ->where('summary.free_pieces', 4)
        ->where('summary.free_cost_centavos', 4 * 20000)
        ->where('summary.free_price_centavos', 4 * 40000)
        ->where('summary.price_centavos', 0)
        ->where('free.data.0.recipient_name', 'Juan Dela Cruz')
        ->where('free.data.0.enrollment_form_number', '2026-01235')
        ->where('free.data.0.pieces', 1));
});

test('free uniforms are no longer a reason in Correct Stock, but old ones still count in Given free', function () {
    $variant = costedJacket();
    receivedJacketOrder(packs: 1, pricePerPack: 100000);
    StockMovement::factory()->for($variant, 'variant')->create([
        'type' => StockMovementType::Correction, 'reason' => StockCorrectionReason::GivenFree, 'quantity' => -1, 'balance_after' => 4,
        'recipient_name' => 'Juan Dela Cruz', 'enrollment_form_number' => '2026-01234',
    ]);
    $this->actingAs($this->specialist);

    $this->post(route('products.stock.correct', $variant->product), ['product_variant_id' => $variant->id, 'reason' => 'given_free', 'pieces_to_remove' => 1])
        ->assertSessionHasErrors(['reason' => 'Choose one of the reasons. Free uniforms are recorded on the Free Uniforms page.']);
    $this->get(route('products.stock', $variant->product))
        ->assertInertia(fn (Assert $page) => $page->where('reasons', fn ($reasons) => ! collect($reasons)->contains('value', 'given_free')));
    $this->get(route('sales-reports.index', ['tab' => 'free']))
        ->assertInertia(fn (Assert $page) => $page->where('summary.free_pieces', 1)->where('free.data.0.recipient_name', 'Juan Dela Cruz'));
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
            ->where('sold.data.0.cost_each_centavos', null)
            ->where('sold.data.0.missing_cost_lines', 1)
            ->where('summary.missing_cost_lines', 1));

    $this->post(route('sales-reports.price', $variant), ['unit_cost' => ''])
        ->assertSessionHasErrors(['unit_cost' => 'Enter the Cost per piece, e.g. 250 or 18.50.']);
    $this->post(route('sales-reports.price', $variant), ['unit_cost' => '180'])
        ->assertInertiaFlash('toast.message', 'Cost of STI Jacket set to ₱180.00 per piece. Its sales were worked out again.');

    expect($order->items->sole()->refresh()->cost_centavos)->toBe(3 * 18000)
        ->and($variant->refresh()->uncosted_pieces)->toBe(0);
});
