<?php

use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->actingAs(User::factory()->specialist()->create());
});

/**
 * One saved order per given Date Ordered, keyed by that date.
 *
 * @param  list<string>  $dates
 * @return array<string, PurchaseOrder>
 */
function ordersDated(array $dates): array
{
    $orders = [];

    foreach ($dates as $date) {
        $orders[$date] = PurchaseOrder::factory()->create(['date_ordered' => $date]);
    }

    return $orders;
}

test('the Date Ordered filter keeps only orders in the range, including both end dates', function (?string $from, ?string $to, array $expectedDates) {
    ordersDated(['2026-08-31', '2026-09-01', '2026-09-15', '2026-09-30', '2026-10-01']);

    $this->get(route('purchase-orders.index', array_filter(['sort' => 'newest', 'date_from' => $from, 'date_to' => $to])))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters', ['search' => null, 'category' => null, 'status' => null, 'sort' => 'newest', 'date_from' => $from, 'date_to' => $to])
            ->where('purchaseOrders.data', fn ($rows) => collect($rows)->pluck('date_ordered')->all() === $expectedDates)
        );
})->with([
    'from and to' => ['2026-09-01', '2026-09-30', ['2026-09-30', '2026-09-15', '2026-09-01']],
    'from only' => ['2026-09-30', null, ['2026-10-01', '2026-09-30']],
    'to only' => [null, '2026-09-01', ['2026-09-01', '2026-08-31']],
    'one day' => ['2026-09-15', '2026-09-15', ['2026-09-15']],
]);

test('the summary cards follow the Date Ordered filter', function () {
    $september = PurchaseOrder::factory()->create(['date_ordered' => '2026-09-10', 'total_amount_centavos' => 42000]);
    PurchaseOrderItem::factory()->for($september)->create(['quantity_ordered' => 20]);
    $october = PurchaseOrder::factory()->create(['date_ordered' => '2026-10-02', 'total_amount_centavos' => 21000]);
    PurchaseOrderItem::factory()->for($october)->create(['quantity_ordered' => 10]);

    $this->get(route('purchase-orders.index', ['date_from' => '2026-09-01', 'date_to' => '2026-09-30']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('summary.orders_count', 1)
            ->where('summary.total_qty_ordered', 20)
            ->where('summary.total_amount_centavos', 42000)
        );
});

test('the page links keep the chosen dates', function () {
    PurchaseOrder::factory()->count(21)->create(['date_ordered' => '2026-09-15']);

    $this->get(route('purchase-orders.index', ['date_from' => '2026-09-01', 'date_to' => '2026-09-30']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('purchaseOrders.data', 20)
            ->where('purchaseOrders.next_page_url', fn (string $url) => str_contains($url, 'date_from=2026-09-01') && str_contains($url, 'date_to=2026-09-30'))
        );
});

test('the list can be searched by Order #', function (string $search) {
    PurchaseOrder::factory()->create(['order_number' => '30722']);
    PurchaseOrder::factory()->create(['order_number' => '30720']);
    PurchaseOrder::factory()->create(['order_number' => '41115']);

    $this->get(route('purchase-orders.index', ['search' => $search]))
        ->assertInertia(fn (Assert $page) => $page
            ->has('purchaseOrders.data', 1)
            ->where('purchaseOrders.data.0.order_number', '30722')
            ->where('summary.orders_count', 1)
            ->where('filters.search', '30722')
        );
})->with(['30722', '#30722', ' 30722 ']);

test('part of an Order # finds every order that contains it', function () {
    PurchaseOrder::factory()->create(['order_number' => '30722']);
    PurchaseOrder::factory()->create(['order_number' => '30720']);
    PurchaseOrder::factory()->create(['order_number' => '41115']);

    $this->get(route('purchase-orders.index', ['search' => '3072']))
        ->assertInertia(fn (Assert $page) => $page->has('purchaseOrders.data', 2));
});

test('the list can be filtered by the categories that were uploaded', function () {
    PurchaseOrder::factory()->create(['order_number' => '30722', 'category' => 'SMS']);
    PurchaseOrder::factory()->create(['order_number' => '30701', 'category' => 'PROWARE']);
    PurchaseOrder::factory()->create(['order_number' => '30650', 'category' => 'TERTIARY UNIFORM']);

    $this->get(route('purchase-orders.index', ['category' => 'SMS']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('categories', ['PROWARE', 'SMS', 'TERTIARY UNIFORM'])
            ->has('purchaseOrders.data', 1)
            ->where('purchaseOrders.data.0.order_number', '30722')
            ->where('filters.category', 'SMS')
        );
});

test('a To date before the From date is refused', function () {
    $this->from(route('purchase-orders.index'))
        ->get(route('purchase-orders.index', ['date_from' => '2026-09-30', 'date_to' => '2026-09-01']))
        ->assertRedirect(route('purchase-orders.index'))
        ->assertSessionHasErrors(['date_to' => 'The "To" date cannot be before the "From" date.']);
});

test('a date that is not a real date is refused', function () {
    $this->from(route('purchase-orders.index'))
        ->get(route('purchase-orders.index', ['date_from' => 'yesterday']))
        ->assertSessionHasErrors(['date_from' => 'Choose a valid "From" date.']);
});
