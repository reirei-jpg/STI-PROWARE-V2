<?php

use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Storage::fake('local');
});

test('a specialist can save the scanned order', function () {
    $specialist = User::factory()->specialist()->create();
    $this->actingAs($specialist);

    $this->post(route('purchase-orders.scan.store'), ['document' => estorePoWordUpload()]);

    $this->post(route('purchase-orders.store'))
        ->assertRedirect(route('purchase-orders.index'))
        ->assertSessionHasNoErrors();

    $purchaseOrder = PurchaseOrder::sole();

    expect($purchaseOrder)
        ->uploaded_by->toBe($specialist->id)
        ->date_ordered->toDateString()->toBe('2026-09-29')
        ->time_ordered->toBeNull()
        ->category->toBe('PROWARE')
        ->total_amount_centavos->toBe(42000)
        ->original_file_name->toBe('estore-po.docx')
        ->and($purchaseOrder->items()->sole()->only([
            'row_number', 'item_code', 'description', 'stock_on_hand', 'quantity_ordered', 'quantity_delivered', 'unit_price_centavos', 'amount_centavos',
        ]))->toBe([
            'row_number' => 1,
            'item_code' => 'PRCU01-01',
            'description' => 'Chibi Keychain Culinary',
            'stock_on_hand' => 0,
            'quantity_ordered' => 20,
            'quantity_delivered' => 0,
            'unit_price_centavos' => 2100,
            'amount_centavos' => 42000,
        ]);

    Storage::disk('local')->assertExists($purchaseOrder->document_path);
    expect(Storage::disk('local')->allFiles('purchase-orders/pending'))->toBe([]);

    $this->get(route('purchase-orders.scan'))
        ->assertInertia(fn (Assert $page) => $page->where('scan', null));
});

test('a pasted order is saved with its Order #, School and Ordered by', function () {
    $this->actingAs(User::factory()->specialist()->create());

    $this->post(route('purchase-orders.scan.store'), ['email_text' => estoreOrderEmail()]);
    $this->post(route('purchase-orders.store'))->assertSessionHasNoErrors();

    expect(PurchaseOrder::sole())
        ->order_number->toBe('30722')
        ->school->toBe('STI COLLEGE ORMOC')
        ->ordered_by->toBe('Manilyn Bioc')
        ->category->toBe('SMS')
        ->time_ordered->toStartWith('10:48')
        ->total_amount_centavos->toBe(600000)
        ->original_file_name->toBe('Pasted email');
});

test('the same Order # cannot be saved twice, even with different items', function () {
    $specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
    $this->actingAs($specialist);

    $this->post(route('purchase-orders.scan.store'), ['document' => estorePoWordUpload()]);
    $this->post(route('purchase-orders.store'));

    $this->travelTo(now()->addDay());

    $this->post(route('purchase-orders.scan.store'), ['email_text' => estoreOrderEmail()]);

    $this->post(route('purchase-orders.store'))
        ->assertSessionHasErrors(['save' => 'Order #30722 was already uploaded on '.PurchaseOrder::sole()->created_at->format('M j, Y g:i A').' by Carlo Mendoza.']);

    expect(PurchaseOrder::count())->toBe(1);
});

test('the already-uploaded message shows Philippine time', function () {
    $this->actingAs(User::factory()->specialist()->create(['name' => 'Carlo Mendoza']));

    $this->travelTo(CarbonImmutable::parse('2026-09-29 02:30:00', 'UTC'));
    $this->post(route('purchase-orders.scan.store'), ['document' => estorePoWordUpload()]);
    $this->post(route('purchase-orders.store'));

    $this->post(route('purchase-orders.scan.store'), ['document' => estorePoWordUpload()]);
    $this->post(route('purchase-orders.store'))
        ->assertSessionHasErrors(['save' => 'Order #30722 was already uploaded on Sep 29, 2026 10:30 AM by Carlo Mendoza.']);
});

test('the same items under a different Order # are a new order', function () {
    $this->actingAs(User::factory()->specialist()->create());

    $this->post(route('purchase-orders.scan.store'), ['document' => estorePoWordUpload()]);
    $this->post(route('purchase-orders.store'));

    $this->post(route('purchase-orders.scan.store'), ['document' => estorePoWordUpload(orderNumber: '30723')]);

    $this->post(route('purchase-orders.store'))->assertSessionHasNoErrors();

    expect(PurchaseOrder::count())->toBe(2);
});

test('an order with problems marked must fix cannot be saved', function () {
    $this->actingAs(User::factory()->specialist()->create());

    $this->post(route('purchase-orders.scan.store'), ['document' => estorePoWordUpload(
        rows: ["1\tPRCU01-01\tChibi Keychain Culinary\t0\ttwenty\t21.00\t420.00"],
    )]);

    $this->post(route('purchase-orders.store'), ['warnings_checked' => 'on'])
        ->assertSessionHasErrors(['save' => 'This order can\'t be saved because some essential details could not be read. Check the problems marked "Must fix".']);

    expect(PurchaseOrder::count())->toBe(0);
});

test('an order with warnings needs the warnings to be confirmed first', function () {
    $this->actingAs(User::factory()->specialist()->create());

    $this->post(route('purchase-orders.scan.store'), ['document' => estorePoWordUpload(total: '500')]);

    $this->post(route('purchase-orders.store'))
        ->assertSessionHasErrors(['warnings_checked' => 'Tick the box to confirm you checked the warnings above.']);

    expect(PurchaseOrder::count())->toBe(0);

    $this->post(route('purchase-orders.store'), ['warnings_checked' => 'on'])
        ->assertRedirect(route('purchase-orders.index'));

    expect(PurchaseOrder::sole()->total_amount_centavos)->toBe(50000);
});

