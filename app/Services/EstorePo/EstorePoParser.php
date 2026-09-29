<?php

namespace App\Services\EstorePo;

use DateTimeImmutable;
use DOMDocument;
use DOMElement;
use DOMNode;
use ZipArchive;

/**
 * Reads ("scans") the purchase order document that STI's eStore emails to the
 * PROWARE Specialist.
 *
 * The document has a few header lines followed by an item table:
 *
 *     Date Ordered:  Sep 29, 2026
 *     Category: PROWARE
 *     Total Amount (Ordered): 420
 *
 *     #  Item Code    Description              Stock on Hand (School)  QTY Ordered  Unit Price  Amount
 *     1  PRCU01 – 01  Chibi Keychain Culinary  0                       20           21.00       420.00
 *
 * A Word file is first turned into plain lines (a real Word table row becomes
 * one tab-separated line), so Word tables, tab-separated text and plain text
 * files all go through the same reading rules. Labels are matched loosely, so
 * small wording changes in the eStore template still scan.
 */
class EstorePoParser
{
    private const WORD_NAMESPACE = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

    private const UNSUPPORTED_FILE_MESSAGE = 'PROWARE can\'t read this file type yet. Please upload the Word file (.docx) from the eStore email.';

    /**
     * Scan a file on disk. Word (.docx) and plain text files are supported.
     *
     * @throws UnreadablePurchaseOrderException
     */
    public function parseFile(string $path): ScannedPurchaseOrder
    {
        $contents = is_readable($path) ? file_get_contents($path) : false;

        if ($contents === false || $contents === '') {
            throw new UnreadablePurchaseOrderException('The uploaded file is empty or could not be opened.');
        }

        if (str_starts_with($contents, "PK\x03\x04")) {
            return $this->parseLines($this->linesFromWordFile($path));
        }

        if (str_contains($contents, "\0") || ! mb_check_encoding($contents, 'UTF-8')) {
            throw new UnreadablePurchaseOrderException(self::UNSUPPORTED_FILE_MESSAGE);
        }

        return $this->parseText($contents);
    }

    /**
     * Scan purchase order text, for example the contents of a plain text file.
     *
     * @throws UnreadablePurchaseOrderException
     */
    public function parseText(string $text): ScannedPurchaseOrder
    {
        $text = preg_replace('/^\xEF\xBB\xBF/', '', $text) ?? $text;

        return $this->parseLines(preg_split('/\R/u', $text) ?: []);
    }

    /**
     * Turn the body of a Word document into lines of text, in reading order.
     *
     * @return list<string>
     */
    private function linesFromWordFile(string $path): array
    {
        $zip = new ZipArchive;

        if ($zip->open($path) !== true) {
            throw new UnreadablePurchaseOrderException('This Word file looks damaged and could not be opened.');
        }

        $documentXml = $zip->getFromName('word/document.xml');
        $zip->close();

        if ($documentXml === false) {
            throw new UnreadablePurchaseOrderException(self::UNSUPPORTED_FILE_MESSAGE);
        }

        $document = new DOMDocument;

        if (! @$document->loadXML($documentXml, LIBXML_NONET)) {
            throw new UnreadablePurchaseOrderException('This Word file looks damaged and could not be read.');
        }

        $body = $document->getElementsByTagNameNS(self::WORD_NAMESPACE, 'body')->item(0);

        if ($body === null) {
            throw new UnreadablePurchaseOrderException('This Word file has no content.');
        }

        $lines = [];
        $this->collectLines($body, $lines);

        return $lines;
    }

    /**
     * @param  list<string>  $lines
     */
    private function collectLines(DOMNode $node, array &$lines): void
    {
        foreach ($node->childNodes as $child) {
            if (! $child instanceof DOMElement) {
                continue;
            }

            if ($child->namespaceURI === self::WORD_NAMESPACE && $child->localName === 'tbl') {
                foreach ($this->childElements($child, 'tr') as $row) {
                    $cells = array_map(
                        fn (DOMElement $cell): string => $this->cellText($cell),
                        $this->childElements($row, 'tc'),
                    );

                    $lines[] = implode("\t", $cells);
                }

                $lines[] = '';

                continue;
            }

            if ($child->namespaceURI === self::WORD_NAMESPACE && $child->localName === 'p') {
                array_push($lines, ...explode("\n", $this->paragraphText($child)));

                continue;
            }

            $this->collectLines($child, $lines);
        }
    }

    /**
     * @return list<DOMElement>
     */
    private function childElements(DOMElement $parent, string $localName): array
    {
        $elements = [];

        foreach ($parent->childNodes as $child) {
            if ($child instanceof DOMElement && $child->namespaceURI === self::WORD_NAMESPACE && $child->localName === $localName) {
                $elements[] = $child;
            }
        }

        return $elements;
    }

