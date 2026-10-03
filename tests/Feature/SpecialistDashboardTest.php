<?php

use App\Enums\DeliveryStatus;
use App\Enums\OrderStatus;
use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\Order;
use App\Models\Preorder;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\PurchaseOrder;
use App\Models\User;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-03 10:00', 'Asia/Manila'));
    $this->specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
});

test('an empty to-do list is all clear', function () {
    $this->actingAs($this->specialist)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->where('tasks.now', [])
            ->where('tasks.today', [])
            ->where('tasks.week', [])
            ->where('tasks.cash', ['waiting_orders' => 0, 'waiting_centavos' => 0, 'collected_orders' => 0, 'collected_centavos' => 0])
        );
});

test('the to-do list puts each task in its group, most urgent first', function () {
    $student = User::factory()->student()->create(['name' => 'Juan Dela Cruz']);
    $order = Order::factory()->for($student, 'student')->create(['total_centavos' => 27000, 'pick_up_by' => '2026-10-06 23:59:59']);
    Order::factory()->for($student, 'student')->create(['status' => OrderStatus::Ready, 'total_centavos' => 30000, 'pick_up_by' => '2026-10-03 23:59:59']);
    Order::factory()->for($student, 'student')->create(['status' => OrderStatus::PickedUp, 'total_centavos' => 15000, 'picked_up_at' => now()]);

    $lanyard = Product::factory()->create(['name' => 'STI Lanyard', 'status' => ProductStatus::Available, 'low_stock_alert_at' => 5]);
    ProductVariant::factory()->for($lanyard)->create(['stock_on_hand' => 2]);

    PurchaseOrder::factory()->create(['order_number' => '30801', 'delivery_status' => DeliveryStatus::Awaiting, 'expected_delivery_date' => '2026-10-03']);
    PurchaseOrder::factory()->create(['order_number' => '30802', 'delivery_status' => DeliveryStatus::Awaiting, 'expected_delivery_date' => '2026-10-07']);

    $shirt = Product::factory()->create(['name' => 'Anniversary Shirt', 'status' => ProductStatus::Preorder, 'preorders_close_on' => '2026-10-05']);
    Preorder::factory()->for($shirt)->for(ProductVariant::factory()->for($shirt), 'variant')->create(['quantity' => 3, 'status' => PreorderStatus::Active]);

    $this->actingAs($this->specialist)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('tasks.now.0.title', "Prepare {$order->number} · Juan Dela Cruz")
            ->where('tasks.now.0.detail', '0 items · ₱270.00 · pick up by Oct 6')
            ->where('tasks.now.0.action', ['label' => 'Ready for pickup', 'url' => route('orders.ready', $order), 'method' => 'post'])
            ->where('tasks.now.1.title', 'Low stock: STI Lanyard')
            ->where('tasks.today.0.title', 'Delivery expected today: Order #30801')
            ->where('tasks.today.1.title', fn (string $title) => str_starts_with($title, 'Last day to pick up'))
            ->where('tasks.week.0.title', 'Delivery expected Wed, Oct 7: Order #30802')
            ->where('tasks.week.1.title', 'Preorders for Anniversary Shirt close Mon, Oct 5')
            ->where('tasks.week.1.detail', '3 pcs preordered so far. Order them in the eStore after it closes.')
            ->where('tasks.cash', ['waiting_orders' => 1, 'waiting_centavos' => 30000, 'collected_orders' => 1, 'collected_centavos' => 15000])
        );
});

test('a long list shows the first five and how many more', function () {
    Order::factory()->count(7)->create();

    $this->actingAs($this->specialist)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('tasks.now', 6)
            ->where('tasks.now.5.title', 'And 2 more orders to prepare')
            ->where('tasks.now.5.action.url', route('orders.index'))
        );
});

test('the ready for pickup button on the dashboard marks the order ready', function () {
    $order = Order::factory()->create();

    $this->actingAs($this->specialist)
        ->from(route('dashboard'))
        ->post(route('orders.ready', $order))
        ->assertRedirect(route('dashboard'));

    expect($order->refresh()->status)->toBe(OrderStatus::Ready);
});

test('the school admin dashboard has no to-do list', function () {
    $this->actingAs(User::factory()->schoolAdmin()->create())
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->component('dashboard')->where('tasks', null));
});
