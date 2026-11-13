<?php

use App\Enums\DeliveryStatus;
use App\Http\Middleware\HandleInertiaRequests;
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

test('by default the list goes Awaiting, Partially Received, Completed, then Completed (some missing), oldest first in each', function () {
    $order = fn (string $number, string $date, DeliveryStatus $status) => PurchaseOrder::factory()->create(['order_number' => $number, 'date_ordered' => $date, 'delivery_status' => $status]);
    $order('008', '2026-10-08', DeliveryStatus::PartiallyReceived);
    $order('003', '2026-10-03', DeliveryStatus::Completed);
    $order('007', '2026-10-07', DeliveryStatus::PartiallyReceived);
    $order('009', '2026-10-09', DeliveryStatus::Awaiting);
    $order('001', '2026-10-01', DeliveryStatus::CompletedShort);
    $order('005', '2026-10-05', DeliveryStatus::Awaiting);
    $order('002', '2026-10-02', DeliveryStatus::Completed);

    $this->get(route('purchase-orders.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('purchaseOrders.data', fn ($rows) => collect($rows)->pluck('order_number')->all() === ['005', '009', '007', '008', '002', '003', '001'])
        );
});

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

test('Total QTY Ordered opens the items of the listed orders added up per item, the most ordered first', function () {
    $first = PurchaseOrder::factory()->create(['date_ordered' => '2026-11-12']);
    PurchaseOrderItem::factory()->for($first)->create(['item_code' => 'MTT01-001', 'description' => 'STI Thermal Tumbler', 'quantity_ordered' => 10, 'quantity_delivered' => 4, 'preorder_quantity' => 2]);
    PurchaseOrderItem::factory()->for($first)->create(['item_code' => 'MLY01-001', 'description' => 'STI Lanyard', 'quantity_ordered' => 5, 'preorder_quantity' => 0]);
    $second = PurchaseOrder::factory()->create(['date_ordered' => '2026-11-13']);
    PurchaseOrderItem::factory()->for($second)->create(['item_code' => 'MTT01-001', 'description' => 'STI Thermal Tumbler', 'quantity_ordered' => 6, 'preorder_quantity' => 3]);
    // Saved before preorders were tracked.
    PurchaseOrderItem::factory()->for($second)->create(['item_code' => 'PRCU01-01', 'description' => 'Chibi Keychain', 'quantity_ordered' => 3, 'preorder_quantity' => null]);
    // Outside the chosen dates.
    PurchaseOrderItem::factory()->for(PurchaseOrder::factory()->create(['date_ordered' => '2026-10-01']))->create(['item_code' => 'MTT01-001', 'quantity_ordered' => 50]);

    $this->get(route('purchase-orders.index', ['date_from' => '2026-11-12', 'date_to' => '2026-11-13']))
        ->assertInertia(fn (Assert $page) => $page
            ->missing('itemsOrdered')
            ->reloadOnly('itemsOrdered', fn (Assert $reload) => $reload
                ->has('itemsOrdered', 3)
                ->where('itemsOrdered.0', [
                    'item_code' => 'MTT01-001', 'description' => 'STI Thermal Tumbler', 'orders_count' => 2,
                    'quantity_ordered' => 16, 'preorder_quantity' => 5, 'own_quantity' => 11, 'partly_tracked' => false,
                    'quantity_received' => 4, 'quantity_remaining' => 12, 'unit_name' => null,
                ])
                ->where('itemsOrdered.1.item_code', 'MLY01-001')
                ->where('itemsOrdered.1.own_quantity', 5)
                ->where('itemsOrdered.2.preorder_quantity', null)));
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

test('a bookmarked address with a wrong filter opens the list without its filters and says why', function () {
    // Opened straight from the address bar, after another page was open.
    $this->from(route('dashboard'))
        ->get(route('purchase-orders.index', ['date_from' => '2026-09-30', 'date_to' => '2026-09-01']))
        ->assertRedirect(route('purchase-orders.index'))
        ->assertSessionHasErrors(['date_to' => 'The "To" date cannot be before the "From" date.'])
        ->assertInertiaFlash('toast.message', 'The "To" date cannot be before the "From" date. The list is shown without its filters.');
});

test('a wrong filter chosen on the page itself goes back to the page as it was', function () {
    $this->from(route('purchase-orders.index', ['status' => 'completed']))
        ->withHeaders(['X-Inertia' => 'true', 'X-Inertia-Version' => (string) app(HandleInertiaRequests::class)->version(request())])
        ->get(route('purchase-orders.index', ['status' => 'completed', 'date_from' => '2026-09-30', 'date_to' => '2026-09-01']))
        ->assertRedirect(route('purchase-orders.index', ['status' => 'completed']))
        ->assertSessionHasErrors('date_to');
});

test('a download with a wrong filter does not become a download of everything', function () {
    $this->from(route('sales-reports.index'))
        ->get(route('sales-reports.export', ['date_from' => '2026-09-30', 'date_to' => '2026-09-01']))
        ->assertRedirect(route('sales-reports.index'));
});

test('a date that is not a real date is refused', function () {
    $this->from(route('purchase-orders.index'))
        ->get(route('purchase-orders.index', ['date_from' => 'yesterday']))
        ->assertSessionHasErrors(['date_from' => 'Choose a valid "From" date.']);
});
