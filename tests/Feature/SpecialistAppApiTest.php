<?php

use App\Actions\Deliveries\RecordDelivery;
use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use App\Notifications\OrderCancelled;
use App\Notifications\OrderReady;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-04 10:00', 'Asia/Manila'));
});

/**
 * Juan's order of one ₱700.00 item, from a size with 10 pieces on the shelf;
 * while the order is open, its piece is held.
 */
function juansOrder(OrderStatus $status = OrderStatus::Placed): Order
{
    $variant = ProductVariant::factory()->create(['stock_on_hand' => 10, 'held_pieces' => $status->isOpen() ? 1 : 0]);
    $order = Order::factory()
        ->for(User::factory()->student()->create(['name' => 'Juan Dela Cruz']), 'student')
        ->create(['status' => $status, 'total_centavos' => 70000]);
    OrderItem::factory()->for($order)->for($variant, 'variant')->create(['unit_price_centavos' => 70000, 'line_total_centavos' => 70000]);

    return $order;
}

test('the Specialist signs in on the app and is told apart from a student', function (Closure $makeUser, string $role) {
    $user = $makeUser();

    $this->postJson(route('api.v1.auth.login'), ['email' => $user->email, 'password' => 'Demo@2026!', 'device_name' => 'Phone'])
        ->assertOk()
        ->assertJsonPath('user.role', $role);
})->with([
    'specialist' => [fn () => User::factory()->specialist()->create(['password' => 'Demo@2026!']), 'specialist'],
    'student' => [fn () => User::factory()->student()->create(['password' => 'Demo@2026!']), 'student'],
]);

test('the Specialist\'s screens need the Specialist, and the shop needs a student', function () {
    $this->getJson(route('api.v1.specialist.tasks'))->assertUnauthorized();

    Sanctum::actingAs(User::factory()->student()->create());
    $this->getJson(route('api.v1.specialist.tasks'))->assertForbidden();
    $this->getJson(route('api.v1.specialist.orders.index'))->assertForbidden();

    Sanctum::actingAs(User::factory()->specialist()->create());
    $this->getJson(route('api.v1.cart.index'))->assertForbidden();
    $this->getJson(route('api.v1.notifications.index'))->assertOk();
});

test('the to-do list is the website dashboard\'s, and says which phone screen opens each task', function () {
    $order = juansOrder();
    Sanctum::actingAs(User::factory()->specialist()->create());

    $tasks = $this->getJson(route('api.v1.specialist.tasks'))->assertOk();

    $tasks->assertJsonPath('now.0.title', "Prepare {$order->number} · Juan Dela Cruz")
        ->assertJsonPath('now.0.target', ['screen' => 'order', 'id' => $order->id])
        ->assertJsonPath('cash.waiting_orders', 0);
    expect(array_keys($tasks->json()))->toBe(['now', 'today', 'week', 'cash']);
});

test('the app lists the Specialist\'s orders exactly as the website does', function () {
    juansOrder();
    juansOrder(OrderStatus::Ready);
    $specialist = User::factory()->specialist()->create();

    $website = $this->actingAs($specialist)->get(route('orders.index', ['show' => 'all']))->inertiaProps();
    Sanctum::actingAs($specialist);
    $app = $this->getJson(route('api.v1.specialist.orders.index', ['show' => 'all']))->assertOk()->json();

    expect($app['data'])->toBe($website['orders']['data'])->toHaveCount(2)
        ->and($app['counts'])->toBe($website['counts']);
});

