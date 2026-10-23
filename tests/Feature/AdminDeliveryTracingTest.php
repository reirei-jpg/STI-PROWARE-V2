<?php

use App\Enums\DeliveryStatus;
use App\Models\Delivery;
use App\Models\PurchaseOrder;
use App\Models\User;
use App\Notifications\DeliveryRecorded;
use App\Notifications\PurchaseOrderClosedShort;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-08 10:00', 'Asia/Manila'));
    $this->specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
    $this->schoolAdmin = User::factory()->schoolAdmin()->create(['name' => 'Liza Garcia']);
});

test('the school admin is told about every delivery recorded, and nobody else is', function () {
    Notification::fake();
    $order = orderWith(['PRUM01-01' => 20, 'PRHD01-01' => 20], ['order_number' => '30801']);

    $this->actingAs($this->specialist)->post(route('deliveries.store'), [
        'received_on' => '2026-10-08',
        'sales_invoice_number' => '1210000031492',
        'delivery_receipt_number' => 'DR-778',
        'items' => [
            ['purchase_order_item_id' => itemOf($order, 'PRUM01-01'), 'quantity_received' => 20],
            ['purchase_order_item_id' => itemOf($order, 'PRHD01-01'), 'quantity_received' => 12],
        ],
    ])->assertSessionHasNoErrors();

    Notification::assertSentTo($this->schoolAdmin, DeliveryRecorded::class, fn (DeliveryRecorded $notice) => $notice->toArray($this->schoolAdmin) === [
        'kind' => 'delivery_recorded',
        'delivery_id' => Delivery::sole()->id,
        'purchase_order_id' => $order->id,
        'order_numbers' => ['30801'],
        'received_on' => '2026-10-08',
        'sales_invoice_number' => '1210000031492',
        'delivery_receipt_number' => 'DR-778',
        'recorded_by' => 'Carlo Mendoza',
        'items_count' => 2,
        'quantity_received' => 32,
    ]);
    Notification::assertNotSentTo($this->specialist, DeliveryRecorded::class);
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

test('opening a delivery notice opens that purchase order', function () {
    $order = orderWith(['PRUM01-01' => 20]);
    $this->actingAs($this->specialist)->post(route('deliveries.store'), [
        'received_on' => '2026-10-08',
        'items' => [['purchase_order_item_id' => itemOf($order, 'PRUM01-01'), 'quantity_received' => 5]],
    ]);

    $this->actingAs($this->schoolAdmin)
        ->post(route('notifications.open', $this->schoolAdmin->notifications()->sole()->id))
        ->assertRedirect(route('purchase-orders.index', ['view' => $order->id]));
});

test('the school admin dashboard shows the orders in Coming, Ongoing and Completed, with the date and time of each step', function () {
    $coming = orderWith(['PRUM01-01' => 20], ['order_number' => '30801', 'date_ordered' => '2026-09-01', 'created_at' => '2026-09-02 08:15']);
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
