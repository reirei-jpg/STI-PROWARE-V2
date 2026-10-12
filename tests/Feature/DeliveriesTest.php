<?php

use App\Enums\DeliveryStatus;
use App\Models\Delivery;
use App\Models\User;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
});

test('recording part of an order marks it partially received', function () {
    $order = orderWith(['UTMP02-03' => 10, 'UTMS02-03' => 30], ['order_number' => '30650']);

    $this->actingAs($this->specialist)
        ->post(route('deliveries.store'), [
            'received_on' => now()->toDateString(),
            'sales_invoice_number' => '1210000031492',
            'delivery_receipt_number' => '',
            'items' => [
                ['purchase_order_item_id' => itemOf($order, 'UTMP02-03'), 'quantity_received' => 10],
                ['purchase_order_item_id' => itemOf($order, 'UTMS02-03'), 'quantity_received' => 20],
            ],
        ])
        ->assertRedirect(route('deliveries.index'))
        ->assertSessionHasNoErrors();

    $order->refresh();

    expect($order)
        ->delivery_status->toBe(DeliveryStatus::PartiallyReceived)
        ->quantity_ordered_total->toBe(40)
        ->quantity_received_total->toBe(30)
        ->and($order->percentReceived())->toBe(75)
        ->and($order->items()->pluck('quantity_delivered', 'item_code')->all())->toBe(['UTMP02-03' => 10, 'UTMS02-03' => 20])
        ->and(Delivery::sole())
        ->sales_invoice_number->toBe('1210000031492')
        ->delivery_receipt_number->toBeNull()
        ->recorded_by->toBe($this->specialist->id);
});

test('one delivery can cover several orders, and a fully received order is completed', function () {
    $older = orderWith(['UTMP02-03' => 10], ['order_number' => '30650']);
    $newer = orderWith(['UTMP02-03' => 10], ['order_number' => '30722']);

    $this->actingAs($this->specialist)->post(route('deliveries.store'), [
        'received_on' => now()->toDateString(),
        'items' => [
            ['purchase_order_item_id' => itemOf($older, 'UTMP02-03'), 'quantity_received' => 10],
            ['purchase_order_item_id' => itemOf($newer, 'UTMP02-03'), 'quantity_received' => 4],
        ],
    ])->assertSessionHasNoErrors();

    expect($older->refresh()->delivery_status)->toBe(DeliveryStatus::Completed)
        ->and($newer->refresh()->delivery_status)->toBe(DeliveryStatus::PartiallyReceived)
        ->and(Delivery::sole()->items)->toHaveCount(2);
});

test('receiving more than what is left of an item is refused', function () {
    $order = orderWith(['UTMP02-03' => 10], ['order_number' => '30650']);
    $order->items()->update(['quantity_delivered' => 4]);
    $order->refreshDeliveryProgress();

    $this->actingAs($this->specialist)
        ->post(route('deliveries.store'), [
            'received_on' => now()->toDateString(),
            'items' => [['purchase_order_item_id' => itemOf($order, 'UTMP02-03'), 'quantity_received' => 7]],
        ])
        ->assertSessionHasErrors(['items.0.quantity_received' => 'Only 6 left to receive for Order #30650.']);

    expect(Delivery::count())->toBe(0);
});

test('the delivery form explains what is wrong', function (array $payload, string $field, string $message) {
    $order = orderWith(['UTMP02-03' => 10]);

    $this->actingAs($this->specialist)
        ->post(route('deliveries.store'), array_merge([
            'received_on' => now()->toDateString(),
            'items' => [['purchase_order_item_id' => itemOf($order, 'UTMP02-03'), 'quantity_received' => 5]],
        ], $payload))
        ->assertSessionHasErrors([$field => $message]);
})->with([
    'a date in the future' => [['received_on' => '2099-01-01'], 'received_on', 'The date received cannot be in the future.'],
    'no date' => [['received_on' => ''], 'received_on', 'Choose the date the delivery arrived.'],
]);