test('the Specialist prepares, releases once paid, and can undo a release the same day on the app', function () {
    Notification::fake();
    $order = juansOrder();
    Sanctum::actingAs(User::factory()->specialist()->create(['name' => 'Carlo Mendoza']));

    $this->postJson(route('api.v1.specialist.orders.ready', $order))
        ->assertOk()
        ->assertJsonPath('message', "Order {$order->number} is ready for pickup. Juan Dela Cruz was notified.")
        ->assertJsonPath('order.status', 'ready')
        ->assertJsonPath('order.handled_by', 'Carlo Mendoza');
    Notification::assertSentTo($order->student, OrderReady::class);

    $variant = $order->items()->sole()->variant;

    $this->postJson(route('api.v1.specialist.orders.release', $order))
        ->assertJsonValidationErrors(['paid' => 'Confirm that the student has paid before releasing the items.']);

    $this->postJson(route('api.v1.specialist.orders.release', $order), ['paid' => true])
        ->assertOk()
        ->assertJsonPath('message', "Order {$order->number} released to Juan Dela Cruz · ₱700.00 paid.")
        ->assertJsonPath('order.status_label', 'Released')
        ->assertJsonPath('order.can_undo_release', true);
    expect($variant->refresh())->stock_on_hand->toBe(9)->held_pieces->toBe(0);

    $this->postJson(route('api.v1.specialist.orders.undo-release', $order))
        ->assertOk()
        ->assertJsonPath('order.status', 'ready');
    expect($variant->refresh())->stock_on_hand->toBe(10)->held_pieces->toBe(1);
});

test('the app refuses a step that no longer fits the order, in words', function () {
    $order = juansOrder(OrderStatus::PickedUp);
    $order->forceFill(['picked_up_at' => now()->subDay()])->save();
    Sanctum::actingAs(User::factory()->specialist()->create());

    $this->postJson(route('api.v1.specialist.orders.ready', $order))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['order' => "Order {$order->number} is Released, so it cannot be marked ready."]);
    $this->postJson(route('api.v1.specialist.orders.release', $order), ['paid' => true])
        ->assertJsonValidationErrors(['order' => "Order {$order->number} is Released, so it cannot be released."]);
    $this->postJson(route('api.v1.specialist.orders.undo-release', $order))
        ->assertJsonValidationErrors(['order' => "Order {$order->number}'s release can only be undone on the day it was released."]);
    $this->postJson(route('api.v1.specialist.orders.cancel', $order), ['reason' => 'Changed mind'])
        ->assertJsonValidationErrors(['order' => "Order {$order->number} is Released, so it cannot be cancelled."]);

    expect($order->refresh()->status)->toBe(OrderStatus::PickedUp);
});

test('cancelling on the app needs a reason, ends the hold and tells the student', function () {
    Notification::fake();
    $order = juansOrder();
    $variant = $order->items()->sole()->variant;
    Sanctum::actingAs(User::factory()->specialist()->create());

    $this->postJson(route('api.v1.specialist.orders.cancel', $order), ['reason' => ''])
        ->assertJsonValidationErrors(['reason' => 'Write why the order is cancelled. The student will see it.']);
    expect($order->refresh()->status)->toBe(OrderStatus::Placed);

    $this->postJson(route('api.v1.specialist.orders.cancel', $order), ['reason' => 'The item was damaged.'])
        ->assertOk()
        ->assertJsonPath('order.status', 'cancelled')
        ->assertJsonPath('order.cancel_reason', 'The item was damaged.');
    expect($variant->refresh())->stock_on_hand->toBe(10)->held_pieces->toBe(0);
    Notification::assertSentTo($order->student, OrderCancelled::class);
});

test('the app shows the same items waiting for delivery and recorded deliveries as the website', function () {
    $order = orderWith(['PRUM01-01' => 10], ['order_number' => '30801']);
    $specialist = User::factory()->specialist()->create();
    app(RecordDelivery::class)->handle($specialist, ['received_on' => '2026-10-04', 'sales_invoice_number' => 'SI-1001'], [itemOf($order, 'PRUM01-01') => 3]);

    $websiteWaiting = $this->actingAs($specialist)->get(route('deliveries.create'))->inertiaProps('groups');
    $websiteRecorded = $this->get(route('deliveries.index'))->inertiaProps('deliveries.data');
    Sanctum::actingAs($specialist);

    expect($this->getJson(route('api.v1.specialist.deliveries.waiting'))->assertOk()->json('groups'))
        ->toBe($websiteWaiting)->toHaveCount(1);
    expect($this->getJson(route('api.v1.specialist.deliveries.index'))->assertOk()->json('data'))
        ->toBe($websiteRecorded)->toHaveCount(1);
});

