<?php

namespace App\Http\Requests;

use App\Models\DeliveryItem;
use App\Services\EstorePo\ItemCode;
use App\Services\Stock\DeliveredStock;
use App\Services\Stock\LinkedItems;
use App\Services\Stock\Units;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * How many pieces of each variant arrived, for a code shared by several
 * variants whose deliveries are not in stock yet (e.g. received before it
 * was linked). The counts must add up to everything waiting.
 */
class SplitDeliveredItemRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'item_code' => ['required', 'string', 'max:40'],
            'pieces' => ['required', 'array'],
            'pieces.*.product_variant_id' => ['required', 'integer'],
            'pieces.*.pieces' => ['nullable', 'integer', 'min:0', 'max:1000000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'pieces.*.pieces.integer' => 'Enter whole numbers.',
            'pieces.*.pieces.min' => 'A count cannot be negative.',
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

                $code = $this->itemCode();
                $variants = LinkedItems::variantsByCode([$code])->get($code);

                if ($variants === null || $variants->count() < 2) {
                    $validator->errors()->add('pieces', "{$code} is not shared by several variants.");

                    return;
                }

                if (array_diff(array_keys($this->piecesByVariant()), $variants->modelKeys()) !== []) {
                    $validator->errors()->add('pieces', 'The choices changed. Reload the page and count again.');

                    return;
                }

                $waiting = (int) DeliveryItem::query()
                    ->whereHas('purchaseOrderItem', fn (Builder $query) => $query->where('item_code', $code))
                    ->whereDoesntHave('stockMovements')
                    ->sum('quantity_received') * DeliveredStock::piecesPerUnit($code);
                $counted = array_sum($this->piecesByVariant());

                if ($counted !== $waiting) {
                    $validator->errors()->add('pieces', 'Your counts add up to '.Units::count($counted, 'Piece').', but '.Units::count($waiting, 'Piece').' arrived. Make them match.');
                }
            },
        ];
    }

    public function itemCode(): string
    {
        return (string) ItemCode::normalize((string) $this->input('item_code'));
    }

    /**
     * @return array<int, int> pieces counted by variant id
     */
    public function piecesByVariant(): array
    {
        $pieces = [];

        /** @var array<int, array{product_variant_id?: int|string, pieces?: int|string|null}> $rows */
        $rows = $this->input('pieces', []);

        foreach ($rows as $row) {
            $pieces[(int) ($row['product_variant_id'] ?? 0)] = (int) ($row['pieces'] ?? 0);
        }

        return $pieces;
    }

    /**
     * "Black 5 pcs, Red 3 pcs" for the message after saving.
     */
    public function summary(): string
    {
        $variants = LinkedItems::variantsByCode([$this->itemCode()])->get($this->itemCode());
        $parts = [];

        foreach ($variants ?? [] as $variant) {
            $pieces = $this->piecesByVariant()[$variant->id] ?? 0;

            if ($pieces > 0) {
                $parts[] = $variant->label().' '.Units::count($pieces, 'Piece');
            }
        }

        return implode(', ', $parts);
    }
}
