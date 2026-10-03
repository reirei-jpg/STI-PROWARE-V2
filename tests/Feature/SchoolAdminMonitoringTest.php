<?php

use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\User;
use App\Notifications\PurchaseOrderUploaded;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

test('a school admin can see the uploaded purchase orders and their details', function () {
    $purchaseOrder = PurchaseOrder::factory()->has(PurchaseOrderItem::factory(), 'items')->create();
    $this->actingAs(User::factory()->schoolAdmin()->create());

    $this->get(route('purchase-orders.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('purchase-orders/index')
            ->has('purchaseOrders.data', 1)
            ->where('purchaseOrders.data.0.id', $purchaseOrder->id)
        );

    $this->getJson(route('purchase-orders.show', $purchaseOrder))
        ->assertOk()
        ->assertJsonPath('id', $purchaseOrder->id)
        ->assertJsonCount(1, 'items');
});

test('a school admin can look at student orders, products and stock, but not change them', function () {
    $product = Product::factory()->create(['name' => 'STI Lanyard', 'status' => ProductStatus::Available]);
    $variant = ProductVariant::factory()->for($product)->create(['stock_on_hand' => 10]);
    $order = Order::factory()->create();
    $this->actingAs(User::factory()->schoolAdmin()->create());

    $this->get(route('orders.index', ['show' => 'all']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('orders/index')->where('orders.data.0.number', $order->number));
    $this->get(route('products.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('products/index')->where('products.data.0.name', 'STI Lanyard'));
    $this->get(route('products.stock', $product))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('products/stock')->where('variants.0.stock_on_hand', 10));

    $this->post(route('orders.ready', $order))->assertForbidden();
    $this->post(route('orders.picked-up', $order))->assertForbidden();
    $this->get(route('products.edit', $product))->assertForbidden();
    $this->post(route('products.sale.store', $product), ['sale_price' => '50', 'days' => '7'])->assertForbidden();
    $this->post(route('products.stock.correct', $product), ['product_variant_id' => $variant->id, 'reason' => 'recount', 'actual_count' => '1'])->assertForbidden();

    expect($order->refresh()->status)->toBe(OrderStatus::Placed)
        ->and($variant->refresh()->stock_on_hand)->toBe(10);
});

test('saving a purchase order notifies every school admin and nobody else', function () {
    Storage::fake('local');
    Notification::fake();

    $specialist = User::factory()->specialist()->create();
    $schoolAdmins = User::factory()->schoolAdmin()->count(2)->create();

    $this->actingAs($specialist);
    $this->post(route('purchase-orders.scan.store'), ['document' => estorePoWordUpload()]);
    $this->post(route('purchase-orders.store'))->assertSessionHasNoErrors();

    $purchaseOrder = PurchaseOrder::sole();

    Notification::assertSentTo(
        $schoolAdmins,
        PurchaseOrderUploaded::class,
        fn (PurchaseOrderUploaded $notification): bool => $notification->purchaseOrder->is($purchaseOrder),
    );
    Notification::assertNotSentTo($specialist, PurchaseOrderUploaded::class);
});

test('the notification tells the school admin who uploaded what', function () {
    $specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
    $purchaseOrder = PurchaseOrder::factory()
        ->for($specialist, 'uploader')
        ->has(PurchaseOrderItem::factory()->count(2), 'items')
        ->create(['order_number' => '30722', 'date_ordered' => '2026-09-29', 'total_amount_centavos' => 42000]);
    $schoolAdmin = User::factory()->schoolAdmin()->create();

    $schoolAdmin->notify(new PurchaseOrderUploaded($purchaseOrder));

    $this->actingAs($schoolAdmin)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('notifications.unread_count', 1)
            ->has('notifications.recent', 1)
            ->where('notifications.recent.0.read', false)
            ->where('notifications.recent.0.data', [
                'kind' => 'purchase_order_uploaded',
                'purchase_order_id' => $purchaseOrder->id,
                'order_number' => '30722',
                'uploaded_by' => 'Carlo Mendoza',
                'date_ordered' => '2026-09-29',
                'total_amount_centavos' => 42000,
                'items_count' => 2,
            ])
        );
});

test('the specialist has a notification bell for delivery reminders, but is not told about her own uploads', function () {
    $specialist = User::factory()->specialist()->create();

    $this->actingAs($specialist);
    $this->post(route('purchase-orders.scan.store'), ['document' => estorePoWordUpload()]);
    $this->post(route('purchase-orders.store'))->assertSessionHasNoErrors();

    $this->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('notifications.unread_count', 0)
            ->has('notifications.recent', 0)
        );
});

test('opening a notification marks it read and shows that order', function () {
    $purchaseOrder = PurchaseOrder::factory()->create();
    $schoolAdmin = User::factory()->schoolAdmin()->create();
    $schoolAdmin->notify(new PurchaseOrderUploaded($purchaseOrder));
    $notification = $schoolAdmin->notifications()->sole();

    $this->actingAs($schoolAdmin)
        ->post(route('notifications.open', $notification->id))
        ->assertRedirect(route('purchase-orders.index', ['view' => $purchaseOrder->id]));

    expect($notification->fresh()->read_at)->not->toBeNull();

    $this->get(route('purchase-orders.index', ['view' => $purchaseOrder->id]))
        ->assertInertia(fn (Assert $page) => $page->where('openPurchaseOrderId', $purchaseOrder->id));
});

test('a school admin cannot open another user\'s notification', function () {
    $purchaseOrder = PurchaseOrder::factory()->create();
    $otherAdmin = User::factory()->schoolAdmin()->create();
    $otherAdmin->notify(new PurchaseOrderUploaded($purchaseOrder));

    $this->actingAs(User::factory()->schoolAdmin()->create())
        ->post(route('notifications.open', $otherAdmin->notifications()->sole()->id))
        ->assertNotFound();

    expect($otherAdmin->unreadNotifications()->count())->toBe(1);
});

test('mark all read clears the unread count', function () {
    $schoolAdmin = User::factory()->schoolAdmin()->create();
    $schoolAdmin->notify(new PurchaseOrderUploaded(PurchaseOrder::factory()->create()));
    $schoolAdmin->notify(new PurchaseOrderUploaded(PurchaseOrder::factory()->create()));

    $this->actingAs($schoolAdmin)
        ->from(route('dashboard'))
        ->post(route('notifications.read-all'))
        ->assertRedirect(route('dashboard'));

    expect($schoolAdmin->unreadNotifications()->count())->toBe(0);
});

test('the specialist can mark her own notifications as read', function () {
    $specialist = User::factory()->specialist()->create();
    $specialist->notify(new PurchaseOrderUploaded(PurchaseOrder::factory()->create()));

    $this->actingAs($specialist)
        ->post(route('notifications.read-all'))
        ->assertRedirect();

    expect($specialist->unreadNotifications()->count())->toBe(0);
});
