<?php

namespace App\Http\Requests;

use App\Enums\ProductStatus;
use App\Models\Product;
use App\Models\ProductPack;
use App\Models\ProductVariant;
use App\Services\Sales\HeadOfficeCost;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * The Put on Sale pop-up: sale prices per piece, optional sale prices for
 * the packs students can buy, and how many days the sale lasts.
 *
 * Variants with the same normal price share one sale price (e.g. every
 * color of an umbrella). When their normal prices differ (e.g. S ₱300, XL
 * ₱350), each price gets its own sale price, and an empty one leaves those
 * variants at their normal price. Each sale price must be lower than the
 * normal one. A price below the Head Office cost is allowed; the pop-up
 * warns about it.
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
            'group_sale_prices' => ['nullable', 'array'],
            'group_sale_prices.*' => ['nullable', 'decimal:0,2', 'gt:0', 'max:1000000'],
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
            'group_sale_prices.*.decimal' => 'Enter the sale price in pesos, e.g. 280 or 279.50.',
            'group_sale_prices.*.gt' => 'The sale price must be more than ₱0.',
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

                $groups = self::priceGroups($product);

                foreach ($this->groupSalePrices() as $normal => $sale) {
                    if (! array_key_exists($normal, $groups)) {
                        $validator->errors()->add("group_sale_prices.{$normal}", 'The prices changed. Close this and open Put on Sale again.');
                    } elseif ($sale >= $normal) {
                        $validator->errors()->add("group_sale_prices.{$normal}", 'The sale price must be lower than ₱'.number_format($normal / 100, 2).', their normal price.');
                    }
                }

                foreach ($this->packSalePrices() as $packId => $price) {
                    $pack = $product->packs->firstWhere('id', $packId);

                    if (! $pack instanceof ProductPack || ! $pack->sold_to_students) {
                        $validator->errors()->add("pack_sale_prices.{$packId}", 'Choose one of the packs students can buy.');
                    } elseif ($price >= (int) $pack->price_centavos) {
                        $validator->errors()->add("pack_sale_prices.{$packId}", "The sale price of the {$pack->name} must be lower than ₱".number_format((int) $pack->price_centavos / 100, 2).'.');
                    }
                }

                if ($this->piecePriceCentavos() === null && $this->groupSalePrices() === [] && $this->packSalePrices() === []) {
                    $validator->errors()->add($product->sold_by_piece ? 'sale_price' : 'days', 'Enter a sale price for the piece or for a pack.');
                }

                $this->refuseBelowCost($validator, $product);
            },
        ];
    }

    /**
     * Nothing is sold below its Cost (what PROWARE paid on the eStore order),
     * not even on sale.
     */
    private function refuseBelowCost(Validator $validator, Product $product): void
    {
        $cost = app(HeadOfficeCost::class)->perPiece($product);

        if ($cost === null || $validator->errors()->isNotEmpty()) {
            return;
        }

        $tooLow = fn (int $price, int $pieces = 1): bool => $price < $cost * $pieces;
        $message = fn (int $pieces = 1, string $unit = 'piece'): string => 'The sale price cannot be below the Cost of ₱'.number_format($cost * $pieces / 100, 2)." per {$unit} (what PROWARE paid on the eStore order).";

        if ($this->piecePriceCentavos() !== null && $tooLow($this->piecePriceCentavos())) {
            $validator->errors()->add('sale_price', $message());
        }

        foreach ($this->groupSalePrices() as $normal => $sale) {
            if ($tooLow($sale)) {
                $validator->errors()->add("group_sale_prices.{$normal}", $message());
            }
        }

        foreach ($this->packSalePrices() as $packId => $price) {
            $pack = $product->packs->firstWhere('id', $packId);

            if ($pack instanceof ProductPack && $tooLow($price, $pack->pieces)) {
                $validator->errors()->add("pack_sale_prices.{$packId}", $message($pack->pieces, $pack->name));
            }
        }
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
     * Sale prices in centavos by the normal price they lower, for products
     * whose variants have different normal prices; empty ones are left out.
     *
     * @return array<int, int>
     */
    public function groupSalePrices(): array
    {
        if (! $this->product()->sold_by_piece) {
            return [];
        }

        /** @var array<int|string, string|null> $prices */
        $prices = $this->input('group_sale_prices', []);
        $centavos = [];

        foreach ($prices as $normal => $price) {
            if ($price !== null && $price !== '') {
                $centavos[(int) $normal] = SaveProductRequest::toCentavos((string) $price);
            }
        }

        return $centavos;
    }

    /**
     * The product's variants by their normal price per piece, lowest first.
     * One group: every variant costs the same (e.g. every color). Several:
     * sizes with their own prices. Empty when not sold by the piece.
     *
     * @return array<int, list<ProductVariant>>
     */
    public static function priceGroups(Product $product): array
    {
        if (! $product->sold_by_piece) {
            return [];
        }

        $groups = [];

        foreach ($product->variants()->with('product')->get() as $variant) {
            $normal = $variant->normalPiecePrice();

            if ($normal !== null) {
                $groups[$normal][] = $variant;
            }
        }

        ksort($groups);

        return $groups;
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
