<?php

namespace App\Actions\Deliveries;

use App\Models\Delivery;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\User;
use App\Services\Stock\DeliveredStock;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Records a delivery: what arrived for each ordered item, then updates each
 * affected order's progress and status. The expected delivery date of those
 * orders is cleared, since that delivery has now happened; the Specialist
 * sets a new one when Head Office calls about the rest.
 *
 * Items whose eStore Item Code is linked to a product are added to stock
 * right away; the others wait until the Specialist links them.
 */
class RecordDelivery
{
    public function __construct(private DeliveredStock $deliveredStock) {}

    /**
     * @param  array{received_on: string, sales_invoice_number?: ?string, delivery_receipt_number?: ?string, note?: ?string}  $details
     * @param  array<int, int>  $quantities  quantity received by ordered item id
     */
    public function handle(User $recordedBy, array $details, array $quantities): Delivery
    {
        return DB::transaction(function () use ($recordedBy, $details, $quantities): Delivery {
            // Lock the items so two people recording at once cannot both
            // receive the same remaining quantity.
            $items = PurchaseOrderItem::query()
                ->with('purchaseOrder')
                ->whereKey(array_keys($quantities))
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            foreach ($quantities as $itemId => $quantity) {
                $item = $items->get($itemId);

                if ($item === null || ! $item->purchaseOrder->delivery_status->isOpen() || $quantity > $item->quantityRemaining()) {
                    throw ValidationException::withMessages([
                        'items' => 'Some quantities changed while you were typing. Please check them again.',
                    ]);
                }
            }

            $delivery = Delivery::create([
                'received_on' => $details['received_on'],
                'sales_invoice_number' => $this->blankToNull($details['sales_invoice_number'] ?? null),
                'delivery_receipt_number' => $this->blankToNull($details['delivery_receipt_number'] ?? null),
                'note' => $this->blankToNull($details['note'] ?? null),
                'recorded_by' => $recordedBy->id,
            ]);

            foreach ($quantities as $itemId => $quantity) {
                $delivery->items()->create([
                    'purchase_order_item_id' => $itemId,
                    'quantity_received' => $quantity,
                ]);

                $items->get($itemId)?->increment('quantity_delivered', $quantity);
            }

            $orderIds = $items->pluck('purchase_order_id')->unique()->values();

            foreach (PurchaseOrder::query()->whereKey($orderIds)->get() as $order) {
                $order->clearExpectedDelivery();
                $order->refreshDeliveryProgress();
            }

            $this->deliveredStock->add($delivery->items()->get(), $recordedBy);

            return $delivery;
        });
    }

    private function blankToNull(?string $value): ?string
    {
        return $value === null || trim($value) === '' ? null : trim($value);
    }
}