    private function cellText(DOMElement $cell): string
    {
        $paragraphs = [];

        foreach ($cell->getElementsByTagNameNS(self::WORD_NAMESPACE, 'p') as $paragraph) {
            $paragraphs[] = $this->paragraphText($paragraph);
        }

        return trim((string) preg_replace('/\s+/u', ' ', implode(' ', $paragraphs)));
    }

    /**
     * Text of one Word paragraph. Tabs and line breaks inside runs are kept;
     * tab stop definitions in the paragraph settings are not text.
     */
    private function paragraphText(DOMElement $paragraph): string
    {
        $text = '';

        foreach ($paragraph->getElementsByTagNameNS(self::WORD_NAMESPACE, '*') as $element) {
            if ($element->parentNode?->localName !== 'r') {
                continue;
            }

            $text .= match ($element->localName) {
                't' => $element->textContent,
                'tab' => "\t",
                'br', 'cr' => "\n",
                'noBreakHyphen' => '-',
                default => '',
            };
        }

        return $text;
    }

    /**
     * @param  list<string>  $lines
     */
    private function parseLines(array $lines): ScannedPurchaseOrder
    {
        $lines = array_map(
            fn (string $line): string => rtrim(str_replace("\u{00A0}", ' ', $line)),
            $lines,
        );

        $headerFields = ['date' => null, 'category' => null, 'total' => null];
        $layout = null;
        $tableStart = null;

        foreach ($lines as $index => $line) {
            $layout = $this->itemTableLayout($line);

            if ($layout !== null) {
                $tableStart = $index + 1;

                break;
            }

            $this->readHeaderField($line, $headerFields);
        }

        if ($layout === null || $tableStart === null) {
            throw new UnreadablePurchaseOrderException('PROWARE could not find the item table in this file. Please upload the purchase order document from the eStore email.');
        }

        $warnings = [];
        $items = $this->readItems(array_slice($lines, $tableStart), $layout, $warnings);

        if ($items === []) {
            throw new UnreadablePurchaseOrderException('The item table in this file has no items.');
        }

        [$dateOrdered, $timeOrdered] = $this->readDateOrdered($headerFields['date'], $warnings);
        $category = $headerFields['category'] !== null && $headerFields['category'] !== '' ? $headerFields['category'] : null;

        if ($category === null) {
            $warnings[] = $this->warning(null, 'Category was not found in the document.');
        }

        $totalAmountCentavos = $this->readTotalAmount($headerFields['total'], $warnings);

        $this->checkDuplicateItemCodes($items, $warnings);

        $itemsTotalCentavos = array_sum(array_map(
            fn (ScannedPurchaseOrderItem $item): int => $item->amountCentavos ?? 0,
            $items,
        ));

        if ($totalAmountCentavos !== null && $itemsTotalCentavos !== $totalAmountCentavos) {
            $warnings[] = $this->warning(null, sprintf(
                'The Amounts add up to %s, but the Total Amount (Ordered) is %s.',
                $this->formatMoney($itemsTotalCentavos),
                $this->formatMoney($totalAmountCentavos),
            ));
        }

        return new ScannedPurchaseOrder($dateOrdered, $timeOrdered, $category, $totalAmountCentavos, $items, $warnings);
    }

    /**
     * Pick up "Label: value" (or "Label<tab>value") header lines.
     *
     * @param  array{date: ?string, category: ?string, total: ?string}  $headerFields
     */
    private function readHeaderField(string $line, array &$headerFields): void
    {
        if (! preg_match('/^\s*([^:\t]+?)\s*(?::|\t)\s*(.*)$/u', $line, $matches)) {
            return;
        }

        $label = $this->labelKey($matches[1]);
        $value = trim((string) preg_replace('/\s+/u', ' ', $matches[2]));

        if ($label === 'dateordered') {
            $headerFields['date'] ??= $value;
        } elseif ($label === 'category') {
            $headerFields['category'] ??= $value;
        } elseif (str_starts_with($label, 'totalamount')) {
            $headerFields['total'] ??= $value;
        }
    }

    /**
     * When the line is the item table's header row, describe its columns.
     *
     * Two layouts are kept: one with every tab-separated cell (a Word table,
     * where blank cells matter) and one without blank cells (typed text,
     * where extra tabs are only used to line columns up).
     *
     * @return array{exact: array{width: int, columns: array<int, string>}, compact: array{width: int, columns: array<int, string>}}|null
     */
    private function itemTableLayout(string $line): ?array
    {
        if (! str_contains($line, "\t")) {
            return null;
        }

        $exact = $this->columnLayout($this->splitCells($line, dropEmpty: false));

        if (! in_array('item_code', $exact['columns'], true) || ! in_array('quantity_ordered', $exact['columns'], true)) {
            return null;
        }

        return [
            'exact' => $exact,
            'compact' => $this->columnLayout($this->splitCells($line, dropEmpty: true)),
        ];
    }

