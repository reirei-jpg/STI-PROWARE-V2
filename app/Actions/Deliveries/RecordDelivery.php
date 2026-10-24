<?php

namespace App\Actions\Deliveries;

use App\Enums\DeliveryStatus;
use App\Enums\UserRole;
use App\Models\Delivery;
use App\Models\DeliveryItem;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\User;
use App\Notifications\PurchaseOrderCompleted;
use App\Services\Stock\DeliveredStock;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

/**
 * Records a delivery: what arrived for each ordered item, then updates each
 * affected order's progress and status.
 *
 * Items whose eStore Item Code is linked to a product are added to stock
 * right away; the others wait until the Specialist links them. An item
 * shared by several variants goes into each variant as counted. When the
 * delivery brings an order's last pieces, the School Admin is told the
 * order is completed.
 */
class RecordDelivery
{
    public function __construct(private DeliveredStock $deliveredStock) {}

    /**
     * @param  array{received_on: string, sales_invoice_number?: ?string, delivery_receipt_number?: ?string, note?: ?string}  $details
     * @param  array<int, int>  $quantities  quantity received by ordered item id
     * @param  array<string, array<int, int>>  $splitsByCode  for codes shared by several variants: pieces by variant id
     */
    public function handle(User $recordedBy, array $details, array $quantities, array $splitsByCode = []): Delivery
    {
        $completed = [];
        $delivery = $this->record($recordedBy, $details, $quantities, $splitsByCode, $completed);

        if ($completed !== []) {
            $schoolAdmins = User::query()->where('role', UserRole::SchoolAdmin)->get();
            $delivery->load('recorder');

            foreach ($completed as $order) {
                Notification::send($schoolAdmins, new PurchaseOrderCompleted($order, $delivery));
            }
        }

        return $delivery;
    }

    /**
     * @param  array{received_on: string, sales_invoice_number?: ?string, delivery_receipt_number?: ?string, note?: ?string}  $details
     * @param  array<int, int>  $quantities
     * @param  array<string, array<int, int>>  $splitsByCode
     * @param  list<PurchaseOrder>  $completed  filled with the orders this delivery completed
     */
    private function record(User $recordedBy, array $details, array $quantities, array $splitsByCode, array &$completed): Delivery
    {
        return DB::transaction(function () use ($recordedBy, $details, $quantities, $splitsByCode, &$completed): Delivery {
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
                        'items' => 'Some quantities changed while you were typing. Check them again.',
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
                $order->refreshDeliveryProgress();

                if ($order->delivery_status === DeliveryStatus::Completed) {
                    $completed[] = $order;
                }
            }

            $deliveryItems = $delivery->items()->with('purchaseOrderItem')->orderBy('id')->get();
            $splits = [];

            foreach ($splitsByCode as $code => $piecesByVariant) {
                $splits += DeliveredStock::allocate(
                    $deliveryItems->filter(fn (DeliveryItem $item): bool => $item->purchaseOrderItem->item_code === $code),
                    $piecesByVariant,
                    DeliveredStock::piecesPerUnit($code),
                );
            }

            $this->deliveredStock->add($deliveryItems, $recordedBy, $splits);

            return $delivery;
        });
    }

    private function blankToNull(?string $value): ?string
    {
        return $value === null || trim($value) === '' ? null : trim($value);
    }
}
