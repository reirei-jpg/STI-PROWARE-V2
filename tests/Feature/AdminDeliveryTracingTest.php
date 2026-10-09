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

test('the school admin dashboard traces uploads, deliveries and short closes', function () {
    $awaiting = orderWith(['PRUM01-01' => 20], ['order_number' => '30801', 'date_ordered' => '2026-09-01', 'created_at' => now()->subDays(3)]);
    $partial = orderWith(['PRHD01-01' => 20], ['order_number' => '30802', 'created_at' => now()->subDays(2)]);
    $short = orderWith(['PRJK01-01' => 10], ['order_number' => '30722', 'created_at' => now()->subDays(5)]);

    $this->actingAs($this->specialist);
    $this->travelTo(CarbonImmutable::parse('2026-10-08 09:00', 'Asia/Manila'));
    $this->post(route('deliveries.store'), [
        'received_on' => '2026-10-08',
        'sales_invoice_number' => '1210000031492',
        'items' => [['purchase_order_item_id' => itemOf($partial, 'PRHD01-01'), 'quantity_received' => 12]],
    ])->assertSessionHasNoErrors();
    $this->travelTo(CarbonImmutable::parse('2026-10-08 09:30', 'Asia/Manila'));
    $this->post(route('purchase-orders.close', $short), ['reason' => 'Head Office is out of stock.']);

    $this->actingAs($this->schoolAdmin)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('tasks', null)
            ->where('overview.cards', [
                'awaiting' => 1,
                'partially_received' => 1,
                'partially_percent' => 60,
                'completed' => 1,
                'completed_short' => 1,
                'deliveries_this_week' => 1,
                'recorded_by' => ['Carlo Mendoza'],
            ])
            ->where('overview.purchase_order_activity.0.kind', 'closed_short')
            ->where('overview.purchase_order_activity.0.title', 'Closed short · Order #30722')
            ->where('overview.purchase_order_activity.0.by', 'Carlo Mendoza')
            ->where('overview.purchase_order_activity.1.kind', 'upload')
            ->has('overview.purchase_order_activity', 4)
            ->has('overview.delivery_activity', 1)
            ->where('overview.delivery_activity.0.title', 'Delivery recorded · Order #30802')
            ->where('overview.delivery_activity.0.detail', 'received Oct 8, 2026 · SI # 1210000031492 · Item PRHD01-01 12 of 20')
            ->where('overview.delivery_activity.0.purchase_order_id', $partial->id)
            ->where('overview.follow_up', [
                'days' => 30,
                'count' => 1,
                'orders' => [[
                    'purchase_order_id' => $awaiting->id,
                    'order_number' => '30801',
                    'date_ordered' => '2026-09-01',
                    'days_since_ordered' => 37,
                    'percent_received' => 0,
                ]],
            ])
        );

    expect($short->refresh()->delivery_status)->toBe(DeliveryStatus::CompletedShort);
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
