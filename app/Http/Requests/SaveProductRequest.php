<?php

namespace App\Http\Requests;

use App\Enums\ProductStatus;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\EstorePo\ItemCode;
use App\Services\Products\ProductVariants;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * The Add / Edit Product form.
 *
 * Prices are typed in pesos (e.g. "350" or "350.50"). Options are optional
 * and dynamic: the Specialist names each one (Size, Program, Color…) and
 * lists its choices. Every combination of choices becomes a variant. An
 * option without choices yet does not block saving; it is just not saved.
 */
class SaveProductRequest extends FormRequest
{
    public const MAX_PHOTOS = 6;

    public const MAX_OPTIONS = 3;

    public const MAX_VARIANTS = 100;

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $product = $this->route('product');
        $productId = $product instanceof Product ? $product->id : null;

        return [
            'name' => ['required', 'string', 'max:120'],
            'price' => ['required', 'decimal:0,2', 'gt:0', 'max:1000000'],
            'status' => ['required', Rule::enum(ProductStatus::class)],
            'sale_price' => [
                Rule::requiredIf($this->input('status') === ProductStatus::OnSale->value),
                'nullable',
                'decimal:0,2',
                'gt:0',
                'lt:price',
            ],

            'photos' => [
                Rule::requiredIf($this->input('status') !== ProductStatus::Draft->value),
                'array',
                'max:'.self::MAX_PHOTOS,
            ],
            'photos.*.id' => [
                'nullable',
                'integer',
                Rule::exists('product_photos', 'id')->where('product_id', $productId ?? 0),
            ],
            'photos.*.file' => [
                'required_without:photos.*.id',
                'nullable',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:5120',
            ],
            'photos.*.label' => ['nullable', 'string', 'max:40'],

            'options' => ['nullable', 'array', 'max:'.self::MAX_OPTIONS],
            'options.*.name' => ['nullable', 'string', 'max:40'],
            'options.*.choices' => ['nullable', 'array', 'max:30'],
            'options.*.choices.*' => ['required', 'string', 'max:40'],

            'variants' => ['nullable', 'array'],
            'variants.*.combination' => ['present', 'nullable', 'string'],
            'variants.*.estore_item_code' => ['nullable', 'string', 'max:40'],
            'variants.*.price' => ['nullable', 'decimal:0,2', 'gt:0', 'max:1000000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Enter the product name.',
            'price.required' => 'Enter the student price.',
            'price.decimal' => 'Enter the student price in pesos, e.g. 350 or 350.50.',
            'price.gt' => 'The student price must be more than ₱0.',
            'sale_price.required' => 'Enter the sale price for a product On Sale.',
            'sale_price.decimal' => 'Enter the sale price in pesos, e.g. 300 or 299.50.',
            'sale_price.lt' => 'The sale price must be lower than the student price.',
            'photos.required' => 'Add at least one photo. Only a Draft can be saved without a photo.',
            'photos.max' => 'A product can have up to '.self::MAX_PHOTOS.' photos.',
            'photos.*.file.required_without' => 'Choose a photo file.',
            'photos.*.file.image' => 'Photos must be JPG, PNG or WEBP pictures.',
            'photos.*.file.mimes' => 'Photos must be JPG, PNG or WEBP pictures.',
            'photos.*.file.max' => 'Each photo must be 5 MB or smaller.',
            'options.max' => 'A product can have up to '.self::MAX_OPTIONS.' options.',
            'options.*.choices.*.required' => 'A choice cannot be blank.',
            'variants.*.price.decimal' => 'Enter variant prices in pesos, e.g. 450.',
        ];
    }

    /**
     * Checks that need the whole form: repeated choices, too many variants,
     * and eStore Item Codes that are repeated or already used by another
     * product.
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

                $namesSeen = [];

                foreach ($this->submittedOptions() as $index => $option) {
                    if ($option['choices'] === []) {
                        continue;
                    }

                    if ($option['name'] === '') {
                        $validator->errors()->add("options.{$index}.name", 'Give every option a name, e.g. Size or Color.');

                        continue;
                    }

                    $name = mb_strtolower($option['name']);

                    if (isset($namesSeen[$name])) {
                        $validator->errors()->add("options.{$index}.name", 'Two options have the same name.');
                    }

                    $namesSeen[$name] = true;
                    $lowercase = array_map('mb_strtolower', $option['choices']);

                    if (count($lowercase) !== count(array_unique($lowercase))) {
                        $validator->errors()->add("options.{$index}.choices", "The option \"{$option['name']}\" has the same choice twice.");
                    }
                }

                if (count(ProductVariants::combinations($this->options())) > self::MAX_VARIANTS) {
                    $validator->errors()->add('options', 'These options make more than '.self::MAX_VARIANTS.' variants. Use fewer choices.');
                }

                $this->validateItemCodes($validator);
            },
        ];
    }

    /**
     * The options that are saved: those with at least one choice, trimmed,
     * in the order the Specialist entered them. An option with no choices
     * yet stays in the form but is not saved, since it makes no variants.
     *
     * @return list<array{name: string, choices: list<string>}>
     */
    public function options(): array
    {
        return array_values(array_filter(
            $this->submittedOptions(),
            fn (array $option): bool => $option['choices'] !== [],
        ));
    }

    /**
     * Every option as sent by the form, keyed by its position in the form.
     *
     * @return array<int, array{name: string, choices: list<string>}>
     */
    private function submittedOptions(): array
    {
        /** @var array<int, array{name?: string|null, choices?: array<int, string>|null}> $options */
        $options = $this->input('options', []);

        return array_map(fn (array $option): array => [
            'name' => trim((string) ($option['name'] ?? '')),
            'choices' => array_values(array_map('trim', $option['choices'] ?? [])),
        ], $options);
    }

    public function centavos(string $field): ?int
    {
        $value = $this->input($field);

        return $value === null || $value === '' ? null : self::toCentavos((string) $value);
    }

    public static function toCentavos(string $pesos): int
    {
        [$whole, $fraction] = array_pad(explode('.', trim($pesos), 2), 2, '0');

        return ((int) $whole) * 100 + (int) str_pad(substr($fraction, 0, 2), 2, '0');
    }

    private function validateItemCodes(Validator $validator): void
    {
        $product = $this->route('product');
        $productId = $product instanceof Product ? $product->id : null;
        $seen = [];

        /** @var array<int, array{estore_item_code?: string|null}> $variants */
        $variants = $this->input('variants', []);

        foreach ($variants as $index => $variant) {
            $code = ItemCode::normalize($variant['estore_item_code'] ?? null);

            if ($code === null) {
                continue;
            }

            if (isset($seen[$code])) {
                $validator->errors()->add("variants.{$index}.estore_item_code", "The eStore Item Code {$code} is used twice.");

                continue;
            }

            $seen[$code] = true;

            $usedElsewhere = ProductVariant::query()
                ->where('estore_item_code', $code)
                ->when($productId, fn (Builder $query, int $id) => $query->where('product_id', '!=', $id))
                ->with('product:id,name')
                ->first();

            if ($usedElsewhere !== null) {
                $validator->errors()->add("variants.{$index}.estore_item_code", "The eStore Item Code {$code} already belongs to \"{$usedElsewhere->product->name}\".");
            }
        }
    }
}
