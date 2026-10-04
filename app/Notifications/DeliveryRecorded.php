<?php

namespace App\Notifications;

use App\Models\Delivery;
use App\Models\DeliveryItem;
use Illuminate\Notifications\Notification;

/**
 * Tells the School Admin that the Specialist recorded a delivery from Head
 * Office: which orders it was for, how much arrived, the SI # and DR #, and
 * who recorded it, so every arrival can be traced.
 */
class DeliveryRecorded extends Notification
{
    public function __construct(public Delivery $delivery) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array{kind: string, delivery_id: int, purchase_order_id: int|null, order_numbers: list<string>, received_on: string, sales_invoice_number: string|null, delivery_receipt_number: string|null, recorded_by: string, items_count: int, quantity_received: int}
     */
    public function toArray(object $notifiable): array
    {
        $items = $this->delivery->items()->with('purchaseOrderItem.purchaseOrder')->orderBy('id')->get();
        $orders = $items->map(fn (DeliveryItem $item) => $item->purchaseOrderItem->purchaseOrder)->unique('id')->values();

        return [
            'kind' => 'delivery_recorded',
            'delivery_id' => $this->delivery->id,
            'purchase_order_id' => $orders->first()?->id,
            'order_numbers' => array_values($orders->pluck('order_number')->filter()->all()),
            'received_on' => $this->delivery->received_on->toDateString(),
            'sales_invoice_number' => $this->delivery->sales_invoice_number,
            'delivery_receipt_number' => $this->delivery->delivery_receipt_number,
            'recorded_by' => $this->delivery->recorder->name,
            'items_count' => $items->count(),
            'quantity_received' => (int) $items->sum('quantity_received'),
        ];
    }
}
