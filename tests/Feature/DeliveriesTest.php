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
    $order = orderWith(['UTMP02-03' => 10, 'UTMS02-03' => 30], ['order_number' => '30650', 'expected_delivery_date' => now()->toDateString()]);

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
        ->expected_delivery_date->toBeNull()
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

test('setting the expected delivery date saves it and a past date is refused', function () {
    $order = orderWith(['UTMP02-03' => 10], ['order_number' => '30650']);
    $this->actingAs($this->specialist);

    $this->patch(route('purchase-orders.expected-delivery', $order), [
        'expected_delivery_date' => now()->addDays(3)->toDateString(),
        'expected_delivery_note' => 'Sir Ernest called, 2 boxes',
    ])->assertSessionHasNoErrors();

    expect($order->refresh())
        ->expected_delivery_date->toDateString()->toBe(now()->addDays(3)->toDateString())
        ->expected_delivery_note->toBe('Sir Ernest called, 2 boxes');

    $this->patch(route('purchase-orders.expected-delivery', $order), ['expected_delivery_date' => now()->subDay()->toDateString()])
        ->assertSessionHasErrors(['expected_delivery_date' => 'The expected delivery date cannot be in the past.']);

    $this->patch(route('purchase-orders.expected-delivery', $order), ['expected_delivery_date' => ''])
        ->assertSessionHasNoErrors();

    expect($order->refresh()->expected_delivery_date)->toBeNull();
});

test('the specialist is reminded the day before and on the day, once each, from 7 AM', function () {
    orderWith(['UTMP02-03' => 10], ['order_number' => '30650', 'expected_delivery_date' => '2026-10-05']);
    $schoolAdmin = User::factory()->schoolAdmin()->create();

    $this->travelTo(CarbonImmutable::parse('2026-10-04 06:30', 'Asia/Manila'));
    $this->artisan('deliveries:send-reminders')->assertSuccessful();
    expect($this->specialist->notifications()->count())->toBe(0);

    $this->travelTo(CarbonImmutable::parse('2026-10-04 07:00', 'Asia/Manila'));
    $this->artisan('deliveries:send-reminders');
    $this->artisan('deliveries:send-reminders');

    expect($this->specialist->notifications()->count())->toBe(1)
        ->and($this->specialist->notifications()->sole()->data)->toMatchArray([
            'kind' => 'delivery_reminder',
            'order_number' => '30650',
            'when' => 'tomorrow',
            'percent_received' => 0,
            'quantity_remaining' => 10,
        ]);

    $this->travelTo(CarbonImmutable::parse('2026-10-05 07:10', 'Asia/Manila'));
    $this->artisan('deliveries:send-reminders');

    expect($this->specialist->notifications()->count())->toBe(2)
        ->and($this->specialist->notifications()->latest()->first()->data['when'])->toBe('today')
        ->and($schoolAdmin->notifications()->count())->toBe(0);
});

test('a new date for the same order brings new reminders with its current progress', function () {
    $order = orderWith(['UTMP02-03' => 10], ['order_number' => '30650']);
    $this->actingAs($this->specialist);

    $this->travelTo(CarbonImmutable::parse('2026-10-04 09:00', 'Asia/Manila'));
    $this->patch(route('purchase-orders.expected-delivery', $order), ['expected_delivery_date' => '2026-10-05']);

    expect($this->specialist->notifications()->count())->toBe(1);

    $this->post(route('deliveries.store'), [
        'received_on' => '2026-10-04',
        'items' => [['purchase_order_item_id' => itemOf($order, 'UTMP02-03'), 'quantity_received' => 6]],
    ]);
    $this->patch(route('purchase-orders.expected-delivery', $order), ['expected_delivery_date' => '2026-10-05']);

    $reminders = $this->specialist->notifications()->get()->pluck('data')->sortBy('percent_received')->values();

    expect($reminders)->toHaveCount(2)
        ->and($reminders[1])->toMatchArray([
            'when' => 'tomorrow',
            'percent_received' => 60,
            'quantity_remaining' => 4,
        ]);
});

test('an order can be closed short with a reason', function () {
    $order = orderWith(['UTMP02-04' => 10], ['order_number' => '30650', 'expected_delivery_date' => now()->addDay()->toDateString()]);
    $this->actingAs($this->specialist);

    $this->post(route('purchase-orders.close', $order), ['reason' => ''])
        ->assertSessionHasErrors(['reason' => 'Write why this order is being closed.']);

    $this->post(route('purchase-orders.close', $order), ['reason' => 'Head Office said the M/L polos are out of stock.'])
        ->assertSessionHasNoErrors();

    expect($order->refresh())
        ->delivery_status->toBe(DeliveryStatus::CompletedShort)
        ->closed_reason->toBe('Head Office said the M/L polos are out of stock.')
        ->closed_by->toBe($this->specialist->id)
        ->expected_delivery_date->toBeNull();

    $this->post(route('deliveries.store'), [
        'received_on' => now()->toDateString(),
        'items' => [['purchase_order_item_id' => itemOf($order, 'UTMP02-04'), 'quantity_received' => 1]],
    ])->assertSessionHasErrors(['items.0.quantity_received' => 'Order #30650 is already Completed (short).']);

    $this->patch(route('purchase-orders.expected-delivery', $order), ['expected_delivery_date' => now()->addDay()->toDateString()])
        ->assertSessionHasErrors(['expected_delivery_date' => 'Order #30650 is already Completed (short).']);
});

test('the list puts the next expected delivery first and can be filtered by delivery status', function () {
    orderWith(['A-1' => 5], ['order_number' => '30001', 'date_ordered' => '2026-09-30']);
    orderWith(['A-2' => 5], ['order_number' => '30002', 'date_ordered' => '2026-09-01', 'expected_delivery_date' => now()->addDays(5)->toDateString()]);
    orderWith(['A-3' => 5], ['order_number' => '30003', 'date_ordered' => '2026-09-10', 'expected_delivery_date' => now()->addDay()->toDateString()]);
    $partial = orderWith(['A-4' => 5], ['order_number' => '30004']);
    $partial->items()->update(['quantity_delivered' => 2]);
    $partial->refreshDeliveryProgress();

    $this->actingAs($this->specialist)
        ->get(route('purchase-orders.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.sort', 'expected')
            ->where('purchaseOrders.data.0.order_number', '30003')
            ->where('purchaseOrders.data.1.order_number', '30002')
            ->where('purchaseOrders.data.0.delivery_status_label', 'Awaiting Delivery')
        );

    $this->get(route('purchase-orders.index', ['status' => 'partially_received']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('purchaseOrders.data', 1)
            ->where('purchaseOrders.data.0.order_number', '30004')
            ->where('purchaseOrders.data.0.percent_received', 40)
        );

    $this->get(route('purchase-orders.index', ['sort' => 'oldest_waiting']))
        ->assertInertia(fn (Assert $page) => $page->where('purchaseOrders.data.0.order_number', '30002'));
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

test('the school admin can only watch deliveries, not record them', function () {
    $order = orderWith(['UTMP02-03' => 10]);
    $this->actingAs(User::factory()->schoolAdmin()->create());

    $this->get(route('deliveries.index'))->assertForbidden();
    $this->get(route('deliveries.create'))->assertForbidden();
    $this->post(route('deliveries.store'), [])->assertForbidden();
    $this->patch(route('purchase-orders.expected-delivery', $order), [])->assertForbidden();
    $this->post(route('purchase-orders.close', $order), [])->assertForbidden();
    $this->getJson(route('purchase-orders.show', $order))->assertOk()->assertJsonPath('delivery_status', 'awaiting');
});