test('a delivery with nothing received is refused', function () {
    $order = orderWith(['UTMP02-03' => 10]);

    $this->actingAs($this->specialist)
        ->post(route('deliveries.store'), [
            'received_on' => now()->toDateString(),
            'items' => [['purchase_order_item_id' => itemOf($order, 'UTMP02-03'), 'quantity_received' => 0]],
        ])
        ->assertSessionHasErrors(['items' => 'Enter how many arrived for at least one item.']);
});

test('the record delivery form lists waiting items by item code, oldest order first', function () {
    orderWith(['UTMP02-03' => 10, 'UTMS02-03' => 5], ['order_number' => '30722', 'date_ordered' => '2026-09-29']);
    orderWith(['UTMP02-03' => 10], ['order_number' => '30650', 'date_ordered' => '2026-09-17']);
    $closed = orderWith(['UTMCL02-03' => 5], ['order_number' => '30600']);
    $closed->forceFill(['closed_at' => now(), 'closed_reason' => 'Out of stock at Head Office'])->save();
    $closed->refreshDeliveryProgress();
    $done = orderWith(['UTMBL02-03' => 5], ['order_number' => '30601']);
    $done->items()->update(['quantity_delivered' => 5]);
    $done->refreshDeliveryProgress();

    $this->actingAs($this->specialist)
        ->get(route('deliveries.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('deliveries/create')
            ->has('groups', 2)
            ->where('groups.0.item_code', 'UTMP02-03')
            ->where('groups.0.rows.0.order_number', '30650')
            ->where('groups.0.rows.1.order_number', '30722')
            ->where('groups.0.rows.1.quantity_remaining', 10)
            ->where('groups.1.item_code', 'UTMS02-03')
        );
});

test('an order not complete after the follow-up days is shown to follow up with Head Office', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-29 09:00', 'Asia/Manila'));
    $due = orderWith(['UTMP02-03' => 10], ['order_number' => '30722', 'date_ordered' => '2026-09-29']);
    orderWith(['UTMS02-03' => 10], ['order_number' => '30801', 'date_ordered' => '2026-10-03']);
    $arrived = orderWith(['UTMS04-01' => 5], ['order_number' => '30650', 'date_ordered' => '2026-09-01']);
    $arrived->items()->update(['quantity_delivered' => 5]);
    $arrived->refreshDeliveryProgress();

    $this->actingAs($this->specialist)->get(route('deliveries.index'))->assertInertia(fn (Assert $page) => $page
        ->where('summary.follow_up', 1)
        ->where('summary.follow_up_days', 30)
        ->where('summary.waiting', 2));

    $this->get(route('deliveries.index', ['show' => 'follow_up']))->assertInertia(fn (Assert $page) => $page
        ->has('waitingOrders.data', 1)
        ->where('waitingOrders.data.0.id', $due->id)
        ->where('waitingOrders.data.0.days_since_ordered', 30));

    $this->travelTo(CarbonImmutable::parse('2026-10-28 09:00', 'Asia/Manila'));
    $this->get(route('deliveries.index'))->assertInertia(fn (Assert $page) => $page->where('summary.follow_up', 0));
});

test('the Specialist chooses after how many days orders are followed up', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-14 09:00', 'Asia/Manila'));
    orderWith(['UTMP02-03' => 10], ['order_number' => '30722', 'date_ordered' => '2026-09-29']);
    $this->actingAs($this->specialist);

    $this->patch(route('maintenance.follow-up-days'), ['follow_up_days' => 10])
        ->assertSessionHasErrors(['follow_up_days' => 'Choose 14, 21, 30, 45, 60 days.']);

    $this->patch(route('maintenance.follow-up-days'), ['follow_up_days' => 14])->assertSessionHasNoErrors();

    $this->get(route('maintenance.index'))->assertInertia(fn (Assert $page) => $page
        ->where('followUpDays.value', 14)
        ->where('followUpDays.changed_by', 'Carlo Mendoza'));
    $this->get(route('deliveries.index'))->assertInertia(fn (Assert $page) => $page
        ->where('summary.follow_up', 1)
        ->where('summary.follow_up_days', 14));

    $this->actingAs(User::factory()->schoolAdmin()->create())
        ->patch(route('maintenance.follow-up-days'), ['follow_up_days' => 30])
        ->assertForbidden();
});

