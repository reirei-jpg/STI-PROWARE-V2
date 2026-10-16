<?php

namespace App\Http\Requests;

use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\Preorder;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\EstorePo\ItemCode;
use App\Services\Products\ProductVariants;
use App\Services\Sales\HeadOfficeCost;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator as ValidatorContract;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;
use Inertia\Inertia;

/**
 * The Add / Edit Product form.
 *
 * Prices are typed in pesos (e.g. "350" or "350.50"). Options are optional
 * and dynamic: the Specialist names each one (Size, Program, Color…) and
 * lists its choices. Every combination of choices becomes a variant. An
 * option without choices yet does not block saving; it is just not saved.
 *
 * Stock is counted in pieces. Packs (e.g. Pack = 50 pieces) say how Head
 * Office sends an item and let students buy a whole pack; students buy by
 * the piece, by a pack, or both. Each pack has a key from the form so a
 * variant can point to a pack that is not saved yet.
 */
class SaveProductRequest extends FormRequest
{
    public const MAX_PHOTOS = 6;

    public const MAX_OPTIONS = 3;

    public const MAX_VARIANTS = 100;

    public const MAX_PACKS = 5;

    /** The highest price anyone can type anywhere in PROWARE, in pesos. */
    public const MAX_PRICE_PESOS = 100000;

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $product = $this->route('product');
        $productId = $product instanceof Product ? $product->id : null;
        $soldByPiece = $this->boolean('sold_by_piece');

        // On Sale is set only through Put on Sale; a product already on sale
        // stays On Sale while it is edited.
        $statuses = [ProductStatus::Draft, ProductStatus::Preorder, ProductStatus::Available];

        if ($product instanceof Product && $product->status === ProductStatus::OnSale) {
            $statuses[] = ProductStatus::OnSale;
        }