    /**
     * @param  list<string>  $headerCells
     * @return array{width: int, columns: array<int, string>}
     */
    private function columnLayout(array $headerCells): array
    {
        $columns = [];

        foreach ($headerCells as $position => $cell) {
            $key = $this->labelKey($cell);

            $field = match (true) {
                in_array($key, ['itemcode', 'code'], true) => 'item_code',
                in_array($key, ['description', 'itemdescription'], true) => 'description',
                str_starts_with($key, 'stockonhand') => 'stock_on_hand',
                str_starts_with($key, 'qty') || str_starts_with($key, 'quantity') => 'quantity_ordered',
                in_array($key, ['unitprice', 'price'], true) => 'unit_price',
                in_array($key, ['amount', 'totalamount', 'total'], true) => 'amount',
                default => null,
            };

            if ($field !== null) {
                $columns[$position] = $field;
            }
        }

        return ['width' => count($headerCells), 'columns' => $columns];
    }

    /**
     * @param  list<string>  $lines
     * @param  array{exact: array{width: int, columns: array<int, string>}, compact: array{width: int, columns: array<int, string>}}  $layout
     * @param  list<array{row: ?int, message: string, blocking: bool}>  $warnings
     * @return list<ScannedPurchaseOrderItem>
     */
    private function readItems(array $lines, array $layout, array &$warnings): array
    {
        $items = [];
        $rowNumber = 0;

        foreach ($lines as $line) {
            if (trim($line) === '') {
                if ($rowNumber > 0) {
                    break;
                }

                continue;
            }

            $cells = $this->splitCells($line, dropEmpty: false);
            $matchesLayout = count($cells) === $layout['exact']['width'];
            $columns = $layout['exact']['columns'];

            if (! $matchesLayout) {
                $cells = $this->splitCells($line, dropEmpty: true);
                $matchesLayout = count($cells) === $layout['compact']['width'];
                $columns = $layout['compact']['columns'];
            }

            if (count($cells) < 3) {
                break;
            }

            $rowNumber++;

            if (! $matchesLayout) {
                $warnings[] = $this->warning($rowNumber, sprintf('This row could not be read: expected %d columns but found %d.', $layout['compact']['width'], count($cells)), blocking: true);

                continue;
            }

            $values = [];

            foreach ($columns as $position => $field) {
                $values[$field] = $cells[$position] ?? '';
            }

            $items[] = $this->readItem($rowNumber, $values, $warnings);
        }

        return $items;
    }

    /**
     * @param  array<string, string>  $values
     * @param  list<array{row: ?int, message: string, blocking: bool}>  $warnings
     */
    private function readItem(int $rowNumber, array $values, array &$warnings): ScannedPurchaseOrderItem
    {
        $itemCode = ItemCode::normalize($values['item_code'] ?? '');
        $description = trim((string) preg_replace('/\s+/u', ' ', $values['description'] ?? ''));

        $rawStock = $values['stock_on_hand'] ?? '';
        $stockOnHand = $this->parseWholeNumber($rawStock);
        $quantityOrdered = $this->parseWholeNumber($values['quantity_ordered'] ?? '');
        $unitPriceCentavos = $this->parseMoney($values['unit_price'] ?? '');
        $amountCentavos = $this->parseMoney($values['amount'] ?? '');

        $warn = function (string $message, bool $blocking = false) use ($rowNumber, &$warnings): void {
            $warnings[] = $this->warning($rowNumber, $message, $blocking);
        };

        if ($itemCode === null) {
            $warn('Item code is missing.', blocking: true);
        }

        if ($description === '') {
            $warn('Description is missing.');
        }

        if (trim($rawStock) !== '' && $stockOnHand === null) {
            $warn(sprintf('Stock on hand "%s" is not a whole number.', trim($rawStock)));
        }

        if ($quantityOrdered === null) {
            $warn('Quantity ordered is missing or not a whole number.', blocking: true);
        } elseif ($quantityOrdered === 0) {
            $warn('Quantity ordered is 0.');
        }

        if ($unitPriceCentavos === null) {
            $warn('Unit price is missing or not a valid amount.', blocking: true);
        }

        if ($amountCentavos === null) {
            $warn('Amount is missing or not a valid amount.');
        }

        if ($quantityOrdered !== null && $unitPriceCentavos !== null && $amountCentavos !== null
            && $quantityOrdered * $unitPriceCentavos !== $amountCentavos) {
            $warn(sprintf(
                '%d × %s = %s, but the document says %s.',
                $quantityOrdered,
                $this->formatMoney($unitPriceCentavos),
                $this->formatMoney($quantityOrdered * $unitPriceCentavos),
                $this->formatMoney($amountCentavos),
            ));
        }

        return new ScannedPurchaseOrderItem(
            rowNumber: $rowNumber,
            itemCode: $itemCode,
            description: $description,
            stockOnHand: $stockOnHand,
            quantityOrdered: $quantityOrdered,
            unitPriceCentavos: $unitPriceCentavos,
            amountCentavos: $amountCentavos,
        );
    }

