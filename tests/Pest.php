<?php

use App\Models\PurchaseOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind different classes or traits.
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain conditions. The
| "expect()" function gives you access to a set of "expectations" methods that you can use
| to assert different things. Of course, you may extend the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Functions
|--------------------------------------------------------------------------
|
| While Pest is very powerful out-of-the-box, you may have some testing code specific to your
| project that you don't want to repeat in every file. Here you can also expose helpers as
| global functions to help you to reduce the number of lines of code in your test files.
|
*/

/**
 * An order with the given item codes and quantities ordered.
 *
 * @param  array<string, int>  $items  quantity ordered by item code
 * @param  array<string, mixed>  $attributes
 */
function orderWith(array $items, array $attributes = []): PurchaseOrder
{
    return PurchaseOrder::factory()
        ->withItems(array_map(
            fn (string $code, int $quantity): array => ['item_code' => $code, 'description' => "Item {$code}", 'quantity_ordered' => $quantity, 'quantity_delivered' => 0],
            array_keys($items),
            array_values($items),
        ))
        ->create($attributes);
}

/**
 * The id of the ordered item with this code on the order.
 */
function itemOf(PurchaseOrder $order, string $code): int
{
    return $order->items()->where('item_code', $code)->value('id');
}

/**
 * An uploaded eStore order saved as a Word file. By default it holds the
 * one-item order the user shared on 29 Sep 2026, with an Order #.
 *
 * @param  list<string>  $rows  tab-separated item rows
 */
function estorePoWordUpload(
    array $rows = ["1\tPRCU01 – 01\tChibi Keychain Culinary\t0\t20\t21.00\t420.00"],
    string $total = '420',
    string $dateOrdered = 'Sep 29, 2026',
    string $fileName = 'estore-po.docx',
    string $orderNumber = '30722',
): UploadedFile {
    $lines = [
        "Order #\t:\t{$orderNumber}",
        "Date Ordered:  {$dateOrdered}",
        'Category: PROWARE',
        "Total Amount (Ordered): {$total}",
        '',
        "#\tItem Code\tDescription\tStock on Hand (School)\tQTY Ordered\tUnit Price\tAmount",
        ...$rows,
    ];

    $path = makeWordFile(implode('', array_map(wordParagraph(...), $lines)));

    return UploadedFile::fake()->createWithContent($fileName, (string) file_get_contents($path));
}

/**
 * The eStore "Delivered: Online Sales Ordering" email as the Specialist
 * would copy and paste it, forward headers and all. By default it is the
 * real email the user shared on 30 Sep 2026 (Order #30722).
 *
 * @param  list<string>  $rows  tab-separated item rows
 */
function estoreOrderEmail(
    string $orderNumber = '30722',
    array $rows = ["1\tSSIF001-001\tStudent Information form\t0\t3,000\t₱ 2.00\t₱ 6,000.00"],
    string $total = '₱ 6,000.00',
    string $category = 'SMS',
): string {
    return implode("\n", [
        '---------- Forwarded message ---------',
        'From: Bioc, Manilyn <manilyn.bioc@ormoc.sti.edu>',
        'Date: Wed, Sep 30, 2026 at 11:18 AM',
        'Subject: Fw: Delivered: Online Sales Ordering',
        '',
        'From: E-Store (No-Reply) <estore1@sti.edu>',
        'Sent: Tuesday, September 29, 2026 10:48',
        'Subject: Delivered: Online Sales Ordering',
        '',
        'Dear Ms. Manilyn Bioc,',
        '',
        'Your request has been successfully sent to Ms. Sheena Joy Muyuela.',
        '',
        '----- Order Details -----',
        '',
        '',
        "Order #\t:\t{$orderNumber}",
        "School\t:\tSTI COLLEGE ORMOC",
        "Ordered by\t:\tManilyn Bioc",
        "Date Ordered\t:\tSep 29, 2026 10:48 AM",
        "Category\t:\t{$category}",
        "Total Amount (Ordered)\t:\t{$total}",
        "#\tItem Code\tItem Description\tStock on Hand (School)\tQty Ordered\tUnit Price\tAmount",
        ...$rows,
        '',
        '',
        'Click here to review your request.',
        '',
        '',
        'Thank you,',
        '',
        'Online Sales Ordering Team',
    ]);
}

/**
 * Build a minimal Word (.docx) file with the given body XML and return its path.
 */
function makeWordFile(string $bodyXml): string
{
    $base = tempnam(sys_get_temp_dir(), 'po');
    unlink($base);
    $path = $base.'.docx';

    $zip = new ZipArchive;
    $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);
    $zip->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    $zip->addFromString('word/document.xml', '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'.$bodyXml.'</w:body></w:document>');
    $zip->close();

    return $path;
}

/**
 * One Word paragraph. Tabs in the text become Word tab characters, and the
 * paragraph carries a tab stop definition, which must not be read as text.
 */
function wordParagraph(string $text): string
{
    $runs = array_map(
        fn (string $part): string => '<w:t xml:space="preserve">'.htmlspecialchars($part, ENT_XML1).'</w:t>',
        explode("\t", $text),
    );

    return '<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr><w:r>'.implode('<w:tab/>', $runs).'</w:r></w:p>';
}

/**
 * A Word table with one row per array of cell texts.
 *
 * @param  list<list<string>>  $rows
 */
function wordTable(array $rows): string
{
    $rowsXml = array_map(
        fn (array $cells): string => '<w:tr>'.implode('', array_map(
            fn (string $cell): string => '<w:tc>'.wordParagraph($cell).'</w:tc>',
            $cells,
        )).'</w:tr>',
        $rows,
    );

    return '<w:tbl>'.implode('', $rowsXml).'</w:tbl>';
}
