<?php

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Inertia\Testing\AssertableInertia as Assert;

function realEstorePoWordUpload(): UploadedFile
{
    $body = wordParagraph('Date Ordered:  Sep 29, 2026')
        .wordParagraph('Category: PROWARE')
        .wordParagraph('Total Amount (Ordered): 420')
        .wordParagraph('')
        .wordParagraph("#\tItem Code\tDescription\tStock on Hand (School)\tQTY Ordered\tUnit Price\tAmount")
        .wordParagraph("1\tPRCU01 – 01\tChibi Keychain Culinary\t0\t20\t21.00\t420.00");

    return UploadedFile::fake()->createWithContent('estore-po.docx', file_get_contents(makeWordFile($body)));
}

test('guests are sent to the login page', function () {
    $this->get(route('purchase-orders.scan'))->assertRedirect(route('login'));
});

test('a school admin cannot open or use the scanner', function () {
    $schoolAdmin = User::factory()->schoolAdmin()->create();

    $this->actingAs($schoolAdmin)->get(route('purchase-orders.scan'))->assertForbidden();
    $this->actingAs($schoolAdmin)
        ->post(route('purchase-orders.scan.store'), ['document' => realEstorePoWordUpload()])
        ->assertForbidden();
});

test('a specialist sees the empty scan page', function () {
    $this->actingAs(User::factory()->specialist()->create())
        ->get(route('purchase-orders.scan'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('purchase-orders/scan')
            ->where('scan', null)
        );
});

test('a specialist can scan an eStore purchase order and see what was read', function () {
    $this->actingAs(User::factory()->specialist()->create())
        ->post(route('purchase-orders.scan.store'), ['document' => realEstorePoWordUpload()])
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('purchase-orders/scan')
            ->where('fileName', 'estore-po.docx')
            ->where('scan.date_ordered', '2026-09-29')
            ->where('scan.category', 'PROWARE')
            ->where('scan.total_amount_centavos', 42000)
            ->where('scan.items_total_centavos', 42000)
            ->where('scan.warnings', [])
            ->has('scan.items', 1)
            ->where('scan.items.0.item_code', 'PRCU01-01')
            ->where('scan.items.0.quantity_ordered', 20)
            ->where('scan.items.0.unit_price_centavos', 2100)
        );
});

test('a file must be chosen', function () {
    $this->actingAs(User::factory()->specialist()->create())
        ->post(route('purchase-orders.scan.store'))
        ->assertSessionHasErrors(['document' => 'Choose the purchase order file to scan.']);
});

test('files over 5 MB are refused', function () {
    $this->actingAs(User::factory()->specialist()->create())
        ->post(route('purchase-orders.scan.store'), ['document' => UploadedFile::fake()->create('po.docx', 5121)])
        ->assertSessionHasErrors(['document' => 'The file is too large. Purchase order files must be 5 MB or smaller.']);
});

test('a file the scanner cannot read is refused with an explanation', function () {
    $this->actingAs(User::factory()->specialist()->create())
        ->post(route('purchase-orders.scan.store'), ['document' => UploadedFile::fake()->createWithContent('po.png', "\x89PNG\r\n\x1a\n\0\0\0")])
        ->assertSessionHasErrors(['document' => 'PROWARE can\'t read this file type yet. Please upload the Word file (.docx) from the eStore email.']);
});
