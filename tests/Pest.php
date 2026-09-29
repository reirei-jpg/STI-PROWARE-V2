<?php

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
 * An uploaded eStore purchase order Word file in the real eStore layout.
 * By default it holds the one-item order the user shared on 29 Sep 2026.
 *
 * @param  list<string>  $rows  tab-separated item rows
 */
function estorePoWordUpload(
    array $rows = ["1\tPRCU01 – 01\tChibi Keychain Culinary\t0\t20\t21.00\t420.00"],
    string $total = '420',
    string $dateOrdered = 'Sep 29, 2026',
    string $fileName = 'estore-po.docx',
): UploadedFile {
    $lines = [
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
