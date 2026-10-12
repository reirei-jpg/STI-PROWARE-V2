<?php

namespace App\Http\Requests;

use App\Models\Product;
use App\Models\ProductPack;
use App\Models\ProductVariant;
use App\Services\Shop\Cart;
use App\Services\Shop\ShopPrice;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Add to Cart: which size or color, by the piece or by one of the packs
 * students can buy, and how many. Only Available and On Sale products can
 * be added; whether there is enough stock is checked by the cart.
 */
class AddToCartRequest extends FormRequest
{
    /**
     * A very long number (e.g. 2321312312313) still counts as a number, so the
     * student is told how many are left instead of "Enter a whole number".
     */
    protected function prepareForValidation(): void
    {
        $quantity = $this->input('quantity');

        if (is_string($quantity) && preg_match('/^\d{10,}$/', $quantity) === 1) {
            $this->merge(['quantity' => '999999999']);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'product_variant_id' => [
                'required',
                'integer',
                Rule::exists('product_variants', 'id')->where('product_id', $this->product()->id),
            ],
            'product_pack_id' => [
                'nullable',
                'integer',
                Rule::exists('product_packs', 'id')->where('product_id', $this->product()->id)->where('sold_to_students', true),
            ],
            // The most allowed (stock, and at most Cart::maxPerItem()) is checked by the cart, with how many are left.
            'quantity' => ['required', 'integer', 'min:1'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'product_variant_id.required' => 'Choose the size or color you want.',
            'product_variant_id.exists' => 'Choose one of this item\'s sizes or colors.',
            'product_pack_id.exists' => 'Choose one of the packs shown.',
            'quantity.required' => 'Enter how many you want.',
            'quantity.integer' => 'Enter a whole number.',
            'quantity.min' => 'Add at least 1.',
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

                $product = $this->product();

                if (! ShopPrice::canBuy($product)) {
                    $validator->errors()->add('quantity', "{$product->name} cannot be bought right now.");

                    return;
                }

                if ($this->pack() === null && ShopPrice::perPiece($this->variant()) === null) {
                    $validator->errors()->add('product_pack_id', "{$product->name} is sold by the pack only. Choose a pack.");
                }
            },
        ];
    }

    public function product(): Product
    {
        $product = $this->route('product');

        return $product instanceof Product ? $product : abort(404);
    }

    public function variant(): ProductVariant
    {
        return ProductVariant::query()->with('product')->findOrFail($this->integer('product_variant_id'));
    }

    public function pack(): ?ProductPack
    {
        return $this->filled('product_pack_id')
            ? ProductPack::query()->findOrFail($this->integer('product_pack_id'))
            : null;
    }
}
