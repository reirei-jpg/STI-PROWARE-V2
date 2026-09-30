<?php

namespace App\Notifications;

use App\Models\PurchaseOrder;
use Illuminate\Notifications\Notification;

/**
 * Tells the School Admin, inside PROWARE, that the Specialist uploaded a
 * purchase order, so they can see what was ordered without waiting for
 * or digging through eStore emails.
 */
class PurchaseOrderUploaded extends Notification
{
    public function __construct(public PurchaseOrder $purchaseOrder) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array{kind: string, purchase_order_id: int, order_number: ?string, uploaded_by: string, date_ordered: string, total_amount_centavos: ?int, items_count: int}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'purchase_order_uploaded',
            'purchase_order_id' => $this->purchaseOrder->id,
            'order_number' => $this->purchaseOrder->order_number,
            'uploaded_by' => $this->purchaseOrder->uploader->name,
            'date_ordered' => $this->purchaseOrder->date_ordered->toDateString(),
            'total_amount_centavos' => $this->purchaseOrder->total_amount_centavos,
            'items_count' => $this->purchaseOrder->items()->count(),
        ];
    }
}
