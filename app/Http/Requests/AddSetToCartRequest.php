<?php

namespace App\Http\Requests;

use App\Enums\UniformSetFor;
use App\Models\ProductVariant;
use App\Models\UniformSet;
use App\Services\Shop\Cart;
use App\Services\Shop\ShopPrice;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * A student adds a uniform set to the cart: for boys or girls, the size of
 * the top, the bottom (for girls: the ladies' pants or the skirt) and its
 * size, and how many sets. Stock is checked by the cart.
 */
class AddSetToCartRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'for' => ['required', Rule::enum(UniformSetFor::class)],
            'top_variant_id' => ['required', 'integer', Rule::exists('product_variants', 'id')],
            'bottom_variant_id' => ['required', 'integer', Rule::exists('product_variants', 'id')],
            'quantity' => ['required', 'integer', 'min:1', 'max:'.Cart::MAX_QUANTITY],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'for.required' => 'Choose For Boys or For Girls.',
            'for.enum' => 'Choose For Boys or For Girls.',
            'top_variant_id.required' => 'Choose the size of the top.',
            'top_variant_id.exists' => 'Choose one of the sizes shown.',
            'bottom_variant_id.required' => 'Choose the bottom and its size.',
            'bottom_variant_id.exists' => 'Choose one of the sizes shown.',
            'quantity.required' => 'Enter how many sets you want.',
            'quantity.integer' => 'Enter a whole number.',
            'quantity.min' => 'The quantity must be at least 1.',
            'quantity.max' => 'For more than '.Cart::MAX_QUANTITY.', contact the PROWARE office.',
        ];
    }

    /**
     * The sizes must be of this set's top and of one of its bottoms for boys
     * or girls, and the set must be for sale.
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

                $set = $this->uniformSet();
                $for = $this->for();

                if (! $set->sellsFor($for)) {
                    $validator->errors()->add('for', "The {$set->displayName()} is not sold {$this->forWords($for)}.");

                    return;
                }

                if ($this->top()->product_id !== $set->topForSale($for)) {
                    $validator->errors()->add('top_variant_id', 'Choose one of the sizes shown for the top.');
                }

                if (! in_array($this->bottom()->product_id, $set->bottomsForSale($for), true)) {
                    $validator->errors()->add('bottom_variant_id', 'Choose one of the bottoms shown and its size.');
                }

                $top = $this->top();
                $bottom = $this->bottom();

                if ($validator->errors()->isEmpty() && (! ShopPrice::canBuy($top->product) || ! ShopPrice::canBuy($bottom->product)
                    || ShopPrice::perPiece($top) === null || ShopPrice::perPiece($bottom) === null)) {
                    $validator->errors()->add('for', "The {$set->displayName()} is not for sale right now.");
                }
            },
        ];
    }

    public function uniformSet(): UniformSet
    {
        $set = $this->route('uniformSet');

        return $set instanceof UniformSet ? $set : abort(404);
    }

    public function for(): UniformSetFor
    {
        return UniformSetFor::from((string) $this->input('for'));
    }

    public function top(): ProductVariant
    {
        return ProductVariant::query()->with('product')->findOrFail($this->integer('top_variant_id'));
    }

    public function bottom(): ProductVariant
    {
        return ProductVariant::query()->with('product')->findOrFail($this->integer('bottom_variant_id'));
    }

    private function forWords(UniformSetFor $for): string
    {
        return $for === UniformSetFor::Boys ? 'for boys' : 'for girls';
    }
}
