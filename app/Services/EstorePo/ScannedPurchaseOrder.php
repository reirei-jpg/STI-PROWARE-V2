<?php

namespace App\Services\EstorePo;

/**
 * What the scanner read from an eStore purchase order document.
 *
 * Warnings are problems the Specialist should look at (totals that do not add
 * up, a row that could not be read). A blocking warning means an essential
 * value is missing, so the order cannot be saved.
 */
readonly class ScannedPurchaseOrder
{
    /**
     * @param  list<ScannedPurchaseOrderItem>  $items
     * @param  list<array{row: ?int, message: string, blocking: bool}>  $warnings
     */
    public function __construct(
        public ?string $dateOrdered,
        public ?string $timeOrdered,
        public ?string $category,
        public ?int $totalAmountCentavos,
        public array $items,
        public array $warnings,
    ) {}

    public function itemsTotalCentavos(): int
    {
        return array_sum(array_map(
            fn (ScannedPurchaseOrderItem $item): int => $item->amountCentavos ?? 0,
            $this->items,
        ));
    }

    public function hasBlockingProblems(): bool
    {
        foreach ($this->warnings as $warning) {
            if ($warning['blocking']) {
                return true;
            }
        }

        return false;
    }

    /**
     * Identifies the order without a PO number: the eStore documents have none,
     * so the same date, total and items (code, quantity, unit price) are
     * treated as the same order. Row order does not matter.
     */
    public function fingerprint(): string
    {
        $items = array_map(
            fn (ScannedPurchaseOrderItem $item): string => implode('|', [$item->itemCode, $item->quantityOrdered, $item->unitPriceCentavos]),
            $this->items,
        );

        sort($items);

        return hash('sha256', (string) json_encode([$this->dateOrdered, $this->totalAmountCentavos, $items]));
    }

    /**
     * @return array{date_ordered: ?string, time_ordered: ?string, category: ?string, total_amount_centavos: ?int, items_total_centavos: int, items: list<array<string, mixed>>, warnings: list<array{row: ?int, message: string, blocking: bool}>}
     */
    public function toArray(): array
    {
        return [
            'date_ordered' => $this->dateOrdered,
            'time_ordered' => $this->timeOrdered,
            'category' => $this->category,
            'total_amount_centavos' => $this->totalAmountCentavos,
            'items_total_centavos' => $this->itemsTotalCentavos(),
            'items' => array_map(fn (ScannedPurchaseOrderItem $item): array => $item->toArray(), $this->items),
            'warnings' => $this->warnings,
        ];
    }
}
