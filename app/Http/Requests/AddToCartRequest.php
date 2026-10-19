<?php

namespace App\Http\Requests;

use App\Models\Product;
use App\Models\ProductPack;
use App\Models\ProductVariant;
use App\Services\Shop\ShopPrice;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Add to Cart: which sizes or colors, each by the piece or by one of the
 * packs students can buy, and how many. Only Available and On Sale products
 * can be added; whether there is enough stock is checked by the cart.
 *
 * Several lines come as `items` (a list of product_variant_id,
 * product_pack_id and quantity); one line can still come as those three
 * fields.
 */
class AddToCartRequest extends FormRequest
{
    /** The most lines added at once. */
    public const MAX_ITEMS = 50;

    /**
     * A very long number (e.g. 2321312312313) still counts as a number, so the
     * student is told how many are left instead of "Enter a whole number".
     */
    protected function prepareForValidation(): void
    {
        $shorten = fn (mixed $quantity): mixed => is_string($quantity) && preg_match('/^\d{10,}$/', $quantity) === 1 ? '999999999' : $quantity;

        if (! $this->hasList()) {
            $this->merge(['quantity' => $shorten($this->input('quantity'))]);

            return;
        }

        $items = $this->input('items');

        if (is_array($items)) {
            $this->merge(['items' => array_map(
                fn (mixed $item): mixed => is_array($item) ? [...$item, 'quantity' => $shorten($item['quantity'] ?? null)] : $item,
                $items,
            )]);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $variantExists = Rule::exists('product_variants', 'id')->where('product_id', $this->product()->id);
        $packExists = Rule::exists('product_packs', 'id')->where('product_id', $this->product()->id)->where('sold_to_students', true);

        if (! $this->hasList()) {
            return [
                'product_variant_id' => ['required', 'integer', $variantExists],
                'product_pack_id' => ['nullable', 'integer', $packExists],
                // The most allowed (stock, and at most Cart::MAX_QUANTITY) is checked by the cart, with how many are left.
                'quantity' => ['required', 'integer', 'min:1'],
            ];
        }

        return [
            'items' => ['required', 'array', 'min:1', 'max:'.self::MAX_ITEMS],
            'items.*' => ['required', 'array'],
            'items.*.product_variant_id' => ['required', 'integer', $variantExists],
            'items.*.product_pack_id' => ['nullable', 'integer', $packExists],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
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
            'quantity.min' => 'The quantity must be at least 1.',
            'items.required' => 'Add at least one size or color.',
            'items.array' => 'Add at least one size or color.',
            'items.min' => 'Add at least one size or color.',
            'items.max' => 'At most '.self::MAX_ITEMS.' lines can be added at once.',
            'items.*.product_variant_id.required' => 'Choose the size or color you want.',
            'items.*.product_variant_id.integer' => 'Choose one of this item\'s sizes or colors.',
            'items.*.product_variant_id.exists' => 'Choose one of this item\'s sizes or colors.',
            'items.*.product_pack_id.integer' => 'Choose one of the packs shown.',
            'items.*.product_pack_id.exists' => 'Choose one of the packs shown.',
            'items.*.quantity.required' => 'Enter how many you want.',
            'items.*.quantity.integer' => 'Enter a whole number.',
            'items.*.quantity.min' => 'The quantity must be at least 1.',
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
                    $validator->errors()->add($this->hasList() ? 'items' : 'quantity', "{$product->name} cannot be bought right now.");

                    return;
                }

                foreach ($this->lines() as $index => $line) {
                    if ($line['pack'] === null && ShopPrice::perPiece($line['variant']) === null) {
                        $validator->errors()->add($this->fieldFor($index, 'product_pack_id'), "{$product->name} is sold by the pack only. Choose a pack.");
                    }
                }
            },
        ];
    }

    public function product(): Product
    {
        $product = $this->route('product');

        return $product instanceof Product ? $product : abort(404);
    }

    /**
     * The lines to add, in the order sent.
     *
     * @return list<array{variant: ProductVariant, pack: ProductPack|null, quantity: int}>
     */
    public function lines(): array
    {
        /** @var array<int, array{product_variant_id: int|string, product_pack_id?: int|string|null, quantity: int|string}> $items */
        $items = $this->hasList()
            ? $this->input('items', [])
            : [$this->only(['product_variant_id', 'product_pack_id', 'quantity'])];

        return array_values(array_map(fn (array $item): array => [
            'variant' => ProductVariant::query()->with('product')->findOrFail((int) $item['product_variant_id']),
            'pack' => isset($item['product_pack_id']) && $item['product_pack_id'] !== ''
                ? ProductPack::query()->findOrFail((int) $item['product_pack_id'])
                : null,
            'quantity' => (int) $item['quantity'],
        ], $items));
    }

    /**
     * Where a problem with line $index is shown: "items.1.quantity", or
     * "quantity" when one line was sent on its own.
     */
    public function fieldFor(int $index, string $field): string
    {
        return $this->hasList() ? "items.{$index}.{$field}" : $field;
    }

    private function hasList(): bool
    {
        return $this->has('items');
    }
}
