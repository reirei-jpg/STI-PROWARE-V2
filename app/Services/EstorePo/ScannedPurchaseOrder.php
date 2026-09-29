<?php

namespace App\Services\EstorePo;

/**
 * What the scanner read from an eStore purchase order document.
 *
 * Warnings are problems the Specialist should look at (totals that do not add
 * up, a row that could not be read). They do not stop the scan.
 */
readonly class ScannedPurchaseOrder
{
    /**
     * @param  list<ScannedPurchaseOrderItem>  $items
     * @param  list<array{row: ?int, message: string}>  $warnings
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

    /**
     * @return array{date_ordered: ?string, time_ordered: ?string, category: ?string, total_amount_centavos: ?int, items_total_centavos: int, items: list<array<string, mixed>>, warnings: list<array{row: ?int, message: string}>}
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
