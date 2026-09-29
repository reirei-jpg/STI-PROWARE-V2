<?php

namespace App\Actions\Products;

use App\Enums\ProductStatus;
use App\Http\Requests\SaveProductRequest;
use App\Models\Product;
use App\Models\ProductPhoto;
use App\Models\ProductVariant;
use App\Services\EstorePo\ItemCode;
use App\Services\Products\ProductVariants;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Saves a product from the Add / Edit Product form: its details, photos
 * (in the order shown, first = main), options and variants.
 *
 * Variants are rebuilt from the options. A variant that still exists keeps
 * its eStore Item Code and price; variants whose combination no longer
 * exists are removed.
 */
class SaveProduct
{
    public function handle(Product $product, SaveProductRequest $request): Product
    {
        $status = ProductStatus::from((string) $request->input('status'));
        $newPhotoPaths = [];
        $removedPhotoPaths = [];

        try {
            DB::transaction(function () use ($product, $request, $status, &$newPhotoPaths, &$removedPhotoPaths): void {
                $product->fill([
                    'name' => trim((string) $request->input('name')),
                    'price_centavos' => $request->centavos('price'),
                    'sale_price_centavos' => $status === ProductStatus::OnSale ? $request->centavos('sale_price') : null,
                    'status' => $status,
                ])->save();

                $removedPhotoPaths = $this->syncPhotos($product, $request, $newPhotoPaths);
                $this->syncOptionsAndVariants($product, $request);
            });
        } catch (\Throwable $exception) {
            Storage::disk('public')->delete($newPhotoPaths);

            throw $exception;
        }

        Storage::disk('public')->delete($removedPhotoPaths);

        return $product;
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

    private function syncOptionsAndVariants(Product $product, SaveProductRequest $request): void
    {
        $options = $request->options();

        $product->options()->delete();

        foreach ($options as $position => $option) {
            $product->options()->create([...$option, 'position' => $position]);
        }

        /** @var array<int, array{combination?: string|null, estore_item_code?: string|null, price?: string|null}> $submitted */
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
            $price = $input['price'] ?? null;

            $attributes = [
                'choices' => $combination['choices'],
                'estore_item_code' => ItemCode::normalize($input['estore_item_code'] ?? null),
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
