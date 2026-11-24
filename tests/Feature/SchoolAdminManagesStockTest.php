<?php

use App\Enums\ProductStatus;
use App\Enums\StockMovementType;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use App\Notifications\PurchaseOrderClosedShort;
use App\Notifications\PurchaseOrderCompleted;
use Illuminate\Support\Facades\Notification;

/*
 * Panel revision, 24 Nov 2026: the School Admin manages the products and
 * the stock like the Specialist (Scan eStore PO, Stock In, Items to Link,
 * Products, Put on Sale, Correct stock). Orders, preorders, Free Uniforms,
 * Sales Reports and Maintenance stay the Specialist's.
 */

beforeEach(function () {
    $this->specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
    $this->schoolAdmin = User::factory()->schoolAdmin()->create(['name' => 'Liza Garcia']);
});

test('the School Admin opens the stock and product pages', function () {
    $product = Product::factory()->create(['status' => ProductStatus::Available]);
    ProductVariant::factory()->for($product)->create(['stock_on_hand' => 10]);
    $this->actingAs($this->schoolAdmin);

    foreach ([
        route('products.index'),
        route('products.index', ['stock' => 'low']),
        route('products.create'),
        route('products.edit', $product),
        route('products.stock', $product),
        route('purchase-orders.scan'),
        route('deliveries.create'),
        route('item-links.index'),
    ] as $page) {
        $this->get($page)->assertOk();
    }

    $this->getJson(route('products.sale.show', $product))->assertOk();
});

test('the Orders, Preorders, Free Uniforms, Sales Reports and Maintenance pages stay the Specialist\'s', function () {
    $this->actingAs($this->schoolAdmin);

    foreach (['orders.index', 'preorders.index', 'preorder-slips.index', 'free-uniforms.index', 'sales-reports.index', 'maintenance.index'] as $page) {
        $this->get(route($page))->assertForbidden();
    }
});

test('the School Admin corrects stock, recorded under her name', function () {
    $variant = ProductVariant::factory()
        ->for(Product::factory()->create(['status' => ProductStatus::Available, 'low_stock_alert_at' => 5]))
        ->create(['stock_on_hand' => 10]);

    $this->actingAs($this->schoolAdmin)
        ->post(route('products.stock.correct', $variant->product_id), ['product_variant_id' => $variant->id, 'reason' => 'damaged', 'pieces_to_remove' => '6'])
        ->assertSessionHasNoErrors();

    $correction = StockMovement::query()->where('type', StockMovementType::Correction)->sole();

    expect($variant->refresh()->stock_on_hand)->toBe(4)
        ->and($correction->recorded_by)->toBe($this->schoolAdmin->id)
        // The reorder notice still goes to the Specialist only.
        ->and($this->specialist->notifications()->count())->toBe(1)
        ->and($this->schoolAdmin->notifications()->count())->toBe(0);
});

test('a delivery the School Admin records tells the Specialist, not herself', function () {
    Notification::fake();
    $otherAdmin = User::factory()->schoolAdmin()->create();
    $order = orderWith(['PRUM01-01' => 5], ['order_number' => '30801']);

    $this->actingAs($this->schoolAdmin)->post(route('deliveries.store'), [...papers(),
        'received_on' => now()->toDateString(),
        'items' => [['purchase_order_item_id' => itemOf($order, 'PRUM01-01'), 'quantity_received' => 5]],
    ])->assertSessionHasNoErrors();

    Notification::assertSentTo([$this->specialist, $otherAdmin], PurchaseOrderCompleted::class);
    Notification::assertNotSentTo($this->schoolAdmin, PurchaseOrderCompleted::class);
});

test('a delivery the Specialist records tells the School Admin, as before', function () {
    Notification::fake();
    $order = orderWith(['PRUM01-01' => 5]);

    $this->actingAs($this->specialist)->post(route('deliveries.store'), [...papers(),
        'received_on' => now()->toDateString(),
        'items' => [['purchase_order_item_id' => itemOf($order, 'PRUM01-01'), 'quantity_received' => 5]],
    ])->assertSessionHasNoErrors();

    Notification::assertSentTo($this->schoolAdmin, PurchaseOrderCompleted::class);
    Notification::assertNotSentTo($this->specialist, PurchaseOrderCompleted::class);
});

test('an order the School Admin closes short tells the Specialist', function () {
    Notification::fake();
    $order = orderWith(['PRUM01-01' => 5]);

    $this->actingAs($this->schoolAdmin)
        ->post(route('purchase-orders.close', $order), ['reason' => 'Head Office ran out of this item.'])
        ->assertSessionHasNoErrors();

    expect($order->refresh()->closed_by)->toBe($this->schoolAdmin->id);
    Notification::assertSentTo($this->specialist, PurchaseOrderClosedShort::class);
    Notification::assertNotSentTo($this->schoolAdmin, PurchaseOrderClosedShort::class);
});