    /**
     * @param  list<array{row: ?int, message: string, blocking: bool}>  $warnings
     * @return array{0: ?string, 1: ?string}
     */
    private function readDateOrdered(?string $value, array &$warnings): array
    {
        if ($value === null || $value === '') {
            $warnings[] = $this->warning(null, 'Date Ordered was not found in the document.', blocking: true);

            return [null, null];
        }

        $normalized = (string) preg_replace('/(\d)\s*([ap]m)\b/i', '$1 $2', $value);

        $formats = [
            'M j, Y g:i A' => true, 'M j Y g:i A' => true, 'F j, Y g:i A' => true, 'F j Y g:i A' => true,
            'M j, Y' => false, 'M j Y' => false, 'F j, Y' => false, 'F j Y' => false,
            'Y-m-d' => false, 'n/j/Y' => false,
        ];

        foreach ($formats as $format => $hasTime) {
            $date = DateTimeImmutable::createFromFormat('!'.$format, $normalized);
            $errors = DateTimeImmutable::getLastErrors();

            if ($date !== false && ($errors === false || ($errors['warning_count'] === 0 && $errors['error_count'] === 0))) {
                return [$date->format('Y-m-d'), $hasTime ? $date->format('H:i') : null];
            }
        }

        $warnings[] = $this->warning(null, sprintf('Date Ordered "%s" could not be read as a date.', $value), blocking: true);

        return [null, null];
    }

    /**
     * @param  list<array{row: ?int, message: string, blocking: bool}>  $warnings
     */
    private function readTotalAmount(?string $value, array &$warnings): ?int
    {
        if ($value === null || $value === '') {
            $warnings[] = $this->warning(null, 'Total Amount (Ordered) was not found in the document.');

            return null;
        }

        $centavos = $this->parseMoney($value);

        if ($centavos === null) {
            $warnings[] = $this->warning(null, sprintf('Total Amount (Ordered) "%s" is not a valid amount.', $value));
        }

        return $centavos;
    }

    /**
     * @param  list<ScannedPurchaseOrderItem>  $items
     * @param  list<array{row: ?int, message: string, blocking: bool}>  $warnings
     */
    private function checkDuplicateItemCodes(array $items, array &$warnings): void
    {
        $rowsByCode = [];

        foreach ($items as $item) {
            if ($item->itemCode !== null) {
                $rowsByCode[$item->itemCode][] = $item->rowNumber;
            }
        }

        foreach ($rowsByCode as $code => $rows) {
            if (count($rows) > 1) {
                $warnings[] = $this->warning(null, sprintf('Item code %s appears more than once (rows %s).', $code, implode(', ', $rows)));
            }
        }
    }

    /**
     * A problem found while scanning. A blocking problem means an essential
     * value (date, item code, quantity or unit price) is missing, so the
     * order cannot be saved.
     *
     * @return array{row: ?int, message: string, blocking: bool}
     */
    private function warning(?int $row, string $message, bool $blocking = false): array
    {
        return ['row' => $row, 'message' => $message, 'blocking' => $blocking];
    }

    /**
     * "420", "420.00", "₱9,240.00" and "PHP 21.5" all become centavos.
     */
    private function parseMoney(string $value): ?int
    {
        $clean = str_replace(['₱', ',', ' '], '', trim($value));
        $clean = (string) preg_replace('/^(PHP|P)/i', '', $clean);

        if (! preg_match('/^(\d+)(?:\.(\d{1,2}))?$/', $clean, $matches)) {
            return null;
        }

        return ((int) $matches[1]) * 100 + (int) str_pad($matches[2] ?? '0', 2, '0');
    }

    private function parseWholeNumber(string $value): ?int
    {
        $clean = str_replace([',', ' '], '', trim($value));

        if (! preg_match('/^(\d+)(?:\.0+)?$/', $clean, $matches)) {
            return null;
        }

        return (int) $matches[1];
    }

    /**
     * @return list<string>
     */
    private function splitCells(string $line, bool $dropEmpty): array
    {
        $cells = array_map('trim', explode("\t", $line));

        return $dropEmpty ? array_values(array_filter($cells, fn (string $cell): bool => $cell !== '')) : $cells;
    }

    /**
     * "Total Amount (Ordered):" becomes "totalamountordered".
     */
    private function labelKey(string $label): string
    {
        return (string) preg_replace('/[^a-z]/', '', mb_strtolower($label));
    }

    private function formatMoney(int $centavos): string
    {
        return '₱'.number_format($centavos / 100, 2);
    }
}
