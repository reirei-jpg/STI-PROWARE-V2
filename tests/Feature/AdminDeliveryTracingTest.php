<?php

use App\Enums\DeliveryStatus;
use App\Models\PurchaseOrder;
use App\Models\User;
use App\Notifications\DeliveryRecorded;
use App\Notifications\PurchaseOrderClosedShort;
use App\Notifications\PurchaseOrderCompleted;
use App\Notifications\PurchaseOrderLate;
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
