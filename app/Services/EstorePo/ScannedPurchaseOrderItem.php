<?php

namespace App\Services\EstorePo;

/**
 * One row of the item table in an eStore purchase order.
 *
 * Money is kept in centavos so totals can be compared exactly. A value the
 * scanner could not read is null, and the reason is listed in the warnings.
 */
readonly class ScannedPurchaseOrderItem
{
    public function __construct(
        public int $rowNumber,
        public ?string $itemCode,
        public string $description,
        public ?int $stockOnHand,
        public ?int $quantityOrdered,
        public ?int $unitPriceCentavos,
        public ?int $amountCentavos,
    ) {}

    /**
     * @return array{row_number: int, item_code: ?string, description: string, stock_on_hand: ?int, quantity_ordered: ?int, unit_price_centavos: ?int, amount_centavos: ?int}
     */
    public function toArray(): array
    {
        return [
            'row_number' => $this->rowNumber,
            'item_code' => $this->itemCode,
            'description' => $this->description,
            'stock_on_hand' => $this->stockOnHand,
            'quantity_ordered' => $this->quantityOrdered,
            'unit_price_centavos' => $this->unitPriceCentavos,
            'amount_centavos' => $this->amountCentavos,
        ];
    }
}
