<?php

namespace App\Http\Requests;

use App\Models\DeliveryItem;
use App\Models\PurchaseOrderItem;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * A delivery that arrived (on the day it is recorded): the Sales Invoice #
 * and Delivery Receipt # from Head Office's papers (required: they confirm
 * the delivery), and how many of each waiting item were received.
 * Receiving more than what is left of an item is refused, and so is an SI #
 * or DR # already recorded for the same purchase order (the same delivery
 * twice). Each Item Code is one size or color, so what arrives goes into
 * that one.
 */
class RecordDeliveryRequest extends FormRequest
{
    /** Letters, numbers, spaces, hyphens and slashes, e.g. SI-00123 or DR 4567/26. */
    public const PAPER_NUMBER_PATTERN = '/^[A-Za-z0-9](?:[A-Za-z0-9 \/-]*[A-Za-z0-9])?$/';

    protected function prepareForValidation(): void
    {
        foreach (['sales_invoice_number', 'delivery_receipt_number'] as $field) {
            if (is_string($this->input($field))) {
                $this->merge([$field => trim($this->input($field))]);
            }
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'sales_invoice_number' => ['bail', 'required', 'string', 'max:40', 'regex:'.self::PAPER_NUMBER_PATTERN],
            'delivery_receipt_number' => ['bail', 'required', 'string', 'max:40', 'regex:'.self::PAPER_NUMBER_PATTERN],
            'note' => ['nullable', 'string', 'max:500'],
            'stay_on_page' => ['sometimes', 'boolean'],
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
            'items.required' => 'There are no items waiting for delivery.',
            'items.*.quantity_received.integer' => 'Enter a whole number, e.g. 5.',
            'items.*.quantity_received.min' => 'The quantity cannot be negative.',
            'items.*.quantity_received.max' => 'Enter at most 1,000,000.',
            'sales_invoice_number.required' => 'Enter the SI # (Sales Invoice number) from Head Office\'s papers.',
            'sales_invoice_number.string' => 'Enter the SI # (Sales Invoice number) from Head Office\'s papers.',
            'sales_invoice_number.max' => 'The SI # (Sales Invoice number) may not be longer than 40 characters.',
            'sales_invoice_number.regex' => 'The SI # may have only letters, numbers, spaces, hyphens and slashes, e.g. SI-00123.',
            'delivery_receipt_number.required' => 'Enter the DR # (Delivery Receipt number) from Head Office\'s papers.',
            'delivery_receipt_number.string' => 'Enter the DR # (Delivery Receipt number) from Head Office\'s papers.',
            'delivery_receipt_number.max' => 'The DR # (Delivery Receipt number) may not be longer than 40 characters.',
            'delivery_receipt_number.regex' => 'The DR # may have only letters, numbers, spaces, hyphens and slashes, e.g. DR-04567.',
            'note.max' => 'The note may not be longer than 500 characters.',
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

                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                // The same papers on the same purchase order: this delivery was recorded already.
                $orderIds = $items->pluck('purchase_order_id')->unique()->values()->all();

                foreach (['sales_invoice_number' => 'SI #', 'delivery_receipt_number' => 'DR #'] as $field => $label) {
                    $earlier = self::recordedWith($field, (string) $this->input($field), $orderIds);

                    if ($earlier !== null) {
                        $validator->errors()->add($field, "{$label} {$earlier['number']} was already recorded for Order #{$earlier['order']} on {$earlier['on']}. Check the papers: this delivery may have been recorded before.");
                    }
                }
            },
        ];
    }

    /**
     * The delivery's details. It is received on the day it is recorded: the
     * stock can only be sold from then, so its Stock History and the
     * delivery show the same day (a date sent by an older app is ignored).
     *
     * @return array{received_on: string, sales_invoice_number: ?string, delivery_receipt_number: ?string, note: ?string}
     */
    public function deliveryDetails(): array
    {
        $optional = fn (string $field): ?string => is_string($this->input($field)) ? $this->input($field) : null;

        return [
            'received_on' => now()->toDateString(),
            'sales_invoice_number' => $optional('sales_invoice_number'),
            'delivery_receipt_number' => $optional('delivery_receipt_number'),
            'note' => $optional('note'),
        ];
    }

    /**
     * An earlier delivery of one of these purchase orders recorded with the
     * same SI # or DR # (capitals and spaces around it do not count).
     *
     * @param  'sales_invoice_number'|'delivery_receipt_number'  $field
     * @param  list<int>  $orderIds
     * @return array{number: string, order: string, on: string}|null
     */
    private static function recordedWith(string $field, string $number, array $orderIds): ?array
    {
        if ($number === '' || $orderIds === []) {
            return null;
        }

        $earlier = DeliveryItem::query()
            ->whereHas('purchaseOrderItem', fn (Builder $query) => $query->whereIn('purchase_order_id', $orderIds))
            ->whereHas('delivery', fn (Builder $query) => $query->whereRaw("lower(trim(coalesce({$field}, ''))) = ?", [mb_strtolower($number)]))
            ->with(['delivery', 'purchaseOrderItem.purchaseOrder'])
            ->oldest('id')
            ->first();

        if ($earlier === null) {
            return null;
        }

        return [
            'number' => (string) $earlier->delivery->{$field},
            'order' => (string) $earlier->purchaseOrderItem->purchaseOrder->order_number,
            'on' => $earlier->delivery->received_on->format('M j, Y'),
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