test('an order can be closed short with a reason', function () {
    $order = orderWith(['UTMP02-04' => 10], ['order_number' => '30650']);
    $this->actingAs($this->specialist);

    $this->post(route('purchase-orders.close', $order), ['reason' => ''])
        ->assertSessionHasErrors(['reason' => 'Write why this order is being closed.']);

    $this->post(route('purchase-orders.close', $order), ['reason' => 'Head Office said the M/L polos are out of stock.'])
        ->assertSessionHasNoErrors();

    expect($order->refresh())
        ->delivery_status->toBe(DeliveryStatus::CompletedShort)
        ->closed_reason->toBe('Head Office said the M/L polos are out of stock.')
        ->closed_by->toBe($this->specialist->id);

    $this->post(route('deliveries.store'), [
        'received_on' => now()->toDateString(),
        'items' => [['purchase_order_item_id' => itemOf($order, 'UTMP02-04'), 'quantity_received' => 1]],
    ])->assertSessionHasErrors(['items.0.quantity_received' => 'Order #30650 is already Completed (short).']);
});

test('the list puts orders still waiting first, the oldest at the top, and can be filtered by delivery status', function () {
    $done = orderWith(['A-1' => 5], ['order_number' => '30001', 'date_ordered' => '2026-08-15']);
    $done->items()->update(['quantity_delivered' => 5]);
    $done->refreshDeliveryProgress();
    orderWith(['A-2' => 5], ['order_number' => '30002', 'date_ordered' => '2026-09-10']);
    orderWith(['A-3' => 5], ['order_number' => '30003', 'date_ordered' => '2026-09-01']);
    $partial = orderWith(['A-4' => 5], ['order_number' => '30004', 'date_ordered' => '2026-09-20']);
    $partial->items()->update(['quantity_delivered' => 2]);
    $partial->refreshDeliveryProgress();

    $this->actingAs($this->specialist)
        ->get(route('purchase-orders.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.sort', 'oldest_waiting')
            ->where('purchaseOrders.data.0.order_number', '30003')
            ->where('purchaseOrders.data.1.order_number', '30002')
            ->where('purchaseOrders.data.2.order_number', '30004')
            ->where('purchaseOrders.data.3.order_number', '30001')
            ->where('purchaseOrders.data.0.delivery_status_label', 'Awaiting Delivery')
        );

    $this->get(route('purchase-orders.index', ['status' => 'partially_received']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('purchaseOrders.data', 1)
            ->where('purchaseOrders.data.0.order_number', '30004')
            ->where('purchaseOrders.data.0.percent_received', 40)
        );

    $this->get(route('purchase-orders.index', ['sort' => 'newest']))
        ->assertInertia(fn (Assert $page) => $page->where('purchaseOrders.data.0.order_number', '30004'));
});

test('the details window shows what arrived, what is left and the delivery history', function () {
    $order = orderWith(['UTMP02-03' => 10], ['order_number' => '30650']);
    $this->actingAs($this->specialist)->post(route('deliveries.store'), [
        'received_on' => now()->toDateString(),
        'sales_invoice_number' => '1210000031492',
        'items' => [['purchase_order_item_id' => itemOf($order, 'UTMP02-03'), 'quantity_received' => 6]],
    ]);

    $this->getJson(route('purchase-orders.show', $order))
        ->assertOk()
        ->assertJsonPath('delivery_status', 'partially_received')
        ->assertJsonPath('percent_received', 60)
        ->assertJsonPath('items.0.quantity_received', 6)
        ->assertJsonPath('items.0.quantity_remaining', 4)
        ->assertJsonPath('deliveries.0.sales_invoice_number', '1210000031492')
        ->assertJsonPath('deliveries.0.recorded_by', 'Carlo Mendoza')
        ->assertJsonPath('deliveries.0.items.0.quantity_received', 6);
});

test('deliveries can be searched by SI # or Order #', function () {
    $order = orderWith(['UTMP02-03' => 10], ['order_number' => '30650']);
    $other = orderWith(['UTMS02-03' => 10], ['order_number' => '30722']);
    $this->actingAs($this->specialist);

    $this->post(route('deliveries.store'), [
        'received_on' => now()->toDateString(),
        'sales_invoice_number' => '1210000031492',
        'items' => [['purchase_order_item_id' => itemOf($order, 'UTMP02-03'), 'quantity_received' => 1]],
    ]);
    $this->post(route('deliveries.store'), [
        'received_on' => now()->toDateString(),
        'sales_invoice_number' => '1210000039999',
        'items' => [['purchase_order_item_id' => itemOf($other, 'UTMS02-03'), 'quantity_received' => 1]],
    ]);

    $this->get(route('deliveries.index', ['search' => '31492']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('deliveries.data', 1)
            ->where('deliveries.data.0.order_numbers', ['30650'])
        );

    $this->get(route('deliveries.index', ['search' => '#30722']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('deliveries.data', 1)
            ->where('deliveries.data.0.sales_invoice_number', '1210000039999')
        );
});

test('the deliveries page shows what arrived, what is still to come, and a delivery\'s details', function () {
    $older = orderWith(['UTMP02-03' => 10], ['order_number' => '30650', 'date_ordered' => now()->subDays(40)->toDateString()]);
    $newer = orderWith(['UTMS02-03' => 10], ['order_number' => '30722', 'date_ordered' => now()->subDays(3)->toDateString()]);
    $arrived = orderWith(['UTMS04-01' => 5], ['order_number' => '30801']);
    $this->actingAs($this->specialist);

    $this->post(route('deliveries.store'), [
        'received_on' => now()->toDateString(),
        'sales_invoice_number' => '1210000031492',
        'items' => [['purchase_order_item_id' => itemOf($arrived, 'UTMS04-01'), 'quantity_received' => 5]],
    ])->assertSessionHasNoErrors();
    $delivery = Delivery::sole();

    $this->get(route('deliveries.index'))->assertInertia(fn (Assert $page) => $page
        ->where('filters.show', 'received')
        ->where('deliveries.data.0.first_item.item_code', 'UTMS04-01')
        ->where('deliveries.data.0.first_item.product', null)
        ->where('deliveries.data.0.items_count', 1)
        ->where('waitingOrders', null)
        ->where('summary.follow_up', 1)
        ->where('summary.waiting', 2)
        ->where('summary.this_month.deliveries', 1)
        ->where('summary.not_in_stock', 1)
    );

    $this->get(route('deliveries.index', ['show' => 'waiting']))->assertInertia(fn (Assert $page) => $page
        ->where('deliveries', null)
        ->where('waitingOrders.data.0.id', $older->id)
        ->where('waitingOrders.data.0.days_since_ordered', 40)
        ->where('waitingOrders.data.1.id', $newer->id)
        ->where('waitingOrders.data.1.quantity_remaining', 10)
        ->has('waitingOrders.data', 2)
    );
    $this->get(route('deliveries.index', ['show' => 'follow_up']))->assertInertia(fn (Assert $page) => $page
        ->has('waitingOrders.data', 1)
        ->where('waitingOrders.data.0.order_number', '30650'));

    $this->get(route('deliveries.index', ['details' => $delivery->id]))->assertInertia(fn (Assert $page) => $page
        ->missing('details')
        ->reloadOnly('details', fn (Assert $reload) => $reload
            ->where('details.sales_invoice_number', '1210000031492')
            ->where('details.items.0.quantity_received', 5)
            ->where('details.items.0.product', null)
            ->where('details.orders.0.order_number', '30801')
            ->where('details.orders.0.delivery_status', 'completed')));
});

test('the school admin can only watch deliveries, not record them', function () {
    $order = orderWith(['UTMP02-03' => 10]);
    $this->actingAs(User::factory()->schoolAdmin()->create());

    $this->get(route('deliveries.index'))->assertOk();
    $this->get(route('deliveries.create'))->assertForbidden();
    $this->post(route('deliveries.store'), [])->assertForbidden();
    $this->post(route('purchase-orders.close', $order), [])->assertForbidden();
    $this->getJson(route('purchase-orders.show', $order))->assertOk()->assertJsonPath('delivery_status', 'awaiting');
});
