<?php

use App\Services\EstorePo\EstorePoParser;
use App\Services\EstorePo\ScannedPurchaseOrder;
use App\Services\EstorePo\UnreadablePurchaseOrderException;

const ESTORE_TABLE_HEADER = "#\tItem Code\tDescription\tStock on Hand (School)\tQTY Ordered\tUnit Price\tAmount";

/**
 * The eStore purchase order exactly as the user pasted it on 29 Sep 2026.
 */
const REAL_ESTORE_PO = "Date Ordered:  Sep 29, 2026\nCategory: PROWARE\nTotal Amount (Ordered): 420\n\n"
    .ESTORE_TABLE_HEADER."\n"
    ."1\tPRCU01 – 01\tChibi Keychain Culinary\t0\t20\t21.00\t420.00";

/**
 * An eStore document with the given header lines and item rows.
 *
 * @param  list<string>  $rows
 */
function estorePoText(array $rows, string $total = '420', string $header = "Date Ordered:  Sep 29, 2026\nCategory: PROWARE"): string
{
    return $header."\nTotal Amount (Ordered): ".$total."\n\n".ESTORE_TABLE_HEADER."\n".implode("\n", $rows);
}

/**
 * @return list<string>
 */
function warningMessages(ScannedPurchaseOrder $scan): array
{
    return array_map(warningText(...), $scan->warnings);
}

/**
 * @param  array{row: ?int, message: string, blocking: bool}  $warning
 */
function warningText(array $warning): string
{
    return ($warning['row'] !== null ? "Row {$warning['row']}: " : '').$warning['message'];
}

function expectRealEstorePo(ScannedPurchaseOrder $scan): void
{
    expect($scan->dateOrdered)->toBe('2026-09-29')
        ->and($scan->timeOrdered)->toBeNull()
        ->and($scan->category)->toBe('PROWARE')
        ->and($scan->totalAmountCentavos)->toBe(42000)
        ->and($scan->warnings)->toBe([])
        ->and($scan->items)->toHaveCount(1)
        ->and($scan->items[0]->toArray())->toBe([
            'row_number' => 1,
            'item_code' => 'PRCU01-01',
            'description' => 'Chibi Keychain Culinary',
            'stock_on_hand' => 0,
            'quantity_ordered' => 20,
            'unit_price_centavos' => 2100,
            'amount_centavos' => 42000,
        ]);
}

test('it reads the real eStore purchase order from a Word file with tab-separated lines', function () {
    $body = implode('', array_map(wordParagraph(...), explode("\n", REAL_ESTORE_PO)));

    expectRealEstorePo((new EstorePoParser)->parseFile(makeWordFile($body)));
});

test('it reads the same purchase order when the items are a Word table', function () {
    $body = wordParagraph('Date Ordered:  Sep 29, 2026')
        .wordParagraph('Category: PROWARE')
        .wordParagraph('Total Amount (Ordered): 420')
        .wordTable([
            explode("\t", ESTORE_TABLE_HEADER),
            ['1', 'PRCU01 – 01', 'Chibi Keychain Culinary', '0', '20', '21.00', '420.00'],
        ]);

    expectRealEstorePo((new EstorePoParser)->parseFile(makeWordFile($body)));
});

test('it reads the same purchase order from plain text', function () {
    expectRealEstorePo((new EstorePoParser)->parseText(REAL_ESTORE_PO));
});

test('it reads a date with a time and a total with a peso sign and thousands separator', function () {
    $scan = (new EstorePoParser)->parseText(estorePoText(
        ["1\tPRCU01-01\tChibi Keychain\t0\t440\t21.00\t9,240.00"],
        total: '₱9,240.00',
        header: "Date Ordered: Sep 29 2026 10:14AM\nCategory: PROWARE",
    ));

    expect($scan->dateOrdered)->toBe('2026-09-29')
        ->and($scan->timeOrdered)->toBe('10:14')
        ->and($scan->totalAmountCentavos)->toBe(924000)
        ->and($scan->warnings)->toBe([]);
});

