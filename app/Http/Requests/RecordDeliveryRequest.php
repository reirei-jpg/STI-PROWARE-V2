<?php

namespace App\Http\Requests;

use App\Models\PurchaseOrderItem;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * A delivery that arrived: when, the optional Sales Invoice # and Delivery
 * Receipt #, and how many of each waiting item were received. Receiving
 * more than what is left of an item is refused.
 */
class RecordDeliveryRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'received_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'sales_invoice_number' => ['nullable', 'string', 'max:40'],
            'delivery_receipt_number' => ['nullable', 'string', 'max:40'],
            'note' => ['nullable', 'string', 'max:500'],
            'items' => ['required', 'array'],
            'items.*.purchase_order_item_id' => ['required', 'integer', 'distinct', 'exists:purchase_order_items,id'],
            'items.*.quantity_received' => ['nullable', 'integer', 'min:0', 'max:1000000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'received_on.required' => 'Choose the date the delivery arrived.',
            'received_on.date_format' => 'Choose a valid date.',
            'received_on.before_or_equal' => 'The date received cannot be in the future.',
            'items.required' => 'There are no items waiting for delivery.',
            'items.*.quantity_received.integer' => 'Enter a whole number.',
            'items.*.quantity_received.min' => 'The quantity cannot be negative.',
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $received = $this->receivedQuantities();

                if ($received === []) {
                    $validator->errors()->add('items', 'Enter how many arrived for at least one item.');

                    return;
                }

                $items = PurchaseOrderItem::query()
                    ->with('purchaseOrder')
                    ->findMany(array_keys($received))
                    ->keyBy('id');

                foreach ($this->input('items', []) as $index => $row) {
                    $itemId = (int) ($row['purchase_order_item_id'] ?? 0);
                    $quantity = $received[$itemId] ?? 0;
                    $item = $items->get($itemId);

                    if ($quantity === 0 || $item === null) {
                        continue;
                    }

                    $order = $item->purchaseOrder;

                    if (! $order->delivery_status->isOpen()) {
                        $validator->errors()->add("items.{$index}.quantity_received", "Order #{$order->order_number} is already {$order->delivery_status->label()}.");
                    } elseif ($quantity > $item->quantityRemaining()) {
                        $validator->errors()->add("items.{$index}.quantity_received", "Only {$item->quantityRemaining()} left to receive for Order #{$order->order_number}.");
                    }
                }
            },
        ];
    }

    /**
     * @return array{received_on: string, sales_invoice_number: ?string, delivery_receipt_number: ?string, note: ?string}
     */
    public function deliveryDetails(): array
    {
        $optional = fn (string $field): ?string => is_string($this->input($field)) ? $this->input($field) : null;

        return [
            'received_on' => (string) $this->input('received_on'),
            'sales_invoice_number' => $optional('sales_invoice_number'),
            'delivery_receipt_number' => $optional('delivery_receipt_number'),
            'note' => $optional('note'),
        ];
    }

    /**
     * The quantities entered above zero, by ordered item.
     *
     * @return array<int, int>
     */
    public function receivedQuantities(): array
    {
        $received = [];

        /** @var array<int, array{purchase_order_item_id?: int|string, quantity_received?: int|string|null}> $rows */
        $rows = $this->input('items', []);

        foreach ($rows as $row) {
            $quantity = (int) ($row['quantity_received'] ?? 0);

            if ($quantity > 0) {
                $received[(int) ($row['purchase_order_item_id'] ?? 0)] = $quantity;
            }
        }

        return $received;
    }
}