test('saving without a scanned file explains what to do', function () {
    $this->actingAs(User::factory()->specialist()->create())
        ->post(route('purchase-orders.store'))
        ->assertSessionHasErrors(['save' => 'There is no scanned file to save. Please scan the purchase order again.']);
});

test('a school admin cannot save purchase orders', function () {
    $this->actingAs(User::factory()->schoolAdmin()->create())
        ->post(route('purchase-orders.store'))
        ->assertForbidden();
});

test('the list can show the newest Date Ordered first', function () {
    $newer = PurchaseOrder::factory()
        ->for(User::factory()->specialist()->state(['name' => 'Carlo Mendoza']), 'uploader')
        ->create(['date_ordered' => '2026-09-29', 'total_amount_centavos' => 42000, 'created_at' => now()->subDay()]);
    $older = PurchaseOrder::factory()
        ->has(PurchaseOrderItem::factory()->count(2), 'items')
        ->create(['date_ordered' => '2026-09-01']);

    $this->actingAs(User::factory()->specialist()->create())
        ->get(route('purchase-orders.index', ['sort' => 'newest']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('purchase-orders/index')
            ->has('purchaseOrders.data', 2)
            ->where('purchaseOrders.data.0.id', $newer->id)
            ->where('purchaseOrders.data.0.date_ordered', '2026-09-29')
            ->where('purchaseOrders.data.0.total_amount_centavos', 42000)
            ->where('purchaseOrders.data.0.uploaded_by', 'Carlo Mendoza')
            ->where('purchaseOrders.data.1.id', $older->id)
            ->where('purchaseOrders.data.1.items_count', 2)
        );
});

test('the list shows totals across all saved orders', function () {
    $purchaseOrder = PurchaseOrder::factory()->create(['total_amount_centavos' => 52500]);
    PurchaseOrderItem::factory()->for($purchaseOrder)->create(['quantity_ordered' => 20, 'amount_centavos' => 42000]);
    PurchaseOrderItem::factory()->for($purchaseOrder)->create(['quantity_ordered' => 5, 'amount_centavos' => 10500]);
    PurchaseOrder::factory()->create(['total_amount_centavos' => 42000]);

    $this->actingAs(User::factory()->specialist()->create())
        ->get(route('purchase-orders.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('summary.orders_count', 2)
            ->where('summary.total_qty_ordered', 25)
            ->where('summary.total_amount_centavos', 94500)
        );
});

test('the details window gets every detail of the order, items in document order', function () {
    $this->travelTo(now()->setDate(2026, 10, 10)->setTime(9, 0));
    $specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
    $purchaseOrder = PurchaseOrder::factory()->for($specialist, 'uploader')->create([
        'order_number' => '30722',
        'school' => 'STI COLLEGE ORMOC',
        'ordered_by' => 'Manilyn Bioc',
        'date_ordered' => '2026-09-29',
        'time_ordered' => '10:14',
        'category' => 'PROWARE',
        'total_amount_centavos' => 63000,
    ]);
    PurchaseOrderItem::factory()->for($purchaseOrder)->create([
        'row_number' => 2, 'item_code' => 'PRCU01-02', 'description' => 'Chibi Keychain Tourism',
        'stock_on_hand' => 3, 'quantity_ordered' => 10, 'unit_price_centavos' => 2100, 'amount_centavos' => 21000,
    ]);
    PurchaseOrderItem::factory()->for($purchaseOrder)->create([
        'row_number' => 1, 'item_code' => 'PRCU01-01', 'description' => 'Chibi Keychain Culinary',
        'stock_on_hand' => null, 'quantity_ordered' => 20, 'unit_price_centavos' => 2100, 'amount_centavos' => 42000,
    ]);
    $purchaseOrder->refreshDeliveryProgress();

    $this->actingAs($specialist)
        ->getJson(route('purchase-orders.show', $purchaseOrder))
        ->assertOk()
        ->assertExactJson([
            'id' => $purchaseOrder->id,
            'order_number' => '30722',
            'school' => 'STI COLLEGE ORMOC',
            'ordered_by' => 'Manilyn Bioc',
            'date_ordered' => '2026-09-29',
            'time_ordered' => '10:14',
            'category' => 'PROWARE',
            'total_amount_centavos' => 63000,
            'uploaded_by' => 'Carlo Mendoza',
            'uploaded_at' => $purchaseOrder->created_at->toIso8601String(),
            'delivery_status' => 'awaiting',
            'delivery_status_label' => 'Awaiting Delivery',
            'quantity_ordered_total' => 30,
            'quantity_received_total' => 0,
            'percent_received' => 0,
            'days_since_ordered' => 11,
            'closed_reason' => null,
            'closed_at' => null,
            'closed_by' => null,
            'items' => [
                [
                    'row_number' => 1, 'item_code' => 'PRCU01-01', 'description' => 'Chibi Keychain Culinary',
                    'stock_on_hand' => null, 'quantity_ordered' => 20, 'unit_price_centavos' => 2100, 'amount_centavos' => 42000,
                    'quantity_received' => 0, 'quantity_remaining' => 20, 'stock_target' => null,
                ],
                [
                    'row_number' => 2, 'item_code' => 'PRCU01-02', 'description' => 'Chibi Keychain Tourism',
                    'stock_on_hand' => 3, 'quantity_ordered' => 10, 'unit_price_centavos' => 2100, 'amount_centavos' => 21000,
                    'quantity_received' => 0, 'quantity_remaining' => 10, 'stock_target' => null,
                ],
            ],
            'deliveries' => [],
        ]);
});

test('details of an order that does not exist give not found', function () {
    $this->actingAs(User::factory()->specialist()->create())
        ->getJson(route('purchase-orders.show', 999))
        ->assertNotFound();
});