test('it normalizes item codes', function (string $rawCode) {
    $scan = (new EstorePoParser)->parseText(estorePoText(["1\t{$rawCode}\tChibi Keychain\t0\t20\t21.00\t420.00"]));

    expect($scan->items[0]->itemCode)->toBe('PRCU01-01');
})->with(['PRCU01 – 01', 'PRCU01 — 01', 'PRCU01 - 01', 'prcu01-01', ' PRCU01-01 ']);

test('it keeps the description as written, with extra spaces collapsed', function () {
    $scan = (new EstorePoParser)->parseText(estorePoText(["1\tPRCU01-01\tChibi Keychain - Tourism  (Female)\t0\t20\t21.00\t420.00"]));

    expect($scan->items[0]->description)->toBe('Chibi Keychain - Tourism (Female)');
});

test('only missing essentials block saving', function () {
    $scan = (new EstorePoParser)->parseText(estorePoText([
        "1\t \tChibi Keychain\t0\ttwenty\tabc\t420.00",
        "2\tPRCU01-02\tChibi Keychain\t0\t0\t21.00\t400.00",
    ], total: '999', header: 'Category: PROWARE'));

    $blockingByMessage = array_column(
        array_map(fn (array $warning): array => [warningText($warning), $warning['blocking']], $scan->warnings),
        1,
        0,
    );

    expect($blockingByMessage)->toBe([
        'Row 1: Item code is missing.' => true,
        'Row 1: Quantity ordered is missing or not a whole number.' => true,
        'Row 1: Unit price is missing or not a valid amount.' => true,
        'Row 2: Quantity ordered is 0.' => false,
        'Row 2: 0 × ₱21.00 = ₱0.00, but the document says ₱400.00.' => false,
        'Date Ordered was not found in the document.' => true,
        'The items add up to ₱820.00, but Total Amount (Ordered) says ₱999.00.' => false,
    ])->and($scan->hasBlockingProblems())->toBeTrue();
});

test('a row that cannot be read blocks saving', function () {
    $scan = (new EstorePoParser)->parseText(estorePoText([
        "1\tPRCU01-01\tChibi Keychain\t0\t20\t21.00\t420.00",
        "2\tPRCU01-02\tChibi Keychain\t20\t21.00",
    ]));

    expect($scan->hasBlockingProblems())->toBeTrue();
});

test('a clean scan has no blocking problems', function () {
    expect((new EstorePoParser)->parseText(REAL_ESTORE_PO)->hasBlockingProblems())->toBeFalse();
});

test('the fingerprint ignores row order but changes with the date, quantities or prices', function () {
    $parser = new EstorePoParser;
    $rowA = "1\tPRCU01-01\tChibi Keychain\t0\t20\t21.00\t420.00";
    $rowB = "2\tPRCU01-02\tChibi Keychain\t0\t10\t21.00\t210.00";

    $original = $parser->parseText(estorePoText([$rowA, $rowB], total: '630'))->fingerprint();

    expect($parser->parseText(estorePoText([$rowB, $rowA], total: '630'))->fingerprint())->toBe($original)
        ->and($parser->parseText(estorePoText([$rowA, str_replace("\t10\t", "\t11\t", $rowB)], total: '630'))->fingerprint())->not->toBe($original)
        ->and($parser->parseText(estorePoText([$rowA, str_replace("\t21.00\t", "\t22.00\t", $rowB)], total: '630'))->fingerprint())->not->toBe($original)
        ->and($parser->parseText(estorePoText([$rowA, $rowB], total: '630', header: "Date Ordered: Sep 30, 2026\nCategory: PROWARE"))->fingerprint())->not->toBe($original);
});

test('it warns when a row amount does not match quantity times unit price', function () {
    $scan = (new EstorePoParser)->parseText(estorePoText(["1\tPRCU01-01\tChibi Keychain\t0\t20\t21.00\t400.00"], total: '400'));

    expect(warningMessages($scan))->toBe(['Row 1: 20 × ₱21.00 = ₱420.00, but the document says ₱400.00.']);
});

test('it warns when the items do not add up to the document total', function () {
    $scan = (new EstorePoParser)->parseText(estorePoText(["1\tPRCU01-01\tChibi Keychain\t0\t20\t21.00\t420.00"], total: '500.00'));

    expect(warningMessages($scan))->toBe(['The items add up to ₱420.00, but Total Amount (Ordered) says ₱500.00.']);
});

