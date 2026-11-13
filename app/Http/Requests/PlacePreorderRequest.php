<?php

namespace App\Http\Requests;

use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\Product;
use App\Services\Shop\BuyerLimit;
use App\Services\Stock\LowStockAlerts;
use App\Services\Stock\Units;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * A student's preorder: which sizes or colors and how many of each. It is
 * paid at the cashier with its preorder slip. Preorder products take preorders
 * until their close date; a product for sale takes them only for sizes
 * that are sold out and not marked "will not be restocked".
 *
 * Several sizes come as `items` (a list of product_variant_id + quantity);
 * one size can still come as product_variant_id + quantity.
 */
class PlacePreorderRequest extends FormRequest
{
    /** The most sizes or colors in one preorder. */
    public const MAX_ITEMS = 50;

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $variantExists = Rule::exists('product_variants', 'id')->where('product_id', $this->product()->id);

        if (! $this->hasList()) {
            return [
                'product_variant_id' => ['required', 'integer', $variantExists],
                'quantity' => ['required', 'integer', 'min:1', 'max:'.$this->mostPerItem()],
            ];
        }

        return [
            'items' => ['required', 'array', 'min:1', 'max:'.self::MAX_ITEMS],
            'items.*' => ['required', 'array'],
            'items.*.product_variant_id' => ['required', 'integer', 'distinct', $variantExists],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:'.$this->mostPerItem()],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $tooMany = BuyerLimit::message($this->mostPerItem());

        return [
            'product_variant_id.required' => 'Choose the size or color you want.',
            'product_variant_id.exists' => 'Choose one of this item\'s sizes or colors.',
            'quantity.required' => 'Enter how many you want.',
            'quantity.integer' => 'Enter a whole number.',
            'quantity.min' => 'The quantity must be at least 1.',
            'quantity.max' => $tooMany,
            'items.required' => 'Add at least one size or color.',
            'items.array' => 'Add at least one size or color.',
            'items.min' => 'Add at least one size or color.',
            'items.max' => 'A preorder can have at most '.self::MAX_ITEMS.' sizes or colors.',
            'items.*.product_variant_id.required' => 'Choose the size or color you want.',
            'items.*.product_variant_id.integer' => 'Choose one of this item\'s sizes or colors.',
            'items.*.product_variant_id.exists' => 'Choose one of this item\'s sizes or colors.',
            'items.*.product_variant_id.distinct' => 'Each size or color can be listed only once.',
            'items.*.quantity.required' => 'Enter how many you want.',
            'items.*.quantity.integer' => 'Enter a whole number.',
            'items.*.quantity.min' => 'The quantity must be at least 1.',
            'items.*.quantity.max' => $tooMany,
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

                // Preordering a size again is a new preorder: the total stays within the limit.
                foreach ($this->items() as $index => $item) {
                    $already = (int) $this->user()?->preorders()
                        ->where('product_variant_id', $item['product_variant_id'])
                        ->where('status', PreorderStatus::Active)
                        ->sum('quantity');

                    if ($already > 0 && $already + $item['quantity'] > $this->mostPerItem()) {
                        $variant = $product->variants()->findOrFail($item['product_variant_id'])->setRelation('product', $product);
                        $validator->errors()->add($this->hasList() ? "items.{$index}.quantity" : 'quantity', 'You already preordered '.Units::count($already, 'Piece')." of {$variant->displayName()}. You can get at most ".number_format($this->mostPerItem()).' of one item in all. Contact the PROWARE office to get more.');
                    }
                }

                if ($validator->errors()->isNotEmpty() || $product->acceptsPreorders()) {
                    return;
                }

                if (! LowStockAlerts::isSold($product)) {
                    $validator->errors()->add($this->hasList() ? 'items' : 'quantity', $product->preorders_close_on !== null && $product->status === ProductStatus::Preorder
                        ? "Preorders for {$product->name} closed on {$product->preorders_close_on->format('M j, Y')}."
                        : "{$product->name} is not open for preorder.");

                    return;
                }

                // A product for sale: only its sold-out sizes can be preordered.
                foreach ($this->items() as $index => $item) {
                    $variant = $product->variants()->findOrFail($item['product_variant_id'])->setRelation('product', $product);
                    $field = $this->hasList() ? "items.{$index}.product_variant_id" : 'product_variant_id';

                    if ($variant->freeToSell() > 0) {
                        $validator->errors()->add($field, "{$variant->displayName()} is in stock. Add it to your cart instead.");
                    } elseif ($variant->not_restocked_at !== null) {
                        $validator->errors()->add($field, "{$variant->displayName()} will not be restocked, so it cannot be preordered.");
                    }
                }
            },
        ];
    }

    /**
     * The sizes or colors preordered, in the order sent.
     *
     * @return list<array{product_variant_id: int, quantity: int}>
     */
    public function items(): array
    {
        if (! $this->hasList()) {
            return [[
                'product_variant_id' => $this->integer('product_variant_id'),
                'quantity' => $this->integer('quantity'),
            ]];
        }

        /** @var array<int, array{product_variant_id: int|string, quantity: int|string}> $items */
        $items = $this->input('items', []);

        return array_values(array_map(fn (array $item): array => [
            'product_variant_id' => (int) $item['product_variant_id'],
            'quantity' => (int) $item['quantity'],
        ], $items));
    }

    /** The most of one item this buyer can preorder in all (BuyerLimit). */
    public function mostPerItem(): int
    {
        return BuyerLimit::for($this->user());
    }

    public function product(): Product
    {
        $product = $this->route('product');

        return $product instanceof Product ? $product : abort(404);
    }

    private function hasList(): bool
    {
        return $this->has('items');
    }
}
