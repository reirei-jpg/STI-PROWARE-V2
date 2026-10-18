<?php

namespace App\Services\Storefront;

use App\Enums\UniformSetFor;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\UniformSet;
use App\Services\Shop\ShopPrice;
use Illuminate\Support\Collection;

/**
 * The Uniform Sets section of the storefront (website and phone app): each
 * course's set students can buy whole, at its set price. For boys: the polo
 * and the pants; for girls: the blouse and the ladies' pants or the skirt.
 * Each piece lists its sizes with what is left, so the picker can offer
 * only sizes in stock (a sold-out size is preordered on the item itself).
 *
 * @phpstan-type SetPiece array{product_id: int, name: string, kind: string, sizes: list<array{variant_id: int, label: string, price_centavos: int|null, stock_pieces: int, can_preorder: bool}>}
 */
final class StorefrontUniformSets
{
    /**
     * Sets with a set price whose pieces can be bought now, by name.
     *
     * @return list<array{id: int, name: string, price_centavos: int, photo_url: string|null, options: list<array{for: string, label: string, top: SetPiece, bottoms: list<SetPiece>}>}>
     */
    public static function all(): array
    {
        $sets = UniformSet::query()
            ->whereNotNull('set_price_centavos')
            ->orderBy('name')
            ->get();
        $products = Product::query()
            ->with(['mainPhoto', 'variants'])
            ->whereKey($sets->flatMap(fn (UniformSet $set): array => [
                $set->polo_product_id, $set->blouse_product_id, $set->pants_product_id, $set->ladies_pants_product_id, $set->skirt_product_id,
            ])->filter()->unique()->values()->all())
            ->get()
            ->keyBy('id');

        $shown = [];

        foreach ($sets as $set) {
            $options = [];

            foreach (UniformSetFor::cases() as $for) {
                $option = self::option($set, $for, $products);

                if ($option !== null) {
                    $options[] = $option;
                }
            }

            if ($options === []) {
                continue;
            }

            $photoProduct = $products->get($set->polo_product_id) ?? $products->get($set->blouse_product_id);

            $shown[] = [
                'id' => $set->id,
                'name' => $set->displayName(),
                'price_centavos' => (int) $set->set_price_centavos,
                'photo_url' => $photoProduct?->mainPhoto?->url(),
                'options' => $options,
            ];
        }

        return $shown;
    }

    /**
     * The set for boys or girls, when its top and at least one bottom can be
     * bought now.
     *
     * @param  Collection<int, Product>  $products  by id
     * @return array{for: string, label: string, top: SetPiece, bottoms: list<SetPiece>}|null
     */
    private static function option(UniformSet $set, UniformSetFor $for, Collection $products): ?array
    {
        if (! $set->sellsFor($for)) {
            return null;
        }

        $top = $products->get($set->topForSale($for));
        $bottoms = array_values(array_filter(
            array_map(fn (int $productId): ?Product => $products->get($productId), $set->bottomsForSale($for)),
            fn (?Product $product): bool => $product !== null && ShopPrice::canBuy($product),
        ));

        if ($top === null || ! ShopPrice::canBuy($top) || $bottoms === []) {
            return null;
        }

        return [
            'for' => $for->value,
            'label' => $for->label(),
            'top' => self::piece($top, $for === UniformSetFor::Boys ? 'Polo' : 'Blouse'),
            'bottoms' => array_map(fn (Product $bottom): array => self::piece($bottom, match ($bottom->id) {
                $set->skirt_product_id => 'Skirt',
                $set->ladies_pants_product_id => "Ladies' Pants",
                default => 'Pants',
            }), $bottoms),
        ];
    }

    /**
     * @return SetPiece
     */
    private static function piece(Product $product, string $kind): array
    {
        return [
            'product_id' => $product->id,
            'name' => $product->name,
            'kind' => $kind,
            'sizes' => array_values($product->variants->map(function (ProductVariant $variant) use ($product): array {
                $variant->setRelation('product', $product);

                return [
                    'variant_id' => $variant->id,
                    'label' => $variant->label(),
                    'price_centavos' => ShopPrice::perPiece($variant),
                    'stock_pieces' => $variant->freeToSell(),
                    'can_preorder' => $variant->canBePreordered(),
                ];
            })->all()),
        ];
    }
}
