<?php

use App\Models\PurchaseOrder;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Storage::fake('local');
});

test('guests are sent to the login page', function () {
    $this->get(route('purchase-orders.scan'))->assertRedirect(route('login'));
});

test('a school admin cannot open or use the scanner', function () {
    $this->actingAs(User::factory()->schoolAdmin()->create());

    $this->get(route('purchase-orders.scan'))->assertForbidden();
    $this->post(route('purchase-orders.scan.store'), ['document' => estorePoWordUpload()])->assertForbidden();
    $this->delete(route('purchase-orders.scan.destroy'))->assertForbidden();
});

test('a specialist sees the empty scan page', function () {
    $this->actingAs(User::factory()->specialist()->create())
        ->get(route('purchase-orders.scan'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('purchase-orders/scan')
            ->where('scan', null)
            ->where('duplicate', null)
        );
});

test('scanning keeps the file privately and shows what was read', function () {
    $this->actingAs(User::factory()->specialist()->create());

    $this->post(route('purchase-orders.scan.store'), ['document' => estorePoWordUpload()])
        ->assertRedirect(route('purchase-orders.scan'));

    expect(Storage::disk('local')->allFiles('purchase-orders/pending'))->toHaveCount(1);

    $this->get(route('purchase-orders.scan'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('purchase-orders/scan')
            ->where('fileName', 'estore-po.docx')
            ->where('duplicate', null)
            ->where('scan.date_ordered', '2026-09-29')
            ->where('scan.category', 'PROWARE')
            ->where('scan.total_amount_centavos', 42000)
            ->where('scan.warnings', [])
            ->has('scan.items', 1)
            ->where('scan.items.0.item_code', 'PRCU01-01')
            ->where('scan.items.0.description', 'Chibi Keychain Culinary')
            ->where('scan.items.0.quantity_ordered', 20)
            ->where('scan.items.0.unit_price_centavos', 2100)
        );
});

test('pasting the order details email scans it and keeps it privately', function () {
    $this->actingAs(User::factory()->specialist()->create());

    $this->post(route('purchase-orders.scan.store'), ['email_text' => estoreOrderEmail()])
        ->assertRedirect(route('purchase-orders.scan'))
        ->assertSessionHasNoErrors();

    expect(Storage::disk('local')->allFiles('purchase-orders/pending'))->toHaveCount(1);

    $this->get(route('purchase-orders.scan'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('fileName', 'Pasted email')
            ->where('scan.order_number', '30722')
            ->where('scan.school', 'STI COLLEGE ORMOC')
            ->where('scan.ordered_by', 'Manilyn Bioc')
            ->where('scan.category', 'SMS')
            ->where('scan.time_ordered', '10:48')
            ->where('scan.total_amount_centavos', 600000)
            ->where('scan.warnings', [])
            ->where('scan.items.0.item_code', 'SSIF001-001')
            ->where('scan.items.0.quantity_ordered', 3000)
        );
});

test('pasted text without an order is refused with an explanation', function () {
    $this->actingAs(User::factory()->specialist()->create())
        ->post(route('purchase-orders.scan.store'), ['email_text' => "Your request has been approved (Order #: 30720).\nYou may now create an Internal Request via ORACLE."])
        ->assertSessionHasErrors(['email_text' => 'PROWARE could not find the item table. Paste the whole order details email from the eStore, or upload a saved copy of it.']);

    expect(Storage::disk('local')->allFiles())->toBe([]);
});

test('scanning a new file replaces the previous scan', function () {
    $this->actingAs(User::factory()->specialist()->create());

    $this->post(route('purchase-orders.scan.store'), ['document' => estorePoWordUpload(fileName: 'first.docx')]);
    $this->post(route('purchase-orders.scan.store'), ['document' => estorePoWordUpload(fileName: 'second.docx')]);

    expect(Storage::disk('local')->allFiles('purchase-orders/pending'))->toHaveCount(1);

    $this->get(route('purchase-orders.scan'))
        ->assertInertia(fn (Assert $page) => $page->where('fileName', 'second.docx'));
});

test('the scan page warns when the order was already uploaded', function () {
    $specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
    $this->actingAs($specialist);

    $this->post(route('purchase-orders.scan.store'), ['document' => estorePoWordUpload()]);
    $this->post(route('purchase-orders.store'));

    $this->post(route('purchase-orders.scan.store'), ['document' => estorePoWordUpload()]);

    $this->get(route('purchase-orders.scan'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('duplicate.uploaded_by', 'Carlo Mendoza')
            ->where('duplicate.uploaded_at', PurchaseOrder::sole()->created_at->toIso8601String())
        );
});

test('discarding a scan deletes the kept file', function () {
    $this->actingAs(User::factory()->specialist()->create());

    $this->post(route('purchase-orders.scan.store'), ['document' => estorePoWordUpload()]);

    $this->delete(route('purchase-orders.scan.destroy'))
        ->assertRedirect(route('purchase-orders.scan'));

    expect(Storage::disk('local')->allFiles('purchase-orders/pending'))->toBe([]);

    $this->get(route('purchase-orders.scan'))
        ->assertInertia(fn (Assert $page) => $page->where('scan', null));
});

test('the email must be pasted or a file chosen', function () {
    $this->actingAs(User::factory()->specialist()->create())
        ->post(route('purchase-orders.scan.store'))
        ->assertSessionHasErrors([
            'email_text' => 'Paste the order details email from the eStore.',
            'document' => 'Choose the order file to scan.',
        ]);
});

test('files over 5 MB are refused', function () {
    $this->actingAs(User::factory()->specialist()->create())
        ->post(route('purchase-orders.scan.store'), ['document' => UploadedFile::fake()->create('po.docx', 5121)])
        ->assertSessionHasErrors(['document' => 'The file is too large. Order files must be 5 MB or smaller.']);
});

test('a file the scanner cannot read is refused with an explanation and not kept', function () {
    $this->actingAs(User::factory()->specialist()->create())
        ->post(route('purchase-orders.scan.store'), ['document' => UploadedFile::fake()->createWithContent('po.png', "\x89PNG\r\n\x1a\n\0\0\0")])
        ->assertSessionHasErrors(['document' => 'PROWARE can\'t read this file type yet. Paste the order details email instead, or upload it as a Word (.docx) or text file.']);

    expect(Storage::disk('local')->allFiles())->toBe([]);
});