test('the Specialist records a delivery on the app and the stock and order follow, as on the website', function () {
    $order = orderWith(['PRUM01-01' => 10], ['order_number' => '30801', 'expected_delivery_date' => '2026-10-04']);
    $umbrella = ProductVariant::factory()
        ->for(Product::factory()->create(['name' => 'STI Umbrella']))
        ->create(['estore_item_code' => 'PRUM01-01', 'stock_on_hand' => 0]);
    Sanctum::actingAs(User::factory()->specialist()->create());

    $this->postJson(route('api.v1.specialist.deliveries.store'), [
        'received_on' => '2026-10-04',
        'sales_invoice_number' => 'SI-1001',
        'items' => [['purchase_order_item_id' => itemOf($order, 'PRUM01-01'), 'quantity_received' => 6]],
    ])
        ->assertCreated()
        ->assertJsonPath('type', 'success')
        ->assertJsonPath('message', 'Delivery recorded. Added to stock: STI Umbrella — 6 pcs.');

    expect($umbrella->refresh()->stock_on_hand)->toBe(6)
        ->and($order->refresh()->percentReceived())->toBe(60)
        ->and($order->expected_delivery_date)->toBeNull();
});

test('recording a delivery on the app refuses more than what is left, in the website\'s words', function () {
    $order = orderWith(['PRUM01-01' => 10], ['order_number' => '30801']);
    Sanctum::actingAs(User::factory()->specialist()->create());

    $this->postJson(route('api.v1.specialist.deliveries.store'), [
        'received_on' => '2026-10-04',
        'items' => [['purchase_order_item_id' => itemOf($order, 'PRUM01-01'), 'quantity_received' => 11]],
    ])->assertJsonValidationErrors(['items.0.quantity_received' => 'Only 10 left to receive for Order #30801.']);

    expect($order->refresh()->percentReceived())->toBe(0);
});

test('a delivery expected today opens Record Delivery on the phone', function () {
    orderWith(['PRUM01-01' => 10], ['order_number' => '30801', 'expected_delivery_date' => '2026-10-04']);
    Sanctum::actingAs(User::factory()->specialist()->create());

    $this->getJson(route('api.v1.specialist.tasks'))
        ->assertJsonPath('today.0.title', 'Delivery expected today: Order #30801')
        ->assertJsonPath('today.0.target', ['screen' => 'record_delivery']);
});

test('the stock lookup finds products by name or low stock, and shows the website\'s stock history', function () {
    $ballpen = Product::factory()->create(['name' => 'STI Ballpen', 'status' => ProductStatus::Available, 'low_stock_alert_at' => 5]);
    $variant = ProductVariant::factory()->for($ballpen)->create(['stock_on_hand' => 3]);
    StockMovement::factory()->for($variant, 'variant')->create();
    $umbrella = Product::factory()->create(['name' => 'STI Umbrella', 'status' => ProductStatus::Available, 'low_stock_alert_at' => 5]);
    ProductVariant::factory()->for($umbrella)->create(['stock_on_hand' => 40]);
    $specialist = User::factory()->specialist()->create();

    $website = $this->actingAs($specialist)->get(route('products.stock', $ballpen))->inertiaProps();
    Sanctum::actingAs($specialist);

    $this->getJson(route('api.v1.specialist.stock.index', ['search' => 'umbrella']))
        ->assertJsonPath('data.0.name', 'STI Umbrella')
        ->assertJsonPath('data.0.stock_on_hand', 40)
        ->assertJsonCount(1, 'data');
    $this->getJson(route('api.v1.specialist.stock.index', ['low' => 1]))
        ->assertJsonPath('data.0.name', 'STI Ballpen')
        ->assertJsonPath('data.0.is_low', true)
        ->assertJsonCount(1, 'data');

    $app = $this->getJson(route('api.v1.specialist.stock.show', $ballpen))->assertOk()->json();
    expect($app['product'])->toBe($website['product'])
        ->and($app['variants'])->toBe($website['variants'])
        ->and($app['movements']['data'])->toBe($website['movements']['data'])->toHaveCount(1);
});
