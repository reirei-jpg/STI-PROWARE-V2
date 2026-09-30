<?php

namespace App\Services\EstorePo;

/**
 * What the scanner read from an eStore order (the order details email or a
 * saved copy of it).
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
        public ?string $orderNumber,
        public ?string $school,
        public ?string $orderedBy,
        public ?string $dateOrdered,
        public ?string $timeOrdered,
        public ?string $category,
        public ?int $totalAmountCentavos,
        public array $items,
        public array $warnings,
    ) {}

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
     * @return array{order_number: ?string, school: ?string, ordered_by: ?string, date_ordered: ?string, time_ordered: ?string, category: ?string, total_amount_centavos: ?int, items: list<array<string, mixed>>, warnings: list<array{row: ?int, message: string, blocking: bool}>}
     */
    public function toArray(): array
    {
        return [
            'order_number' => $this->orderNumber,
            'school' => $this->school,
            'ordered_by' => $this->orderedBy,
            'date_ordered' => $this->dateOrdered,
            'time_ordered' => $this->timeOrdered,
            'category' => $this->category,
            'total_amount_centavos' => $this->totalAmountCentavos,
            'items' => array_map(fn (ScannedPurchaseOrderItem $item): array => $item->toArray(), $this->items),
            'warnings' => $this->warnings,
        ];
    }
}
