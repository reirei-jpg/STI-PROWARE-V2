<?php

use App\Enums\DeliveryStatus;
use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\Preorder;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\PurchaseOrder;
use App\Models\User;
use App\Services\Preorders\PreorderDemand;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Storage::fake('local');
    $this->specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
});

/**
 * A Coming Soon item linked to the eStore code, with $pieces waiting in paid preorders.
 */
function preorderedItem(string $code, int $pieces): ProductVariant
{
    $product = Product::factory()->create(['name' => 'STI Batch 2027 Hoodie', 'status' => ProductStatus::Preorder]);
    $variant = ProductVariant::factory()->for($product)->create(['estore_item_code' => $code]);
    markPreorderPaid(Preorder::factory()->forVariant($variant)->create(['quantity' => $pieces, 'status' => PreorderStatus::Active]));

    return $variant;
}

test('a saved PO keeps how many were ordered for preorders and how many are the Specialist\'s own order', function () {
    $variant = preorderedItem('PRCU01-01', 15);
    // Cancelled preorders are not waiting, and unpaid ones do not count.
    Preorder::factory()->forVariant($variant)->cancelled()->create(['quantity' => 4]);
    Preorder::factory()->forVariant($variant)->create(['quantity' => 6, 'status' => PreorderStatus::Active]);
    $this->actingAs($this->specialist);

    // The default Word file orders 20 of PRCU01-01.
    $this->post(route('purchase-orders.scan.store'), ['document' => estorePoWordUpload()]);
    $this->post(route('purchase-orders.store'))->assertSessionHasNoErrors();

    $purchaseOrder = PurchaseOrder::sole();

    $this->getJson(route('purchase-orders.show', $purchaseOrder))
        ->assertJsonPath('items.0.quantity_ordered', 20)
        ->assertJsonPath('items.0.preorder_quantity', 15)
        ->assertJsonPath('items.0.own_quantity', 5);
});

test('the preorder part is at most what was ordered, and leaves out what an earlier PO on its way covers', function () {
    preorderedItem('PRSH01-01', 30);
    preorderedItem('PRCP01-01', 8);

    $earlier = orderWith(['PRSH01-01' => 10]);
    PreorderDemand::record($earlier);

    $later = orderWith(['PRSH01-01' => 50, 'PRCP01-01' => 5, 'PRXX01-01' => 7]);
    PreorderDemand::record($later);

    expect($earlier->items()->sole()->preorder_quantity)->toBe(10)
        // 30 waiting, 10 already on the earlier PO.
        ->and($later->items()->where('item_code', 'PRSH01-01')->value('preorder_quantity'))->toBe(20)
        // 8 waiting, only 5 ordered.
        ->and($later->items()->where('item_code', 'PRCP01-01')->value('preorder_quantity'))->toBe(5)
        // Not linked to any product: all own order.
        ->and($later->items()->where('item_code', 'PRXX01-01')->value('preorder_quantity'))->toBe(0);
});

test('Purchases counts only what arrived on an order closed short, and shows what did not arrive', function () {
    $short = PurchaseOrder::factory()
        ->withItems([
            ['item_code' => 'PRSH01-01', 'quantity_ordered' => 10, 'quantity_delivered' => 4, 'preorder_quantity' => 6, 'unit_price_centavos' => 1000, 'amount_centavos' => 10000],
            ['item_code' => 'PRCP01-01', 'quantity_ordered' => 5, 'quantity_delivered' => 0, 'preorder_quantity' => 0, 'unit_price_centavos' => 1000, 'amount_centavos' => 5000],
        ])
        ->create(['date_ordered' => '2026-11-12', 'total_amount_centavos' => 15000]);
    // Closed with Rest won't arrive.
    $short->forceFill(['delivery_status' => DeliveryStatus::CompletedShort])->save();
    // Still open: the rest can still arrive, so all of it counts.
    PurchaseOrder::factory()
        ->withItems([['item_code' => 'PRUM01-01', 'quantity_ordered' => 10, 'quantity_delivered' => 2, 'preorder_quantity' => 0, 'unit_price_centavos' => 2000, 'amount_centavos' => 20000]])
        ->create(['date_ordered' => '2026-11-11', 'total_amount_centavos' => 20000, 'delivery_status' => DeliveryStatus::PartiallyReceived]);
    $dates = ['period' => 'custom', 'date_from' => '2026-11-11', 'date_to' => '2026-11-12'];

    $this->actingAs($this->specialist)
        ->get(route('sales-reports.index', ['tab' => 'spent', ...$dates]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('summary.spent_centavos', 4000 + 20000)
            ->where('summary.not_arrived_centavos', 11000)
            ->where('summary.short_orders', 1)
            // Preorders are served first: 4 of the 6 arrived.
            ->where('summary.spent_for_preorders_centavos', 4000)
            ->where('spent.data.0.id', $short->id)
            ->where('spent.data.0.total_centavos', 4000)
            ->where('spent.data.0.ordered_centavos', 15000)
            ->where('spent.data.0.not_arrived_centavos', 11000)
            ->where('spent.data.0.quantity_received', 4)
            ->where('spent.data.1.total_centavos', 20000)
            ->where('spent.data.1.not_arrived_centavos', 0));

    expect($this->get(route('sales-reports.export', $dates))->streamedContent())
        ->toContain("Purchases\n\"Total purchases\",₱240.00\n\"Did not arrive (not counted)\",₱110.00\n");
});

test('Purchases shows the preorder part of each PO, and older POs as not tracked', function () {
    preorderedItem('PRSH01-01', 15);
    $tracked = PurchaseOrder::factory()
        ->withItems([['item_code' => 'PRSH01-01', 'quantity_ordered' => 50, 'unit_price_centavos' => 30000, 'amount_centavos' => 1500000]])
        ->create(['date_ordered' => '2026-11-12', 'total_amount_centavos' => 1500000]);
    PreorderDemand::record($tracked);
    // Saved before preorder demand was kept.
    $older = orderWith(['PRCP01-01' => 5], ['date_ordered' => '2026-11-11']);

    $this->actingAs($this->specialist)
        ->get(route('sales-reports.index', ['tab' => 'spent', 'period' => 'custom', 'date_from' => '2026-11-11', 'date_to' => '2026-11-12']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('summary.spent_for_preorders_centavos', 450000)
            ->where('spent.data.0.id', $tracked->id)
            ->where('spent.data.0.quantity_ordered', 50)
            ->where('spent.data.0.preorder_quantity', 15)
            ->where('spent.data.1.id', $older->id)
            ->where('spent.data.1.preorder_quantity', null));
});
