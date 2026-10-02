<?php

namespace App\Http\Requests;

use App\Enums\ProductStatus;
use App\Models\Product;
use App\Models\ProductPack;
use App\Models\ProductVariant;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * The Put on Sale pop-up: a sale price per piece (for every size and
 * color), optional sale prices for the packs students can buy, and how many
 * days the sale lasts. Each sale price must be lower than the normal one.
 * A price below the Head Office cost is allowed; the pop-up warns about it.
 */
class PutOnSaleRequest extends FormRequest
{
    public const MAX_DAYS = 90;

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'sale_price' => ['nullable', 'decimal:0,2', 'gt:0', 'max:1000000'],
            'pack_sale_prices' => ['nullable', 'array'],
            'pack_sale_prices.*' => ['nullable', 'decimal:0,2', 'gt:0', 'max:1000000'],
            'days' => ['required', 'integer', 'min:1', 'max:'.self::MAX_DAYS],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'sale_price.decimal' => 'Enter the sale price in pesos, e.g. 280 or 279.50.',
            'sale_price.gt' => 'The sale price must be more than ₱0.',
            'pack_sale_prices.*.decimal' => 'Enter the pack\'s sale price in pesos, e.g. 800.',
            'pack_sale_prices.*.gt' => 'The pack\'s sale price must be more than ₱0.',
            'days.required' => 'Enter how many days the sale lasts.',
            'days.integer' => 'Enter the number of days as a whole number.',
            'days.min' => 'A sale lasts at least 1 day.',
            'days.max' => 'A sale lasts at most '.self::MAX_DAYS.' days.',
        ];
    }

    /**
     * Only products students can buy now, with stock, can go on sale; there
     * must be at least one sale price, each lower than the normal price.
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

                $product = $this->product();

                if (! in_array($product->status, [ProductStatus::Available, ProductStatus::OnSale], true)) {
                    $validator->errors()->add('days', 'Only Available products can be put on sale. Set it to Available first.');

                    return;
                }

                if ((int) $product->variants()->sum('stock_on_hand') === 0) {
                    $validator->errors()->add('days', 'There is nothing in stock to put on sale.');

                    return;
                }

                $lowest = self::lowestPiecePrice($product);

                if ($this->piecePriceCentavos() !== null && $lowest !== null && $this->piecePriceCentavos() >= $lowest) {
                    $validator->errors()->add('sale_price', 'The sale price must be lower than ₱'.number_format($lowest / 100, 2).', the price per piece.');
                }

                foreach ($this->packSalePrices() as $packId => $price) {
                    $pack = $product->packs->firstWhere('id', $packId);

                    if (! $pack instanceof ProductPack || ! $pack->sold_to_students) {
                        $validator->errors()->add("pack_sale_prices.{$packId}", 'Choose one of the packs students can buy.');
                    } elseif ($price >= (int) $pack->price_centavos) {
                        $validator->errors()->add("pack_sale_prices.{$packId}", "The sale price of the {$pack->name} must be lower than ₱".number_format((int) $pack->price_centavos / 100, 2).'.');
                    }
                }

                if ($this->piecePriceCentavos() === null && $this->packSalePrices() === []) {
                    $validator->errors()->add($product->sold_by_piece ? 'sale_price' : 'days', 'Enter a sale price for the piece or for a pack.');
                }
            },
        ];
    }

    public function product(): Product
    {
        $product = $this->route('product');

        return $product instanceof Product ? $product->loadMissing('packs') : abort(404);
    }

    /**
     * The sale price per piece in centavos; null when not given or when the
     * product is not sold by the piece.
     */
    public function piecePriceCentavos(): ?int
    {
        $price = $this->input('sale_price');

        return ! $this->product()->sold_by_piece || $price === null || $price === ''
            ? null
            : SaveProductRequest::toCentavos((string) $price);
    }

    /**
     * Sale prices in centavos by pack id, for the packs given a price.
     *
     * @return array<int, int>
     */
    public function packSalePrices(): array
    {
        /** @var array<int|string, string|null> $prices */
        $prices = $this->input('pack_sale_prices', []);
        $centavos = [];

        foreach ($prices as $packId => $price) {
            if ($price !== null && $price !== '') {
                $centavos[(int) $packId] = SaveProductRequest::toCentavos((string) $price);
            }
        }

        return $centavos;
    }

    /**
     * The lowest normal price per piece across the product's sizes and
     * colors; null when it is not sold by the piece.
     */
    public static function lowestPiecePrice(Product $product): ?int
    {
        if (! $product->sold_by_piece) {
            return null;
        }

        $prices = $product->variants()->get()
            ->map(fn (ProductVariant $variant): ?int => $variant->price_centavos ?? $product->price_centavos)
            ->filter();

        return $prices->isEmpty() ? $product->price_centavos : (int) $prices->min();
    }
}
