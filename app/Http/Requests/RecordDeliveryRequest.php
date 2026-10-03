<?php

namespace App\Http\Requests;

use App\Models\PurchaseOrderItem;
use App\Services\EstorePo\ItemCode;
use App\Services\Stock\LinkedItems;
use App\Services\Stock\Units;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * A delivery that arrived: when, the optional Sales Invoice # and Delivery
 * Receipt #, and how many of each waiting item were received. Receiving
 * more than what is left of an item is refused. For an item shared by
 * several variants (e.g. every color), the pieces counted for each variant
 * must add up to what is received.
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
            'splits' => ['nullable', 'array'],
            'splits.*.item_code' => ['required', 'string', 'max:40'],
            'splits.*.pieces' => ['present', 'array'],
            'splits.*.pieces.*.product_variant_id' => ['required', 'integer'],
            'splits.*.pieces.*.pieces' => ['nullable', 'integer', 'min:0', 'max:1000000'],
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
            'splits.*.pieces.*.pieces.integer' => 'Enter whole numbers.',
            'splits.*.pieces.*.pieces.min' => 'A count cannot be negative.',
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

                $this->validateSplits($validator, $items->all(), $received);
            },
        ];
    }

    /**
     * An item whose code is shared by several variants (e.g. every color)
     * needs the pieces counted for each variant, adding up to what is
     * received for it.
     *
     * @param  array<int, PurchaseOrderItem>  $items  by id
     * @param  array<int, int>  $received  quantity by ordered item id
     */
    private function validateSplits(Validator $validator, array $items, array $received): void
    {
        $unitsByCode = [];

        foreach ($received as $itemId => $quantity) {
            $code = $items[$itemId]->item_code ?? null;

            if ($code !== null) {
                $unitsByCode[$code] = ($unitsByCode[$code] ?? 0) + $quantity;
            }
        }

        $splits = $this->splitsByCode();
        $variantsByCode = LinkedItems::variantsByCode(array_unique([...array_keys($unitsByCode), ...array_keys($splits)]));
        $indexByCode = array_flip(array_keys($splits));

        foreach ($variantsByCode as $code => $variants) {
            if ($variants->count() < 2) {
                continue;
            }

            $key = isset($indexByCode[$code]) ? "splits.{$indexByCode[$code]}" : 'items';
            $counted = $splits[$code] ?? [];
            $piecesPerUnit = $variants->firstOrFail()->estorePack->pieces ?? 1;
            $unitName = $variants->firstOrFail()->estorePack->name ?? 'Piece';
            $arriving = ($unitsByCode[$code] ?? 0) * $piecesPerUnit;
            $countedPieces = array_sum($counted);

            if (array_diff(array_keys($counted), $variants->modelKeys()) !== []) {
                $validator->errors()->add($key, "The choices for {$code} changed. Reload the page and count again.");
            } elseif ($arriving === 0 && $countedPieces === 0) {
                continue;
            } elseif ($arriving > 0 && $countedPieces === 0) {
                $validator->errors()->add($key, "{$code} is shared by several variants. Enter how many of each arrived.");
            } elseif ($countedPieces % $piecesPerUnit !== 0) {
                $validator->errors()->add($key, 'Your counts add up to '.Units::count($countedPieces, 'Piece').", but Head Office sends this by the {$unitName} of {$piecesPerUnit} pcs, so the total must be a multiple of {$piecesPerUnit}.");
            } elseif ($countedPieces !== $arriving) {
                $validator->errors()->add($key, 'Your counts add up to '.Units::count($countedPieces, 'Piece').', but the orders below receive '.Units::count($arriving, 'Piece').'. Make them match.');
            }
        }
    }

    /**
     * The pieces counted for each variant of a shared code, by code.
     *
     * @return array<string, array<int, int>> pieces by variant id
     */
    public function splitsByCode(): array
    {
        $splits = [];

        /** @var array<int, array{item_code?: string, pieces?: array<int, array{product_variant_id?: int|string, pieces?: int|string|null}>}> $rows */
        $rows = $this->input('splits', []);

        foreach ($rows as $row) {
            $code = ItemCode::normalize($row['item_code'] ?? null);

            if ($code === null) {
                continue;
            }

            $splits[$code] ??= [];

            foreach ($row['pieces'] ?? [] as $count) {
                $splits[$code][(int) ($count['product_variant_id'] ?? 0)] = (int) ($count['pieces'] ?? 0);
            }
        }

        return $splits;
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
