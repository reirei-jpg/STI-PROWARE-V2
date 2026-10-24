<?php

use App\Enums\DeliveryStatus;
use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Enums\StockMovementType;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\PurchaseOrder;
use App\Models\StockMovement;
use App\Models\User;
use App\Notifications\Channels\PushChannel;
use App\Notifications\DeliveryRecorded;
use App\Notifications\PurchaseOrderClosedShort;
use App\Notifications\PurchaseOrderCompleted;
use App\Notifications\PurchaseOrderLate;
use App\Notifications\PurchaseOrderReminder;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-08 10:00', 'Asia/Manila'));
    $this->specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
    $this->schoolAdmin = User::factory()->schoolAdmin()->create(['name' => 'Liza Garcia']);
});

test('the school admin is told when a delivery completes an order, not about every delivery', function () {
    Notification::fake();
    $order = orderWith(['PRUM01-01' => 20, 'PRHD01-01' => 20], ['order_number' => '30801', 'date_ordered' => '2026-10-05']);

    $this->actingAs($this->specialist)->post(route('deliveries.store'), [
        'received_on' => '2026-10-08',
        'items' => [
            ['purchase_order_item_id' => itemOf($order, 'PRUM01-01'), 'quantity_received' => 20],
            ['purchase_order_item_id' => itemOf($order, 'PRHD01-01'), 'quantity_received' => 12],
        ],
    ])->assertSessionHasNoErrors();

    Notification::assertNothingSent();

    $this->post(route('deliveries.store'), [
        'received_on' => '2026-10-08',
        'items' => [['purchase_order_item_id' => itemOf($order, 'PRHD01-01'), 'quantity_received' => 8]],
    ])->assertSessionHasNoErrors();

    Notification::assertSentTo($this->schoolAdmin, PurchaseOrderCompleted::class, fn (PurchaseOrderCompleted $notice) => $notice->toArray($this->schoolAdmin) === [
        'kind' => 'purchase_order_completed',
        'purchase_order_id' => $order->id,
        'order_number' => '30801',
        'date_ordered' => '2026-10-05',
        'completed_at' => now()->toIso8601String(),
        'completed_after_days' => 3,
        'quantity_received' => 40,
        'recorded_by' => 'Carlo Mendoza',
    ]);
    Notification::assertNotSentTo($this->specialist, PurchaseOrderCompleted::class);
    Notification::assertNotSentTo($this->schoolAdmin, DeliveryRecorded::class);
});

test('the school admin is told once when an order is not complete after the follow-up days', function () {
    Notification::fake();
    $late = orderWith(['PRUM01-01' => 20], ['order_number' => '30801', 'date_ordered' => '2026-09-08']);
    orderWith(['PRHD01-01' => 20], ['order_number' => '30802', 'date_ordered' => '2026-09-09']);
    $this->actingAs($this->specialist)->post(route('deliveries.store'), [
        'received_on' => '2026-10-08',
        'items' => [['purchase_order_item_id' => itemOf($late, 'PRUM01-01'), 'quantity_received' => 5]],
    ]);

    $this->artisan('purchase-orders:notify-late')->assertSuccessful();
    $this->artisan('purchase-orders:notify-late')->assertSuccessful();

    Notification::assertSentToTimes($this->schoolAdmin, PurchaseOrderLate::class, 1);
    Notification::assertSentTo($this->schoolAdmin, PurchaseOrderLate::class, fn (PurchaseOrderLate $notice) => $notice->toArray($this->schoolAdmin) === [
        'kind' => 'purchase_order_late',
        'purchase_order_id' => $late->id,
        'order_number' => '30801',
        'date_ordered' => '2026-09-08',
        'days_since_ordered' => 30,
        'late_days' => 30,
        'quantity_received' => 5,
        'quantity_ordered' => 20,
        'percent_received' => 25,
    ]);
    Notification::assertNotSentTo($this->specialist, PurchaseOrderLate::class);
    expect($late->refresh()->late_notified_at)->not->toBeNull();
});

test('the school admin is told when an order is closed short, with the reason', function () {
    Notification::fake();
    $order = orderWith(['PRUM01-01' => 20], ['order_number' => '30722']);

    $this->actingAs($this->specialist)
        ->post(route('purchase-orders.close', $order), ['reason' => 'Head Office is out of stock.'])
        ->assertSessionHasNoErrors();

    Notification::assertSentTo($this->schoolAdmin, PurchaseOrderClosedShort::class, fn (PurchaseOrderClosedShort $notice) => $notice->toArray($this->schoolAdmin) === [
        'kind' => 'purchase_order_closed_short',
        'purchase_order_id' => $order->id,
        'order_number' => '30722',
        'reason' => 'Head Office is out of stock.',
        'closed_by' => 'Carlo Mendoza',
        'percent_received' => 0,
    ]);
});

