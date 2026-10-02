<?php

namespace App\Http\Requests;

use App\Models\ProductPack;
use App\Models\ProductVariant;
use App\Models\PurchaseOrderItem;
use App\Services\EstorePo\ItemCode;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Link an eStore item to a product variant from Items to Link: which
 * variant it is, and whether Head Office sends it by the piece, by one of
 * the product's packs, or by a new pack typed here.
 */
class LinkItemRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'item_code' => ['required', 'string', 'max:40'],
            'product_variant_id' => ['required', 'integer', 'exists:product_variants,id'],
            'sent_by' => ['required', 'in:piece,pack,new_pack'],
            'pack_id' => ['required_if:sent_by,pack', 'nullable', 'integer'],
            'new_pack_name' => ['required_if:sent_by,new_pack', 'nullable', 'string', 'max:30'],
            'new_pack_pieces' => ['required_if:sent_by,new_pack', 'nullable', 'integer', 'min:2', 'max:100000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'product_variant_id.required' => 'Choose the product and variant this item is.',
            'product_variant_id.exists' => 'That product variant no longer exists. Choose again.',
            'sent_by.required' => 'Choose how Head Office sends this item.',
            'pack_id.required_if' => 'Choose the pack Head Office sends it in.',
            'new_pack_name.required_if' => 'Name the pack, e.g. Pack or Box.',
            'new_pack_pieces.required_if' => 'Enter how many pieces are in one pack.',
            'new_pack_pieces.integer' => 'Enter the number of pieces as a whole number.',
            'new_pack_pieces.min' => 'A pack has at least 2 pieces.',
        ];
    }

    /**
     * The code must be on an uploaded order and not linked yet, the variant
     * must not have another code, and the pack must belong to the product.
     *
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

                if (! PurchaseOrderItem::query()->where('item_code', $code)->exists()) {
                    $validator->errors()->add('item_code', "No uploaded order has the eStore Item Code {$code}.");

                    return;
                }

                $linked = ProductVariant::query()->with('product')->where('estore_item_code', $code)->first();

                if ($linked !== null) {
                    $validator->errors()->add('item_code', "{$code} is already linked to {$linked->displayName()}.");

                    return;
                }

                $variant = $this->variant();

                if ($variant->estore_item_code !== null) {
                    $validator->errors()->add('product_variant_id', "This variant already has the eStore Item Code {$variant->estore_item_code}. Choose another variant.");
                }

                if ($this->input('sent_by') === 'pack' && ! $variant->product->packs()->whereKey((int) $this->input('pack_id'))->exists()) {
                    $validator->errors()->add('pack_id', 'Choose one of this product\'s packs.');
                }

                if ($this->input('sent_by') === 'new_pack') {
                    $this->validateNewPack($validator, $variant);
                }
            },
        ];
    }

    public function itemCode(): string
    {
        return (string) ItemCode::normalize((string) $this->input('item_code'));
    }

    public function variant(): ProductVariant
    {
        return ProductVariant::query()->with('product')->findOrFail((int) $this->input('product_variant_id'));
    }

    public function newPackName(): string
    {
        return trim((string) $this->input('new_pack_name'));
    }

    private function validateNewPack(Validator $validator, ProductVariant $variant): void
    {
        $name = mb_strtolower($this->newPackName());

        if (in_array($name, ['piece', 'pieces', 'pc', 'pcs'], true)) {
            $validator->errors()->add('new_pack_name', 'Stock is already counted by the piece. Name the pack something else, e.g. Pack or Box.');

            return;
        }

        $packs = $variant->product->packs()->get();

        if ($packs->contains(fn (ProductPack $pack): bool => mb_strtolower($pack->name) === $name)) {
            $validator->errors()->add('new_pack_name', 'This product already has a pack with that name. Choose it instead.');
        } elseif ($packs->count() >= SaveProductRequest::MAX_PACKS) {
            $validator->errors()->add('new_pack_name', 'This product already has '.SaveProductRequest::MAX_PACKS.' packs. Choose one of them.');
        }
    }
}
