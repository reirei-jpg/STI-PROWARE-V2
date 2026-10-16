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
            ->missing('tasks.cash')
        );
});

test('the to-do list puts each task in its group, most urgent first', function () {
    $student = User::factory()->student()->create(['name' => 'Juan Dela Cruz']);
    $order = Order::factory()->for($student, 'student')->create(['total_centavos' => 27000, 'pick_up_by' => '2026-10-06 23:59:59']);
    Order::factory()->for($student, 'student')->create(['status' => OrderStatus::Ready, 'total_centavos' => 30000, 'pick_up_by' => '2026-10-03 23:59:59']);
    Order::factory()->for($student, 'student')->create(['status' => OrderStatus::PickedUp, 'total_centavos' => 15000, 'picked_up_at' => now()]);

    $lanyard = Product::factory()->create(['name' => 'STI Lanyard', 'status' => ProductStatus::Available, 'low_stock_alert_at' => 5]);
    ProductVariant::factory()->for($lanyard)->create(['stock_on_hand' => 2]);

    PurchaseOrder::factory()->create(['order_number' => '30801', 'delivery_status' => DeliveryStatus::Awaiting, 'date_ordered' => '2026-08-20']);
    PurchaseOrder::factory()->create(['order_number' => '30802', 'delivery_status' => DeliveryStatus::Awaiting, 'date_ordered' => '2026-09-25']);

    $shirt = Product::factory()->create(['name' => 'Anniversary Shirt', 'status' => ProductStatus::Preorder, 'preorders_close_on' => '2026-10-05']);
    Preorder::factory()->for($shirt)->for(ProductVariant::factory()->for($shirt), 'variant')->create(['quantity' => 3, 'status' => PreorderStatus::Active]);

    $this->actingAs($this->specialist)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('tasks.now.0.title', "Prepare {$order->number} · Juan Dela Cruz")
            ->where('tasks.now.0.detail', '0 items · ₱270.00 · pick up by Oct 6')
            ->where('tasks.now.0.action', ['label' => 'Ready for pickup', 'url' => route('orders.ready', $order), 'method' => 'post'])
            ->where('tasks.now.1.title', 'Low stock: STI Lanyard')
            ->where('tasks.today.0.title', 'Not complete after 30 days: Order #30801')
            ->where('tasks.today.0.detail', 'Ordered Aug 20 (44 days ago) · 0% received. Ask Head Office about the rest.')
            ->where('tasks.today.1.title', fn (string $title) => str_starts_with($title, 'Last day to pick up'))
            ->where('tasks.week.0.title', 'Preorders for Anniversary Shirt close Mon, Oct 5')
            ->where('tasks.week.0.detail', '3 pcs preordered so far. Order them in the eStore after it closes.')
        );
});

test('low stock is one row per product, naming its variants', function () {
    $umbrella = Product::factory()->create(['name' => 'STI Umbrella', 'status' => ProductStatus::Available, 'low_stock_alert_at' => 5]);
    foreach (['Black' => 4, 'White' => 0, 'Red' => 0, 'Gray' => 0, 'Green' => 0, 'Navy Blue' => 20] as $color => $stock) {
        ProductVariant::factory()->for($umbrella)->create([
            'combination' => "Color: {$color}",
            'choices' => [['option' => 'Color', 'choice' => $color]],
            'stock_on_hand' => $stock,
            'position' => $umbrella->variants()->count(),
        ]);
    }

    $this->actingAs($this->specialist)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('tasks.now', 1)
            ->where('tasks.now.0.title', 'Low stock: STI Umbrella')
            ->where('tasks.now.0.detail', 'White, Red, Gray and 1 more out of stock · Black 4 pcs left. Order more in the eStore.')
        );
});

test('a long list shows the first five and how many more', function () {
    Order::factory()->count(7)->create();

    $this->actingAs($this->specialist)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('tasks.now', 6)
            ->where('tasks.now.5.title', 'And 2 more orders to prepare')
            ->where('tasks.now.5.hidden', 2)
            ->where('tasks.now.5.action.url', route('orders.index'))
            ->where('tasks.now.0.hidden', 0)
        );
});

test('preorders closing this week show the preordered products first, and how many more', function () {
    foreach (['Notebook' => 0, 'Tote Bag' => 0, 'Jersey' => 0, 'Lanyard' => 0, 'Pin Set' => 0, 'Mug' => 4, 'Cap' => 1] as $name => $pieces) {
        $product = Product::factory()->create(['name' => $name, 'status' => ProductStatus::Preorder, 'preorders_close_on' => '2026-10-05']);

        if ($pieces > 0) {
            Preorder::factory()->for($product)->for(ProductVariant::factory()->for($product), 'variant')->create(['quantity' => $pieces, 'status' => PreorderStatus::Active]);
        }
    }

    $this->actingAs($this->specialist)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('tasks.week', 6)
            ->where('tasks.week.0.title', 'Preorders for Mug close Mon, Oct 5')
            ->where('tasks.week.0.detail', '4 pcs preordered so far. Order them in the eStore after it closes.')
            ->where('tasks.week.1.title', 'Preorders for Cap close Mon, Oct 5')
            ->where('tasks.week.2.detail', 'No preorders yet. Change the close date if you need more time.')
            ->where('tasks.week.5.title', 'And 2 more preorder products closing this week')
            ->where('tasks.week.5.hidden', 2)
            ->where('tasks.week.5.action.url', route('preorders.index', ['stage' => 'open']))
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