test('opening an order completed notice opens that purchase order', function () {
    $order = orderWith(['PRUM01-01' => 20]);
    $this->actingAs($this->specialist)->post(route('deliveries.store'), [
        'received_on' => '2026-10-08',
        'items' => [['purchase_order_item_id' => itemOf($order, 'PRUM01-01'), 'quantity_received' => 20]],
    ]);

    $this->actingAs($this->schoolAdmin)
        ->post(route('notifications.open', $this->schoolAdmin->notifications()->sole()->id))
        ->assertRedirect(route('purchase-orders.index', ['view' => $order->id]));
});

test('the school admin dashboard shows the orders in Coming, Ongoing and Completed, with the date and time of each step', function () {
    orderWith(['PRUM01-01' => 20], ['order_number' => '30801', 'date_ordered' => '2026-09-01', 'created_at' => '2026-09-02 08:15']);
    $ongoing = orderWith(['PRHD01-01' => 20], ['order_number' => '30802', 'date_ordered' => '2026-10-05']);
    $complete = orderWith(['PRCP01-01' => 10], ['order_number' => '30803', 'date_ordered' => '2026-10-06']);
    $short = orderWith(['PRJK01-01' => 10], ['order_number' => '30722', 'date_ordered' => '2026-10-01']);

    $this->actingAs($this->specialist);
    $this->travelTo(CarbonImmutable::parse('2026-10-08 09:00', 'Asia/Manila'));
    $this->post(route('deliveries.store'), [
        'received_on' => '2026-10-08',
        'items' => [
            ['purchase_order_item_id' => itemOf($ongoing, 'PRHD01-01'), 'quantity_received' => 12],
            ['purchase_order_item_id' => itemOf($complete, 'PRCP01-01'), 'quantity_received' => 10],
        ],
    ])->assertSessionHasNoErrors();
    $this->travelTo(CarbonImmutable::parse('2026-10-08 09:30', 'Asia/Manila'));
    $this->post(route('purchase-orders.close', $short), ['reason' => 'Head Office is out of stock.']);

    $this->actingAs($this->schoolAdmin);
    $this->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('tasks', null)
            ->where('overview.deliveries.tab', 'ongoing')
            ->where('overview.deliveries.late_days', 30)
            ->where('overview.deliveries.counts', ['coming' => 1, 'ongoing' => 1, 'completed' => 2, 'coming_late' => 1, 'ongoing_late' => 0])
            ->has('overview.deliveries.orders.data', 1)
            ->where('overview.deliveries.orders.data.0.order_number', '30802')
            ->where('overview.deliveries.orders.data.0.status', 'partially_received')
            ->where('overview.deliveries.orders.data.0.percent_received', 60)
            ->where('overview.deliveries.orders.data.0.last_delivery_at', CarbonImmutable::parse('2026-10-08 09:00', 'Asia/Manila')->toIso8601String())
            ->where('overview.deliveries.orders.data.0.completed_at', null)
            ->where('overview.deliveries.orders.data.0.is_late', false)
        );

    $this->get(route('dashboard', ['tab' => 'coming']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('overview.deliveries.orders.data.0.order_number', '30801')
            ->where('overview.deliveries.orders.data.0.days_since_ordered', 37)
            ->where('overview.deliveries.orders.data.0.uploaded_at', CarbonImmutable::parse('2026-09-02 08:15', 'Asia/Manila')->toIso8601String())
            ->where('overview.deliveries.orders.data.0.last_delivery_at', null)
            ->where('overview.deliveries.orders.data.0.is_late', true)
        );

    // The most recently completed first: the short close (9:30) before the full delivery (9:00).
    $this->get(route('dashboard', ['tab' => 'completed']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('overview.deliveries.orders.data.0.order_number', '30722')
            ->where('overview.deliveries.orders.data.0.status_label', 'Completed (some missing)')
            ->where('overview.deliveries.orders.data.0.completed_at', CarbonImmutable::parse('2026-10-08 09:30', 'Asia/Manila')->toIso8601String())
            ->where('overview.deliveries.orders.data.1.order_number', '30803')
            ->where('overview.deliveries.orders.data.1.completed_at', CarbonImmutable::parse('2026-10-08 09:00', 'Asia/Manila')->toIso8601String())
            ->where('overview.deliveries.orders.data.1.completed_after_days', 2)
        );

    expect($short->refresh()->delivery_status)->toBe(DeliveryStatus::CompletedShort);
});

test('the school admin dashboard shows 5 orders a page', function () {
    foreach (range(1, 6) as $number) {
        orderWith(['PRUM01-01' => 20], ['order_number' => "3080{$number}", 'date_ordered' => "2026-10-0{$number}"]);
    }

    $this->actingAs($this->schoolAdmin);
    $this->get(route('dashboard', ['tab' => 'coming']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('overview.deliveries.orders.data', 5)
            ->where('overview.deliveries.orders.data.0.order_number', '30801')
            ->where('overview.deliveries.orders.last_page', 2)
        );
    $this->get(route('dashboard', ['tab' => 'coming', 'page' => 2]))
        ->assertInertia(fn (Assert $page) => $page
            ->has('overview.deliveries.orders.data', 1)
            ->where('overview.deliveries.orders.data.0.order_number', '30806')
        );
});

test('the school admin searches by Order #, and the tab counts show which tab it is in', function () {
    orderWith(['PRUM01-01' => 20], ['order_number' => '30801']);
    $partial = orderWith(['PRHD01-01' => 20], ['order_number' => '30802']);
    orderWith(['PRJK01-01' => 20], ['order_number' => '30912']);
    $this->actingAs($this->specialist)->post(route('deliveries.store'), [
        'received_on' => '2026-10-08',
        'items' => [['purchase_order_item_id' => itemOf($partial, 'PRHD01-01'), 'quantity_received' => 5]],
    ]);

    $this->actingAs($this->schoolAdmin);
    $this->get(route('dashboard', ['tab' => 'coming', 'search' => '#3080']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('overview.deliveries.search', '3080')
            ->where('overview.deliveries.counts', ['coming' => 1, 'ongoing' => 1, 'completed' => 0, 'coming_late' => 0, 'ongoing_late' => 0])
            ->has('overview.deliveries.orders.data', 1)
            ->where('overview.deliveries.orders.data.0.order_number', '30801')
        );

    $this->get(route('dashboard', ['tab' => 'coming', 'search' => '30802']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('overview.deliveries.orders.data', 0)
            ->where('overview.deliveries.counts.ongoing', 1)
        );

    $this->get(route('dashboard', ['search' => str_repeat('9', 41)]))->assertSessionHasErrors('search');
});

test('an order\'s details give the date and time of each delivery and of its completion', function () {
    $order = orderWith(['PRUM01-01' => 20, 'PRHD01-01' => 10], ['order_number' => '30801', 'date_ordered' => '2026-10-05']);
    $short = orderWith(['PRJK01-01' => 10], ['order_number' => '30722', 'date_ordered' => '2026-10-01']);
    $this->actingAs($this->specialist);

    $this->travelTo(CarbonImmutable::parse('2026-10-08 09:00', 'Asia/Manila'));
    $this->post(route('deliveries.store'), [
        'received_on' => '2026-10-08',
        'items' => [['purchase_order_item_id' => itemOf($order, 'PRUM01-01'), 'quantity_received' => 20]],
    ])->assertSessionHasNoErrors();

    $this->actingAs($this->schoolAdmin)
        ->getJson(route('purchase-orders.show', $order))
        ->assertJsonPath('deliveries.0.recorded_at', CarbonImmutable::parse('2026-10-08 09:00', 'Asia/Manila')->toIso8601String())
        ->assertJsonPath('last_delivery_at', CarbonImmutable::parse('2026-10-08 09:00', 'Asia/Manila')->toIso8601String())
        ->assertJsonPath('completed_at', null);

    $this->travelTo(CarbonImmutable::parse('2026-10-09 14:30', 'Asia/Manila'));
    $this->actingAs($this->specialist)->post(route('deliveries.store'), [
        'received_on' => '2026-10-09',
        'items' => [['purchase_order_item_id' => itemOf($order, 'PRHD01-01'), 'quantity_received' => 10]],
    ])->assertSessionHasNoErrors();
    $this->post(route('purchase-orders.close', $short), ['reason' => 'Head Office is out of stock.']);

    $this->actingAs($this->schoolAdmin)
        ->getJson(route('purchase-orders.show', $order))
        ->assertJsonPath('delivery_status', 'completed')
        ->assertJsonPath('completed_at', CarbonImmutable::parse('2026-10-09 14:30', 'Asia/Manila')->toIso8601String())
        ->assertJsonPath('completed_after_days', 4);
    $this->getJson(route('purchase-orders.show', $short))
        ->assertJsonPath('completed_at', CarbonImmutable::parse('2026-10-09 14:30', 'Asia/Manila')->toIso8601String())
        ->assertJsonPath('last_delivery_at', null);
});

test('the school admin reminds the Specialist about a late order, then waits a week', function () {
    Notification::fake();
    $late = orderWith(['PRUM01-01' => 20], ['order_number' => '30801', 'date_ordered' => '2026-09-01', 'uploaded_by' => $this->specialist->id]);
    $this->actingAs($this->schoolAdmin);

    $this->get(route('dashboard', ['tab' => 'coming']))->assertInertia(fn (Assert $page) => $page
        ->where('overview.deliveries.orders.data.0.can_remind', true));

    $this->from(route('dashboard'))
        ->post(route('purchase-orders.remind-specialist', $late))
        ->assertRedirect(route('dashboard'))
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.message', 'The reminder has been sent to Carlo Mendoza.');

    Notification::assertSentTo($this->specialist, PurchaseOrderReminder::class, fn (PurchaseOrderReminder $notice) => $notice->toArray($this->specialist) === [
        'kind' => 'purchase_order_reminder',
        'purchase_order_id' => $late->id,
        'order_number' => '30801',
        'date_ordered' => '2026-09-01',
        'days_since_ordered' => 37,
        'late_days' => 30,
        'quantity_remaining' => 20,
        'quantity_ordered' => 20,
        'reminded_by' => 'Liza Garcia',
    ] && $notice->via($this->specialist) === ['database', PushChannel::class]);
    Notification::assertNotSentTo($this->schoolAdmin, PurchaseOrderReminder::class);

    $this->get(route('dashboard', ['tab' => 'coming']))->assertInertia(fn (Assert $page) => $page
        ->where('overview.deliveries.orders.data.0.can_remind', false)
        ->where('overview.deliveries.orders.data.0.reminded_by', 'Liza Garcia')
        ->where('overview.deliveries.orders.data.0.remind_again_on', '2026-10-15'));

    $this->from(route('dashboard'))
        ->post(route('purchase-orders.remind-specialist', $late))
        ->assertSessionHasErrors(['reminder' => 'The Specialist was already reminded about Order #30801. The next reminder can be sent on Oct 15, 2026.']);
    Notification::assertSentToTimes($this->specialist, PurchaseOrderReminder::class, 1);

    $this->travelTo(CarbonImmutable::parse('2026-10-15 08:00', 'Asia/Manila'));
    $this->post(route('purchase-orders.remind-specialist', $late))->assertSessionHasNoErrors();
    Notification::assertSentToTimes($this->specialist, PurchaseOrderReminder::class, 2);
});

test('only a late order can be reminded about, and only by the school admin', function () {
    $recent = orderWith(['PRUM01-01' => 20], ['order_number' => '30802', 'date_ordered' => '2026-10-01']);
    $late = orderWith(['PRHD01-01' => 20], ['order_number' => '30801', 'date_ordered' => '2026-09-01']);

    $this->actingAs($this->schoolAdmin)
        ->post(route('purchase-orders.remind-specialist', $recent))
        ->assertSessionHasErrors(['reminder' => 'Order #30802 is not late, so there is nothing to remind the Specialist about.']);
    $this->actingAs($this->specialist)
        ->post(route('purchase-orders.remind-specialist', $late))
        ->assertForbidden();

    expect($recent->refresh()->specialist_reminded_at)->toBeNull()
        ->and($late->refresh()->specialist_reminded_at)->toBeNull();
});

test('opening a reminder notice opens that purchase order for the Specialist', function () {
    $late = orderWith(['PRHD01-01' => 20], ['order_number' => '30801', 'date_ordered' => '2026-09-01']);
    $this->actingAs($this->schoolAdmin)->post(route('purchase-orders.remind-specialist', $late));

    $this->actingAs($this->specialist)
        ->post(route('notifications.open', $this->specialist->notifications()->sole()->id))
        ->assertRedirect(route('purchase-orders.index', ['view' => $late->id]));
});

test('the school admin sees the top sellers of the week, month or year and what is not selling', function () {
    $polo = ProductVariant::factory()->for(Product::factory()->create(['name' => 'BSIT Polo', 'status' => ProductStatus::Available]))->create(['stock_on_hand' => 7]);
    $cap = ProductVariant::factory()->for(Product::factory()->create(['name' => 'STI Cap', 'status' => ProductStatus::Available]))->create(['stock_on_hand' => 4]);
    $umbrella = ProductVariant::factory()->for(Product::factory()->create(['name' => 'STI Umbrella', 'status' => ProductStatus::Available]))->create(['stock_on_hand' => 10]);

    foreach ([$polo, $cap, $umbrella] as $variant) {
        StockMovement::factory()->for($variant, 'variant')->create(['type' => StockMovementType::Delivery, 'created_at' => '2026-09-01 09:00']);
    }

    // Released this week (Tue Oct 6): 3 polos; earlier this month (Fri Oct 2): 5 caps.
    $sold = function (ProductVariant $variant, int $pieces, string $releasedAt): void {
        $item = OrderItem::factory()
            ->for(Order::factory()->create(['status' => OrderStatus::PickedUp, 'picked_up_at' => $releasedAt]))
            ->create(['product_variant_id' => $variant->id, 'product_name' => $variant->product->name, 'quantity' => $pieces, 'line_total_centavos' => $pieces * 55000]);
        StockMovement::factory()->for($variant, 'variant')->create(['type' => StockMovementType::Sale, 'quantity' => -$pieces, 'order_item_id' => $item->id, 'created_at' => $releasedAt]);
    };
    $sold($polo, 3, '2026-10-06 10:00');
    $sold($cap, 5, '2026-10-02 10:00');

    $this->actingAs($this->schoolAdmin);
    $this->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page
        ->where('overview.sales.period', 'month')
        ->where('overview.sales.top_sellers.data.0.product_name', 'STI Cap')
        ->where('overview.sales.top_sellers.data.0.pieces', 5)
        ->where('overview.sales.top_sellers.data.1.product_name', 'BSIT Polo')
        ->where('overview.sales.slow_days', 18)
        ->has('overview.sales.not_selling.data', 1)
        ->where('overview.sales.not_selling.data.0.product_name', 'STI Umbrella')
        ->where('overview.sales.not_selling.data.0.stock_pieces', 10)
        ->where('overview.sales.not_selling.data.0.last_sold_at', null)
        ->where('overview.sales.not_selling.data.0.days_without_sale', 37));

    $this->get(route('dashboard', ['period' => 'week']))->assertInertia(fn (Assert $page) => $page
        ->where('overview.sales.from', '2026-10-05')
        ->has('overview.sales.top_sellers.data', 1)
        ->where('overview.sales.top_sellers.data.0.product_name', 'BSIT Polo'));

    $this->get(route('dashboard', ['period' => 'decade']))->assertSessionHasErrors('period');
});

test('the top sellers show 5 products a page', function () {
    foreach (range(1, 6) as $number) {
        $variant = ProductVariant::factory()->for(Product::factory()->create(['name' => "Item {$number}"]))->create();
        OrderItem::factory()
            ->for(Order::factory()->create(['status' => OrderStatus::PickedUp, 'picked_up_at' => '2026-10-06 10:00']))
            ->create(['product_variant_id' => $variant->id, 'product_name' => "Item {$number}", 'quantity' => 10 - $number]);
    }

    $this->actingAs($this->schoolAdmin);
    $this->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page
        ->has('overview.sales.top_sellers.data', 5)
        ->where('overview.sales.top_sellers.last_page', 2));
    $this->get(route('dashboard', ['top_page' => 2]))->assertInertia(fn (Assert $page) => $page
        ->where('overview.sales.top_sellers.data.0.rank', 6)
        ->where('overview.sales.top_sellers.data.0.product_name', 'Item 6'));
});

test('the school admin sees every delivery, but cannot record one', function () {
    $order = orderWith(['PRUM01-01' => 20], ['order_number' => '30801']);
    $this->actingAs($this->specialist)->post(route('deliveries.store'), [
        'received_on' => '2026-10-08',
        'items' => [['purchase_order_item_id' => itemOf($order, 'PRUM01-01'), 'quantity_received' => 5]],
    ]);

    $this->actingAs($this->schoolAdmin)
        ->get(route('deliveries.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('deliveries.data.0.recorded_by', 'Carlo Mendoza')
            ->where('deliveries.data.0.orders', [['id' => $order->id, 'order_number' => '30801']])
        );

    $this->get(route('deliveries.create'))->assertForbidden();
    expect(PurchaseOrder::sole()->quantity_received_total)->toBe(5);
});
