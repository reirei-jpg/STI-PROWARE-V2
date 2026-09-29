<?php

use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\User;
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

test('the same order cannot be saved twice', function () {
    $specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
    $this->actingAs($specialist);

    $this->post(route('purchase-orders.scan.store'), ['document' => estorePoWordUpload()]);
    $this->post(route('purchase-orders.store'));

    $this->travelTo(now()->addDay());

    $this->post(route('purchase-orders.scan.store'), ['document' => estorePoWordUpload(
        rows: ["1\tPRCU01-01\tChibi Keychain Culinary\t0\t20\t21.00\t420.00"],
        total: '420.00',
        fileName: 'forwarded-copy.docx',
    )]);

    $this->post(route('purchase-orders.store'))
        ->assertSessionHasErrors(['save' => 'This order was already uploaded on '.PurchaseOrder::sole()->created_at->format('M j, Y g:i A').' by Carlo Mendoza.']);

    expect(PurchaseOrder::count())->toBe(1);
});

test('an order with a different quantity is not treated as a duplicate', function () {
    $this->actingAs(User::factory()->specialist()->create());

    $this->post(route('purchase-orders.scan.store'), ['document' => estorePoWordUpload()]);
    $this->post(route('purchase-orders.store'));

    $this->post(route('purchase-orders.scan.store'), ['document' => estorePoWordUpload(
        rows: ["1\tPRCU01-01\tChibi Keychain Culinary\t0\t10\t21.00\t210.00"],
        total: '210',
    )]);

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

test('a school admin cannot see, save or download purchase orders', function () {
    $purchaseOrder = PurchaseOrder::factory()->create();
    $this->actingAs(User::factory()->schoolAdmin()->create());

    $this->get(route('purchase-orders.index'))->assertForbidden();
    $this->post(route('purchase-orders.store'))->assertForbidden();
    $this->get(route('purchase-orders.document', $purchaseOrder))->assertForbidden();
});

test('the list shows saved orders, newest upload first', function () {
    $older = PurchaseOrder::factory()
        ->has(PurchaseOrderItem::factory()->count(2), 'items')
        ->create(['created_at' => now()->subDay()]);
    $newer = PurchaseOrder::factory()
        ->for(User::factory()->specialist()->state(['name' => 'Carlo Mendoza']), 'uploader')
        ->create(['date_ordered' => '2026-09-29', 'total_amount_centavos' => 42000]);

    $this->actingAs(User::factory()->specialist()->create())
        ->get(route('purchase-orders.index'))
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

test('the original file can be downloaded with its original name', function () {
    $purchaseOrder = PurchaseOrder::factory()->create(['original_file_name' => 'estore-po.docx']);
    Storage::disk('local')->put($purchaseOrder->document_path, 'word file');

    $this->actingAs(User::factory()->specialist()->create())
        ->get(route('purchase-orders.document', $purchaseOrder))
        ->assertOk()
        ->assertDownload('estore-po.docx');
});

test('a missing original file gives not found', function () {
    $purchaseOrder = PurchaseOrder::factory()->create();

    $this->actingAs(User::factory()->specialist()->create())
        ->get(route('purchase-orders.document', $purchaseOrder))
        ->assertNotFound();
});