        return [
            'name' => ['required', 'string', 'max:120'],
            'sold_by_piece' => ['required', 'boolean'],
            'price' => [
                Rule::requiredIf($soldByPiece),
                'nullable',
                'decimal:0,2',
                'gt:0',
                'max:'.self::MAX_PRICE_PESOS,
            ],
            'status' => ['required', Rule::in(array_map(fn (ProductStatus $status): string => $status->value, $statuses))],
            'low_stock_alert_at' => ['required', 'integer', 'min:0', 'max:100000'],
            'preorders_close_on' => [
                Rule::requiredIf($this->input('status') === ProductStatus::Preorder->value),
                'nullable',
                'date_format:Y-m-d',
            ],

            'packs' => ['nullable', 'array', 'max:'.self::MAX_PACKS],
            'packs.*.key' => ['required', 'string', 'max:40', 'distinct'],
            'packs.*.id' => [
                'nullable',
                'integer',
                Rule::exists('product_packs', 'id')->where('product_id', $productId ?? 0),
            ],
            'packs.*.name' => ['required', 'string', 'max:30'],
            'packs.*.pieces' => ['required', 'integer', 'min:2', 'max:100000'],
            'packs.*.sold_to_students' => ['required', 'boolean'],
            'packs.*.price' => ['nullable', 'decimal:0,2', 'gt:0', 'max:'.self::MAX_PRICE_PESOS],

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
            // Combinations of the options that do not exist (e.g. Pink in 32 oz).
            'unavailable' => ['nullable', 'array'],
            'unavailable.*' => ['string', 'max:500'],
            'variants.*.combination' => ['present', 'nullable', 'string'],
            'variants.*.estore_item_code' => ['nullable', 'string', 'max:40'],
            'variants.*.estore_pack_key' => ['nullable', 'string', 'max:40'],
            'variants.*.price' => ['nullable', 'decimal:0,2', 'gt:0', 'max:'.self::MAX_PRICE_PESOS],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Enter the product name.',
            'price.required' => 'Enter the Selling Price per piece (set by Head Office).',
            'price.decimal' => 'Enter the Selling Price in pesos, e.g. 350 or 350.50.',
            'price.gt' => 'The Selling Price must be more than ₱0.',
            'price.max' => 'The Selling Price cannot be more than ₱100,000.00.',
            'packs.*.price.max' => 'The pack price cannot be more than ₱100,000.00.',
            'variants.*.price.max' => 'A variant\'s price cannot be more than ₱100,000.00.',
            'low_stock_alert_at.required' => 'Enter the number of pieces to be warned at, e.g. 5.',
            'low_stock_alert_at.integer' => 'Enter the number of pieces as a whole number.',
            'low_stock_alert_at.min' => 'The number cannot be below 0.',
            'status.in' => 'Choose Draft, Preorder or Available. To put a product on sale, use Put on Sale on the Products list.',
            'preorders_close_on.required' => 'Choose the last day students can preorder.',
            'preorders_close_on.date_format' => 'Choose a valid date.',
            'packs.max' => 'A product can have up to '.self::MAX_PACKS.' packs.',
            'packs.*.name.required' => 'Name the pack, e.g. Pack or Box.',
            'packs.*.pieces.required' => 'Enter how many pieces are in one pack.',
            'packs.*.pieces.integer' => 'Enter the number of pieces as a whole number.',
            'packs.*.pieces.min' => 'A pack has at least 2 pieces.',
            'packs.*.price.decimal' => 'Enter the pack price in pesos, e.g. 900.',
            'packs.*.price.gt' => 'The pack price must be more than ₱0.',
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
     * "The product was not saved." in a popup, so it is clear nothing was
     * saved even when the fields with a problem are further up the page.
     */
    protected function failedValidation(ValidatorContract $validator): void
    {
        $problems = count(array_unique($validator->errors()->all()));

        Inertia::flash('toast', [
            'type' => 'error',
            'message' => 'The product was not saved. Please correct the '.($problems === 1 ? 'highlighted field' : "{$problems} highlighted fields").'.',
        ]);

        parent::failedValidation($validator);
    }

    /**
     * Checks that need the whole form: repeated choices, too many variants,
     * and eStore Item Codes already used by another product.
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
                } elseif ($this->availableCombinations() === []) {
                    $validator->errors()->add('options', 'At least one variant must be available.');
                }

                $this->validateUniqueName($validator);
                $this->validatePacks($validator);
                $this->validatePreorderCloseDate($validator);
                $this->validateItemCodes($validator);
                $this->validateSellingPricesCoverCost($validator);
                $this->validateVariantsWithStockAreKept($validator);
                $this->validateVariantsWithPreordersAreKept($validator);
            },
        ];
    }

    /**
     * The packs as sent by the form, trimmed, in the order shown.
     *
     * @return list<array{key: string, id: int|null, name: string, pieces: int, sold_to_students: bool, price_centavos: int|null}>
     */
    public function packs(): array
    {
        /** @var array<int, array{key?: string|null, id?: int|string|null, name?: string|null, pieces?: int|string|null, sold_to_students?: bool|string|null, price?: string|null}> $packs */
        $packs = $this->input('packs', []);

        return array_values(array_map(fn (array $pack): array => [
            'key' => (string) ($pack['key'] ?? ''),
            'id' => empty($pack['id']) ? null : (int) $pack['id'],
            'name' => trim((string) ($pack['name'] ?? '')),
            'pieces' => (int) ($pack['pieces'] ?? 0),
            'sold_to_students' => filter_var($pack['sold_to_students'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'price_centavos' => ($pack['price'] ?? null) === null || $pack['price'] === '' ? null : self::toCentavos((string) $pack['price']),
        ], $packs));
    }

    /**
     * Pack names must differ from each other and from "Piece", a pack sold
     * to students needs its price, and students must be able to buy the
     * product somehow. A variant's "Head Office sends it by" must point to a
     * pack still in the form.
     */
    private function validatePacks(Validator $validator): void
    {
        $packs = $this->packs();
        $namesSeen = [];

        foreach ($packs as $index => $pack) {
            $name = mb_strtolower($pack['name']);

            if (in_array($name, ['piece', 'pieces', 'pc', 'pcs'], true)) {
                $validator->errors()->add("packs.{$index}.name", 'Stock is already counted by the piece. Please name the pack something else, e.g. Pack or Box.');
            } elseif (isset($namesSeen[$name])) {
                $validator->errors()->add("packs.{$index}.name", 'Two packs have the same name.');
            }

            $namesSeen[$name] = true;

            if ($pack['sold_to_students'] && $pack['price_centavos'] === null) {
                $validator->errors()->add("packs.{$index}.price", "Enter the price students pay for one {$pack['name']}.");
            }
        }

        $sellsAPack = array_filter($packs, fn (array $pack): bool => $pack['sold_to_students']) !== [];

        if (! $this->boolean('sold_by_piece') && ! $sellsAPack) {
            $validator->errors()->add('sold_by_piece', 'Choose how students buy it: by the piece, by a pack, or both.');
        }

        $keys = array_column($packs, 'key');

        /** @var array<int, array{estore_pack_key?: string|null}> $variants */
        $variants = $this->input('variants', []);

        foreach ($variants as $index => $variant) {
            $key = $variant['estore_pack_key'] ?? null;

            if ($key !== null && $key !== '' && ! in_array($key, $keys, true)) {
                $validator->errors()->add("variants.{$index}.estore_pack_key", 'That pack was removed. Choose how Head Office sends this item again.');
            }
        }
    }

    /**
     * A new close date for preorders cannot be in the past. A date already
     * saved may have passed (preorders closed) and can be kept as it is.
     */
    private function validatePreorderCloseDate(Validator $validator): void
    {
        $date = $this->input('preorders_close_on');

        if ($this->input('status') !== ProductStatus::Preorder->value || ! is_string($date) || $date === '') {
            return;
        }

        $product = $this->route('product');
        $unchanged = $product instanceof Product && $product->preorders_close_on?->toDateString() === $date;

        if (! $unchanged && $date < now()->toDateString()) {
            $validator->errors()->add('preorders_close_on', 'The close date cannot be in the past.');
        }
    }

    /**
     * A variant that already has stock records cannot disappear, or its
     * stock and history would be lost. That happens when a choice it uses
     * is removed or renamed, or when options are added to a product that
     * had none.
     */
    private function validateVariantsWithStockAreKept(Validator $validator): void
    {
        $product = $this->route('product');

        if (! $product instanceof Product) {
            return;
        }

        $kept = array_column($this->availableCombinations(), 'combination');
        $all = array_column(ProductVariants::combinations($this->options()), 'combination');

        $lost = $product->variants()
            ->whereNotIn('combination', $kept)
            ->where(fn (Builder $query) => $query->where('stock_on_hand', '!=', 0)->orWhereHas('stockMovements'))
            ->get();

        foreach ($lost as $variant) {
            $validator->errors()->add('options', match (true) {
                $variant->choices === [] => 'This product already has stock without options, so options cannot be added to it.',
                in_array($variant->combination, $all, true) => "\"{$variant->label()}\" cannot be marked unavailable because it has stock.",
                default => "\"{$variant->label()}\" already has stock, so it cannot be removed or renamed. Put its choice back.",
            });
        }
    }

    /**
     * A variant that students preordered (waiting or arrived) cannot
     * disappear: removing or renaming its choice would delete their
     * preorders with it. Cancelled preorders do not count.
     */
    private function validateVariantsWithPreordersAreKept(Validator $validator): void
    {
        $product = $this->route('product');

        if (! $product instanceof Product) {
            return;
        }

        $kept = array_column($this->availableCombinations(), 'combination');
        $all = array_column(ProductVariants::combinations($this->options()), 'combination');
        $lost = $product->variants()->whereNotIn('combination', $kept)->get()->keyBy('id');

        if ($lost->isEmpty()) {
            return;
        }

        $studentsByVariant = Preorder::query()
            ->whereIn('product_variant_id', $lost->keys())
            ->whereIn('status', [PreorderStatus::Active, PreorderStatus::Arrived])
            ->groupBy('product_variant_id')
            ->selectRaw('product_variant_id, count(distinct user_id) as students')
            ->pluck('students', 'product_variant_id');

        foreach ($studentsByVariant as $variantId => $students) {
            $variant = $lost->get($variantId);
            $count = (int) $students;
            $who = $count === 1 ? '1 student' : "{$count} students";

            $validator->errors()->add('options', match (true) {
                $variant === null || $variant->choices === [] => 'This product already has preorders without options, so options cannot be added to it.',
                in_array($variant->combination, $all, true) => "\"{$variant->label()}\" cannot be marked unavailable because {$who} ".($count === 1 ? 'has' : 'have').' preordered it.',
                default => "\"{$variant->label()}\" has preorders from {$who}, so it cannot be removed or renamed. Put its choice back.",
            });
        }
    }

    /**
     * The combinations of the options that exist and are saved as variants:
     * every combination except those marked as not available (e.g. a color
     * that does not come in 32 oz). A product without options has its one.
     *
     * @return list<array{combination: string, choices: list<array{option: string, choice: string}>}>
     */
    public function availableCombinations(): array
    {
        $combinations = ProductVariants::combinations($this->options());

        if ($this->options() === []) {
            return $combinations;
        }

        /** @var array<int, mixed> $unavailable */
        $unavailable = (array) $this->input('unavailable', []);
        $notMade = array_filter($unavailable, 'is_string');

        return array_values(array_filter(
            $combinations,
            fn (array $combination): bool => ! in_array($combination['combination'], $notMade, true),
        ));
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

    /**
     * The Selling Price (set by Head Office) cannot be below the Cost: what
     * PROWARE paid on the latest eStore order for the item, per piece (or per
     * pack for a pack's price). Variants without an eStore Item Code, or
     * whose code was never ordered, have no Cost yet and are not checked.
     */
    private function validateSellingPricesCoverCost(Validator $validator): void
    {
        /** @var array<int, array{estore_item_code?: string|null, estore_pack_key?: string|null, price?: string|null}> $variants */
        $variants = $this->input('variants', []);
        $packPieces = array_column($this->packs(), 'pieces', 'key');
        $codes = array_values(array_filter(array_map(fn (array $variant): ?string => ItemCode::normalize($variant['estore_item_code'] ?? null), $variants)));
        $unitPrices = HeadOfficeCost::latestUnitPrices($codes);
        $productPrice = $this->boolean('sold_by_piece') ? $this->centavos('price') : null;
        $highestCost = null;

        foreach ($variants as $index => $variant) {
            $code = ItemCode::normalize($variant['estore_item_code'] ?? null);

            if ($code === null || ! isset($unitPrices[$code])) {
                continue;
            }

            $cost = (int) round($unitPrices[$code] / max(1, $packPieces[(string) ($variant['estore_pack_key'] ?? '')] ?? 1));
            $highestCost = max($highestCost ?? 0, $cost);
            $ownPrice = ($variant['price'] ?? '') === '' ? null : self::toCentavos((string) $variant['price']);
            $price = $this->boolean('sold_by_piece') ? ($ownPrice ?? $productPrice) : null;

            if ($price !== null && $price < $cost) {
                $validator->errors()->add($ownPrice !== null ? "variants.{$index}.price" : 'price', self::belowCost($price, $cost, 'piece'));
            }
        }

        if ($highestCost === null) {
            return;
        }

        foreach ($this->packs() as $index => $pack) {
            $packCost = $highestCost * $pack['pieces'];

            if ($pack['sold_to_students'] && $pack['price_centavos'] !== null && $pack['price_centavos'] < $packCost) {
                $validator->errors()->add("packs.{$index}.price", self::belowCost($pack['price_centavos'], $packCost, $pack['name']));
            }
        }
    }

    /**
     * No two products have the same name, ignoring capital letters (as on
     * V1), so students never see two "STI Mug" items. A product saved before
     * this rule keeps its name when edited.
     */
    private function validateUniqueName(Validator $validator): void
    {
        $name = mb_strtolower(trim((string) $this->input('name')));
        $product = $this->route('product');
        $product = $product instanceof Product ? $product : null;

        if ($name === '' || ($product !== null && mb_strtolower(trim($product->name)) === $name)) {
            return;
        }

        $taken = Product::query()
            ->when($product?->id, fn (Builder $query, int $id) => $query->whereKeyNot($id))
            ->whereRaw('lower(trim(name)) = ?', [$name])
            ->first();

        if ($taken !== null) {
            $validator->errors()->add('name', "There is already a product named \"{$taken->name}\". Use another name, or edit that product.");
        }
    }

    private static function belowCost(int $price, int $cost, string $unit): string
    {
        return 'The Selling Price (₱'.number_format($price / 100, 2).') is below the Cost on the eStore order (₱'.number_format($cost / 100, 2)." per {$unit}). Check the price from Head Office.";
    }

    /**
     * A product has one eStore Item Code: every size, color and department
     * uses it (e.g. one umbrella code for every color), and Head Office
     * sends it the same way for all of them. A code belongs to one product.
     */
    private function validateItemCodes(Validator $validator): void
    {
        $product = $this->route('product');
        $productId = $product instanceof Product ? $product->id : null;
        $packKeyByCode = [];

        /** @var array<int, array{estore_item_code?: string|null, estore_pack_key?: string|null}> $variants */
        $variants = $this->input('variants', []);

        $codes = array_unique(array_map(
            fn (array $variant): string => ItemCode::normalize($variant['estore_item_code'] ?? null) ?? '',
            $variants,
        ));

        if (count($codes) > 1) {
            $validator->errors()->add('variants.0.estore_item_code', 'A product has one eStore Item Code: every size and color uses it.');

            return;
        }

        foreach ($variants as $index => $variant) {
            $code = ItemCode::normalize($variant['estore_item_code'] ?? null);

            if ($code === null) {
                continue;
            }

            $packKey = (string) ($variant['estore_pack_key'] ?? '');

            if (array_key_exists($code, $packKeyByCode)) {
                if ($packKeyByCode[$code] !== $packKey) {
                    $validator->errors()->add("variants.{$index}.estore_pack_key", "Variants that share {$code} must be sent the same way by Head Office.");
                }

                continue;
            }

            $packKeyByCode[$code] = $packKey;

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
