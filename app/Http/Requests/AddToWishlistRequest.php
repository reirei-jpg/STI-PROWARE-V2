<?php

namespace App\Http\Requests;

use App\Enums\ProductStatus;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Add to Wishlist (website and phone): an item in the store, with its size
 * and color chosen (like Add to Cart).
 */
class AddToWishlistRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            // Like Add to Cart: the size and color must be chosen first (user's decision).
            'product_variant_id' => ['required', 'integer', Rule::exists('product_variants', 'id')->where('product_id', $this->product()->id)->whereNot('status', ProductStatus::Draft->value)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'product_variant_id.required' => 'Choose the size and color first.',
            'product_variant_id.integer' => 'Choose one of this item\'s sizes or colors.',
            'product_variant_id.exists' => 'Choose one of this item\'s sizes or colors.',
        ];
    }

    /** A Draft product does not exist for buyers. */
    public function product(): Product
    {
        $product = $this->route('product');
        abort_unless($product instanceof Product && $product->status !== ProductStatus::Draft, 404);

        return $product;
    }

    public function variant(): ProductVariant
    {
        return ProductVariant::query()->findOrFail($this->integer('product_variant_id'));
    }
}