test('it warns when the same item code appears more than once', function () {
    $scan = (new EstorePoParser)->parseText(estorePoText([
        "1\tPRCU01 – 01\tChibi Keychain\t0\t20\t21.00\t420.00",
        "2\tPRCU01-01\tChibi Keychain\t0\t10\t21.00\t210.00",
    ], total: '630'));

    expect(warningMessages($scan))->toBe(['Item code PRCU01-01 appears more than once (rows 1, 2).'])
        ->and($scan->items)->toHaveCount(2);
});

test('it warns about values in a row that cannot be read', function () {
    $scan = (new EstorePoParser)->parseText(estorePoText([
        "1\t \tChibi Keychain\tnone\ttwenty\tabc\t420.00",
        "2\tPRCU01-02\tChibi Keychain\t0\t0\t21.00\t0",
    ]));

    expect(warningMessages($scan))->toBe([
        'Row 1: Item code is missing.',
        'Row 1: Stock on hand "none" is not a whole number.',
        'Row 1: Quantity ordered is missing or not a whole number.',
        'Row 1: Unit price is missing or not a valid amount.',
        'Row 2: Quantity ordered is 0.',
    ]);
});

test('it warns when a row has the wrong number of columns and skips it', function () {
    $scan = (new EstorePoParser)->parseText(estorePoText([
        "1\tPRCU01-01\tChibi Keychain\t0\t20\t21.00\t420.00",
        "2\tPRCU01-02\tChibi Keychain\t20\t21.00",
    ]));

    expect(warningMessages($scan))->toBe(['Row 2: This row could not be read: expected 7 columns but found 5.'])
        ->and($scan->items)->toHaveCount(1);
});

test('it ignores extra tabs used to line columns up', function () {
    $scan = (new EstorePoParser)->parseText(estorePoText(["1\t\tPRCU01-01\tChibi Keychain\t\t0\t20\t21.00\t420.00"]));

    expect($scan->warnings)->toBe([])
        ->and($scan->items[0]->itemCode)->toBe('PRCU01-01');
});

test('the item table ends at the first blank line after the rows', function () {
    $scan = (new EstorePoParser)->parseText(estorePoText([
        "1\tPRCU01-01\tChibi Keychain\t0\t20\t21.00\t420.00",
        '',
        "Prepared by\tSomeone\tin the eStore",
    ]));

    expect($scan->items)->toHaveCount(1)
        ->and($scan->warnings)->toBe([]);
});

test('it warns about missing or unreadable header fields', function () {
    $scan = (new EstorePoParser)->parseText(estorePoText(
        ["1\tPRCU01-01\tChibi Keychain\t0\t20\t21.00\t420.00"],
        total: 'four hundred',
        header: 'Date Ordered: sometime last week',
    ));

    expect(warningMessages($scan))->toBe([
        'Date Ordered "sometime last week" could not be read as a date.',
        'Category was not found in the document.',
        'Total Amount (Ordered) "four hundred" is not a valid amount.',
    ]);
});

test('it refuses a file it cannot scan', function (string $contents, string $message) {
    $path = tempnam(sys_get_temp_dir(), 'po');
    file_put_contents($path, $contents);

    expect(fn () => (new EstorePoParser)->parseFile($path))
        ->toThrow(UnreadablePurchaseOrderException::class, $message);
})->with([
    'empty file' => ['', 'The uploaded file is empty or could not be opened.'],
    'binary file' => ["\x89PNG\r\n\x1a\n\0\0\0", 'PROWARE can\'t read this file type yet. Please upload the Word file (.docx) from the eStore email.'],
    'text without an item table' => ["Hello,\nPlease see the attached order.", 'PROWARE could not find the item table in this file.'],
    'item table with no rows' => ["Category: PROWARE\n".ESTORE_TABLE_HEADER, 'The item table in this file has no items.'],
]);

test('it refuses a zip file that is not a Word document', function () {
    $path = tempnam(sys_get_temp_dir(), 'po');
    $zip = new ZipArchive;
    $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);
    $zip->addFromString('xl/workbook.xml', '<workbook/>');
    $zip->close();

    expect(fn () => (new EstorePoParser)->parseFile($path))
        ->toThrow(UnreadablePurchaseOrderException::class, 'PROWARE can\'t read this file type yet.');
});
