<?php

namespace App\Actions\Products;

use App\Enums\ProductStatus;
use App\Http\Requests\SaveProductRequest;
use App\Models\Product;
use App\Models\ProductPhoto;
use App\Models\ProductVariant;
use App\Services\EstorePo\ItemCode;
use App\Services\Products\ProductVariants;
use App\Services\Stock\DeliveredStock;
use App\Services\Stock\LowStockAlerts;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Saves a product from the Add / Edit Product form: its details, photos
 * (in the order shown, first = main), packs, options and variants.
 *
 * Variants are rebuilt from the options. A variant that still exists keeps
 * its eStore Item Code, pack, price and stock; variants whose combination
 * no longer exists are removed (the form refuses this for a variant with
 * stock).
 *
 * When a variant gets an eStore Item Code, deliveries of that item that
 * arrived before it was linked are added to stock. Changing the low-stock
 * number lets variants now above it be warned again later.
 */
class SaveProduct
{
    public function __construct(
        private DeliveredStock $deliveredStock,
        private LowStockAlerts $lowStockAlerts,
    ) {}

    /**
     * @return int pieces of earlier deliveries added to stock
     */
    public function handle(Product $product, SaveProductRequest $request): int
    {
        $status = ProductStatus::from((string) $request->input('status'));
        $soldByPiece = $request->boolean('sold_by_piece');
        $newPhotoPaths = [];
        $removedPhotoPaths = [];
        $piecesAdded = 0;

        try {
            DB::transaction(function () use ($product, $request, $status, $soldByPiece, &$newPhotoPaths, &$removedPhotoPaths, &$piecesAdded): void {
                $product->fill([
                    'name' => trim((string) $request->input('name')),
                    'sold_by_piece' => $soldByPiece,
                    'price_centavos' => $soldByPiece ? $request->centavos('price') : null,
                    'sale_price_centavos' => $soldByPiece && $status === ProductStatus::OnSale ? $request->centavos('sale_price') : null,
                    'status' => $status,
                    'low_stock_alert_at' => $request->integer('low_stock_alert_at'),
                ])->save();

                $removedPhotoPaths = $this->syncPhotos($product, $request, $newPhotoPaths);
                $packIdsByKey = $this->savePacks($product, $request);
                $this->syncOptionsAndVariants($product, $request, $packIdsByKey, $soldByPiece);
                $product->packs()->whereNotIn('id', array_values($packIdsByKey))->delete();

                foreach ($product->variants()->whereNotNull('estore_item_code')->get() as $variant) {
                    $piecesAdded += $this->deliveredStock->addWaitingFor($variant, $request->user());
                }

                $this->lowStockAlerts->rearm($product);
            });
        } catch (\Throwable $exception) {
            Storage::disk('public')->delete($newPhotoPaths);

            throw $exception;
        }

        Storage::disk('public')->delete($removedPhotoPaths);

        return $piecesAdded;
    }

    /**
     * Create and update the packs in the form, in the order shown. Packs
     * removed from the form are deleted after the variants stop using them.
     *
     * @return array<string, int> pack id by the pack's key in the form
     */
    private function savePacks(Product $product, SaveProductRequest $request): array
    {
        $idsByKey = [];

        foreach ($request->packs() as $position => $pack) {
            $attributes = [
                'name' => $pack['name'],
                'pieces' => $pack['pieces'],
                'sold_to_students' => $pack['sold_to_students'],
                'price_centavos' => $pack['sold_to_students'] ? $pack['price_centavos'] : null,
                'position' => $position,
            ];

            if ($pack['id'] !== null) {
                $existing = $product->packs()->findOrFail($pack['id']);
                $existing->update($attributes);
                $idsByKey[$pack['key']] = $existing->id;

                continue;
            }

            $idsByKey[$pack['key']] = $product->packs()->create($attributes)->id;
        }

        return $idsByKey;
    }

    /**
     * @param  list<string>  $newPhotoPaths  filled with the paths of newly stored files
     * @return list<string> paths of photos removed from the product
     */
    private function syncPhotos(Product $product, SaveProductRequest $request, array &$newPhotoPaths): array
    {
        /** @var array<int, array{id?: int|string|null, label?: string|null}> $photos */
        $photos = $request->input('photos', []);
        $keptIds = [];
        $position = -1;

        foreach ($photos as $index => $photo) {
            $position++;
            $label = isset($photo['label']) && trim($photo['label']) !== '' ? trim($photo['label']) : null;

            if (! empty($photo['id'])) {
                $existing = $product->photos()->findOrFail((int) $photo['id']);
                $existing->update(['label' => $label, 'position' => $position]);
                $keptIds[] = $existing->id;

                continue;
            }

            $file = $request->file("photos.{$index}.file");

            if (! $file instanceof UploadedFile) {
                continue;
            }

            $path = $file->store('products', 'public');

            if ($path === false) {
                throw new \RuntimeException('The photo could not be saved.');
            }

            $newPhotoPaths[] = $path;
            $keptIds[] = $product->photos()->create(['path' => $path, 'label' => $label, 'position' => $position])->id;
        }

        $removed = $product->photos()->whereNotIn('id', $keptIds)->get();
        $product->photos()->whereNotIn('id', $keptIds)->delete();

        return array_values($removed->map(fn (ProductPhoto $photo): string => $photo->path)->all());
    }

    /**
     * @param  array<string, int>  $packIdsByKey
     */
    private function syncOptionsAndVariants(Product $product, SaveProductRequest $request, array $packIdsByKey, bool $soldByPiece): void
    {
        $options = $request->options();

        $product->options()->delete();

        foreach ($options as $position => $option) {
            $product->options()->create([...$option, 'position' => $position]);
        }

        /** @var array<int, array{combination?: string|null, estore_item_code?: string|null, estore_pack_key?: string|null, price?: string|null}> $submitted */
        $submitted = $request->input('variants', []);
        $submittedByKey = [];

        foreach ($submitted as $variant) {
            $submittedByKey[(string) ($variant['combination'] ?? '')] = $variant;
        }

        // Codes may move between this product's variants; clear them first so
        // the "each code once" rule is never broken halfway through saving.
        $product->variants()->update(['estore_item_code' => null]);

        $existingByKey = $product->variants()->get()->keyBy('combination');
        $keptIds = [];

        foreach (ProductVariants::combinations($options) as $position => $combination) {
            $input = $submittedByKey[$combination['combination']] ?? [];
            $price = $soldByPiece ? ($input['price'] ?? null) : null;
            $packKey = $input['estore_pack_key'] ?? null;

            $attributes = [
                'choices' => $combination['choices'],
                'estore_item_code' => ItemCode::normalize($input['estore_item_code'] ?? null),
                'estore_pack_id' => $packKey === null || $packKey === '' ? null : $packIdsByKey[$packKey],
                'price_centavos' => $price === null || $price === '' ? null : SaveProductRequest::toCentavos((string) $price),
                'position' => $position,
            ];

            /** @var ProductVariant|null $variant */
            $variant = $existingByKey->get($combination['combination']);

            if ($variant !== null) {
                $variant->update($attributes);
            } else {
                $variant = $product->variants()->create(['combination' => $combination['combination'], ...$attributes]);
            }

            $keptIds[] = $variant->id;
        }

        $product->variants()->whereNotIn('id', $keptIds)->delete();
    }
}
