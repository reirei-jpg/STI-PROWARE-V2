import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    Boxes,
    Flame,
    ImagePlus,
    Link2,
    LoaderCircle,
    Plus,
    Save,
    Trash2,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import ProductController from '@/actions/App/Http/Controllers/ProductController';
import ProductStockController from '@/actions/App/Http/Controllers/ProductStockController';
import ConfirmDialog from '@/components/confirm-dialog';
import DraftRestoredNotice from '@/components/draft-restored-notice';
import RequiredLabel, { RequiredNote } from '@/components/required-label';
import EndSaleButton from '@/components/end-sale-button';
import InputError from '@/components/input-error';
import PageHeader from '@/components/page-header';
import Panel, { TableHeading } from '@/components/panel';
import { useFormDraft } from '@/hooks/use-form-draft';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { formatDateTime, formatPeso } from '@/lib/format';
import { nextProductCode, variantCodes } from '@/lib/item-codes';
import { priceInput, wholeNumberInput } from '@/lib/number-input';
import { optionPresets, presetChoices } from '@/lib/product-option-presets';
import { variantCombinations } from '@/lib/product-variants';
import { tidyProductName } from '@/lib/product-name';
import { formatUnits } from '@/lib/units';
import { cn } from '@/lib/utils';
import type {
    EditableProduct,
    ProductFromItem,
    ProductOptionInput,
    ProductPackInput,
    ProductStatus,
    VariantStatus,
} from '@/types';

const MAX_PHOTOS = 6;
const MAX_OPTIONS = 3;
const MAX_PACKS = 5;

/** The expected arrival filled in from the close date: 2 to 3 weeks after it. */
const ARRIVAL_STARTS_AFTER_DAYS = 14;
const ARRIVAL_ENDS_AFTER_DAYS = 21;

/** "2026-10-30" plus 14 days = "2026-11-13". */
function addDays(date: string, days: number): string {
    const day = new Date(`${date}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() + days);

    return day.toISOString().slice(0, 10);
}

/** "2026-11-13" as "Nov 13, 2026". */
function formatDay(date: string): string {
    return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}
type PhotoInput = {
    id: number | null;
    url: string;
    file: File | null;
    label: string;
};

/**
 * A variant's own Selling Price per piece (optional), its status, and its
 * Item Code: made from the product's code until it is typed by hand.
 */
type VariantInput = {
    price: string;
    status: VariantStatus;
    code: string;
    code_typed: boolean;
};

type ProductFormData = {
    name: string;
    /** The product's own Item Code (BP-01); made from the name until typed by hand. */
    item_code: string;
    item_code_typed: boolean;
    sold_by_piece: boolean;
    price: string;
    status: ProductStatus;
    preorders_close_on: string;
    expected_arrival_from: string;
    expected_arrival_to: string;
    early_bird_price: string;
    early_bird_pieces: string;
    low_stock_alert_at: string;
    photos: PhotoInput[];
    packs: ProductPackInput[];
    options: ProductOptionInput[];
    variant_inputs: Record<string, VariantInput>;
    /** How Head Office sends the item: by the piece (empty) or in a pack. */
    shared_pack_key: string;
    /** Options added to a product that had none: the variant its stock already is. */
    existing_stock_combination: string;
};

/** A new variant starts as a Draft with a code made from the product's. */
const emptyVariantInput: VariantInput = {
    price: '',
    status: 'draft',
    code: '',
    code_typed: false,
};

/** Keeps only digits, so "50 pcs" becomes "50", up to 100,000 (as the server allows). */
const digitsOnly = (value: string) => wholeNumberInput(value, 100000);

const statuses: { value: VariantStatus; label: string; description: string }[] =
    [
        {
            value: 'draft',
            label: 'Draft',
            description: 'Not shown to students yet.',
        },
        {
            value: 'preorder',
            label: 'Preorder',
            description:
                'Shown under Coming Soon. Students can preorder it before it is ordered from the eStore.',
        },
        {
            value: 'available',
            label: 'Available',
            description:
                'Shown in All Merchandise. Students can add it to their cart.',
        },
    ];

const inputClasses =
    'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 aria-invalid:border-red-400 aria-invalid:ring-2 aria-invalid:ring-red-100';

/** The form's sections, top to bottom, to jump to a box with a problem. */
const SECTIONS = [
    'product-photos',
    'product-details',
    'product-packs',
    'product-options',
    'product-variants',
    'product-status',
] as const;

type Section = (typeof SECTIONS)[number];

/**
 * Whether a server message (e.g. "packs.0.pieces") is about a part of the
 * form, so it can go away once that part is changed.
 */
function errorBelongsTo(key: string, field: keyof ProductFormData): boolean {
    const [top, , part] = key.split('.');

    switch (field) {
        case 'variant_inputs':
            return (
                top === 'variants' &&
                ['price', 'status', 'estore_item_code'].includes(part)
            );
        case 'item_code_typed':
            return top === 'item_code';
        case 'shared_pack_key':
            return top === 'variants' && part === 'estore_pack_key';
        case 'options':
            return top === 'options' || top === 'variants';
        case 'sold_by_piece':
            return ['sold_by_piece', 'price', 'packs'].includes(top);
        case 'packs':
            return top === 'packs' || top === 'sold_by_piece';
        case 'status':
            return [
                'status',
                'photos',
                'preorders_close_on',
                'expected_arrival_from',
                'expected_arrival_to',
                'early_bird_price',
                'early_bird_pieces',
            ].includes(top);
        default:
            return top === field;
    }
}

export default function ProductForm({
    product,
    fromItem,
    costs,
    today,
    usedProductCodes,
}: {
    product: EditableProduct | null;
    fromItem: ProductFromItem | null;
    /** What PROWARE paid per eStore unit on the latest order, by item code. */
    costs: Record<string, number>;
    /** Today in the school's time zone, "YYYY-MM-DD". */
    today: string;
    /** Other products' own Item Codes, for the next free number (BP-02). */
    usedProductCodes: string[];
}) {
    // Head Office sends every variant the same way (by the piece or a pack).
    const savedVariants = product?.variants ?? [];
    const savedCodedVariant =
        savedVariants.find((variant) => variant.estore_item_code !== '') ??
        null;

    const form = useForm<ProductFormData>({
        name: product?.name ?? fromItem?.description.slice(0, 120) ?? '',
        // A saved code (or the eStore item's) is kept as it is.
        item_code: product?.item_code || fromItem?.item_code || '',
        item_code_typed: Boolean(product?.item_code || fromItem),
        sold_by_piece: product?.sold_by_piece ?? true,
        price: product?.price ?? '',
        status: product?.status ?? 'draft',
        preorders_close_on: product?.preorders_close_on ?? '',
        // A Preorder product saved before expected arrivals existed gets
        // the usual range from its close date.
        expected_arrival_from:
            product?.expected_arrival_from ||
            (product?.preorders_close_on
                ? addDays(product.preorders_close_on, ARRIVAL_STARTS_AFTER_DAYS)
                : ''),
        expected_arrival_to:
            product?.expected_arrival_to ||
            (product?.preorders_close_on
                ? addDays(product.preorders_close_on, ARRIVAL_ENDS_AFTER_DAYS)
                : ''),
        early_bird_price: product?.early_bird_price ?? '',
        early_bird_pieces: product?.early_bird_pieces ?? '',
        low_stock_alert_at: product?.low_stock_alert_at ?? '5',
        photos:
            product?.photos.map((photo) => ({
                id: photo.id,
                url: photo.url,
                file: null,
                label: photo.label,
            })) ?? [],
        packs: product?.packs ?? [],
        options: product?.options ?? [],
        // Saved variants keep their status and code; combinations never
        // saved (once "unavailable") start as Drafts.
        variant_inputs: product
            ? Object.fromEntries(
                  product.variants.map((variant) => [
                      variant.combination,
                      {
                          price: variant.price,
                          status: variant.status,
                          code: variant.estore_item_code,
                          code_typed: variant.estore_item_code !== '',
                      },
                  ]),
              )
            : fromItem
              ? {
                    '': {
                        ...emptyVariantInput,
                        code: fromItem.item_code,
                        code_typed: true,
                    },
                }
              : {},
        shared_pack_key: savedCodedVariant?.estore_pack_key ?? '',
        existing_stock_combination: '',
    });

    const { data, setData, processing } = form;

    // What was typed is kept until saved; new photos cannot be kept, so
    // they are added again after a draft is brought back.
    // "-v2": drafts kept before variants had their own status and code are
    // not brought back.
    const draft = useFormDraft(
        product
            ? `product-${product.id}-v2`
            : `new-product-${fromItem?.item_code ?? ''}-v2`,
        { ...data, photos: data.photos.filter((photo) => photo.file === null) },
        (saved) => setData(saved),
    );

    // Leaving with unsaved changes asks first (the draft keeps them, not new photos).
    const unsaved = useUnsavedChanges(form.isDirty && !processing, {
        kept: true,
        notKept: 'Photos you added are not kept.',
    });

    // The expected arrival follows the close date until the Specialist
    // changes it herself (a saved product keeps its own days).
    const [arrivalChosen, setArrivalChosen] = useState(
        Boolean(product?.expected_arrival_from),
    );
    const changeCloseDate = (date: string) =>
        setData((current) => ({
            ...current,
            preorders_close_on: date,
            ...(arrivalChosen || date === ''
                ? {}
                : {
                      expected_arrival_from: addDays(
                          date,
                          ARRIVAL_STARTS_AFTER_DAYS,
                      ),
                      expected_arrival_to: addDays(
                          date,
                          ARRIVAL_ENDS_AFTER_DAYS,
                      ),
                  }),
        })); // A saved product without options: when options are added, the
    // Specialist says which new variant its stock (and history) is.
    const withoutOptions =
        product !== null &&
        product.variants.length === 1 &&
        product.variants[0].combination === ''
            ? product.variants[0]
            : null;
    const errors = form.errors as Record<string, string | undefined>;
    const combinations = variantCombinations(
        data.options.filter(
            (option) => option.name.trim() !== '' && option.choices.length > 0,
        ),
    );
    const stockByCombination: Record<string, number> = Object.fromEntries(
        (product?.variants ?? []).map((variant) => [
            variant.combination,
            variant.stock_on_hand,
        ]),
    );

    // The stock without options shows on the variant chosen for it.
    if (withoutOptions !== null && data.existing_stock_combination !== '') {
        stockByCombination[data.existing_stock_combination] =
            withoutOptions.stock_on_hand;
    }
    const variantInput = (key: string): VariantInput =>
        data.variant_inputs[key] ?? emptyVariantInput;
    // With variants, the price per piece is the default for those without
    // a price of their own.
    const hasVariants = combinations.length > 1;
    const everyVariantPriced =
        hasVariants &&
        combinations.every(
            (combination) => variantInput(combination.key).price.trim() !== '',
        );

    // The product's code: made from the name (the next free number) until
    // typed by hand. Each variant's code is made from it (BP-01-S-RED)
    // until that one is typed by hand.
    const productCode = data.item_code_typed
        ? data.item_code.trim().toUpperCase()
        : nextProductCode(tidyProductName(data.name), usedProductCodes);
    const autoCodes = variantCodes(productCode, combinations);
    const codeOf = (key: string): string => {
        const input = variantInput(key);

        return input.code_typed
            ? input.code.trim().toUpperCase()
            : (autoCodes[key] ?? '');
    };
    const someCodesTyped = combinations.some(
        (combination) => variantInput(combination.key).code_typed,
    );

    // The product's status follows from its variants' (as the server
    // works it out): Available when any is (On Sale stays On Sale), else
    // Preorder when any is, else Draft.
    const variantStatuses = combinations.map(
        (combination) => variantInput(combination.key).status,
    );
    const status: ProductStatus = variantStatuses.includes('available')
        ? data.status === 'on_sale'
            ? 'on_sale'
            : 'available'
        : variantStatuses.includes('preorder')
          ? 'preorder'
          : 'draft';
    const savedStatusOf = (key: string): VariantStatus | null =>
        savedVariants.find((variant) => variant.combination === key)?.status ??
        null;

    /**
     * Whether a variant can be set to this status, and why not: with no
     * stock it cannot be Available (unless it already is, sold out); with
     * stock it cannot be a Preorder, nor go back to Draft once in the store.
     */
    const statusBlockedBecause = (
        key: string,
        target: VariantStatus,
    ): string | null => {
        const stock = stockByCombination[key] ?? 0;
        const saved = savedStatusOf(key);

        if (target === 'available' && stock === 0 && saved !== 'available') {
            return 'no stock yet';
        }

        if (target === 'preorder' && stock > 0) {
            return 'has stock';
        }

        if (
            target === 'draft' &&
            stock > 0 &&
            saved !== null &&
            saved !== 'draft'
        ) {
            return 'in the store with stock';
        }

        return null;
    };

    // The Cost per piece (what PROWARE paid on the eStore order for a
    // variant's code, per piece of the pack it comes in), shown beside the
    // Selling Price.
    // A code never ordered yet uses the product's own (the old shared) code.
    const unitPrice =
        combinations
            .map((combination) => costs[codeOf(combination.key)])
            .find((price) => price !== undefined) ?? costs[productCode];
    const costPerPiece =
        unitPrice === undefined
            ? null
            : Math.round(
                  unitPrice /
                      (Number(
                          data.packs.find(
                              (pack) => pack.key === data.shared_pack_key,
                          )?.pieces,
                      ) || 1),
              );
    const pesosToCentavos = (value: string) =>
        value.trim() === '' ? null : Math.round(Number(value) * 100);

    // A new close date cannot be before today; a date already saved that
    // has passed (preorders closed) may stay as it is.
    const closeDateInPast =
        status === 'preorder' &&
        data.preorders_close_on !== '' &&
        data.preorders_close_on < today &&
        data.preorders_close_on !== (product?.preorders_close_on ?? '');

    // The expected arrival is after the close date, first day first.
    const arrivalProblem =
        status !== 'preorder'
            ? undefined
            : data.expected_arrival_from !== '' &&
                data.preorders_close_on !== '' &&
                data.expected_arrival_from <= data.preorders_close_on
              ? `The expected arrival must be after the close date (${formatDay(data.preorders_close_on)}).`
              : undefined;
    const arrivalEndProblem =
        status === 'preorder' &&
        data.expected_arrival_from !== '' &&
        data.expected_arrival_to !== '' &&
        data.expected_arrival_to < data.expected_arrival_from
            ? 'The last day cannot be before the first day.'
            : undefined;

    // New packs get a key of their own until they are saved.
    const nextPackNumber = useRef(1);

    // Free the previews of newly chosen photos when leaving the page.
    const previews = useRef<string[]>([]);
    useEffect(
        () => () => previews.current.forEach((url) => URL.revokeObjectURL(url)),
        [],
    );

    // The status and codes shown on the page are the ones saved.
    const submit = () => {
        form.transform((current) => ({
            name: current.name,
            item_code: productCode,
            sold_by_piece: current.sold_by_piece,
            price: current.sold_by_piece ? current.price : '',
            status,
            preorders_close_on:
                status === 'preorder' ? current.preorders_close_on : '',
            expected_arrival_from:
                status === 'preorder' ? current.expected_arrival_from : '',
            expected_arrival_to:
                status === 'preorder' ? current.expected_arrival_to : '',
            early_bird_price:
                status === 'preorder' ? current.early_bird_price : '',
            early_bird_pieces:
                status === 'preorder' ? current.early_bird_pieces : '',
            low_stock_alert_at: current.low_stock_alert_at,
            photos: current.photos.map((photo) => ({
                id: photo.id ?? '',
                file: photo.file ?? '',
                label: photo.label,
            })),
            packs: current.packs.map((pack) => ({
                key: pack.key,
                id: pack.id ?? '',
                name: pack.name,
                pieces: pack.pieces,
                sold_to_students: pack.sold_to_students,
                price: pack.sold_to_students ? pack.price : '',
            })),
            options: current.options,
            existing_stock_combination:
                withoutOptions !== null &&
                combinations.some(
                    (combination) =>
                        combination.key === current.existing_stock_combination,
                )
                    ? current.existing_stock_combination
                    : '',
            variants: combinations.map((combination) => {
                const input =
                    current.variant_inputs[combination.key] ??
                    emptyVariantInput;

                return {
                    combination: combination.key,
                    status: input.status,
                    estore_item_code: codeOf(combination.key),
                    estore_pack_key: current.shared_pack_key,
                    price: current.sold_by_piece ? input.price : '',
                };
            }),
            ...(product ? { _method: 'put' } : {}),
        }));

        form.post(
            product
                ? ProductController.update(product.id).url
                : ProductController.store().url,
            {
                forceFormData: true,
                preserveScroll: true,
                onSuccess: (page) => {
                    draft.clear(page);
                    form.setDefaults();
                },
                onError: () => {
                    jumpToFirstProblem.current = true;
                },
            },
        );
    };

    const addPhotos = (files: FileList | null) => {
        const room = MAX_PHOTOS - data.photos.length;
        const added = Array.from(files ?? [])
            .slice(0, room)
            .map((file) => {
                const url = URL.createObjectURL(file);
                previews.current.push(url);

                return { id: null, url, file, label: '' };
            });

        setData('photos', [...data.photos, ...added]);
    };

    const movePhoto = (index: number, direction: -1 | 1) => {
        const photos = [...data.photos];
        const target = index + direction;
        [photos[index], photos[target]] = [photos[target], photos[index]];
        setData('photos', photos);
    };

    // The options work like tabs: only the one being edited is shown.
    const [activeOption, setActiveOption] = useState<number | null>(
        data.options.length > 0 ? 0 : null,
    );

    /**
     * Switch to the option `matches` finds, adding it as `newName` first
     * when the product does not have it yet (null: never add). Switching
     * only hides the option being left; nothing the Specialist added is
     * ever removed except with its own Remove option button.
     */
    const showOption = (
        matches: (option: ProductOptionInput) => boolean,
        newName: string | null,
    ) => {
        let options = [...data.options];
        let index = options.findIndex(matches);

        if (index === -1) {
            if (newName === null || options.length >= MAX_OPTIONS) {
                return;
            }

            options = [...options, { name: newName, choices: [] }];
            index = options.length - 1;
        }

        setData('options', options);
        setActiveOption(index);
    };

    const isPresetName = (name: string) =>
        Object.hasOwn(optionPresets, name.trim().toLowerCase());

    const removeOption = (index: number) => {
        setData(
            'options',
            data.options.filter((_, i) => i !== index),
        );
        setActiveOption(data.options.length > 1 ? 0 : null);
    };

    const optionHasError = (index: number) =>
        Object.keys(errors).some(
            (key) => key.startsWith(`options.${index}.`) && errors[key],
        );

    const updateOption = (index: number, option: ProductOptionInput) =>
        setData(
            'options',
            data.options.map((current, i) => (i === index ? option : current)),
        );

    const updateVariant = (key: string, changes: Partial<VariantInput>) =>
        setData('variant_inputs', {
            ...data.variant_inputs,
            [key]: { ...variantInput(key), ...changes },
        });

    /** Every variant that can be set to this status gets it. */
    const setEveryStatus = (target: VariantStatus) =>
        setData(
            'variant_inputs',
            Object.fromEntries([
                ...Object.entries(data.variant_inputs),
                ...combinations.map((combination) => [
                    combination.key,
                    statusBlockedBecause(combination.key, target) === null
                        ? { ...variantInput(combination.key), status: target }
                        : variantInput(combination.key),
                ]),
            ]),
        );

    /** Every variant's code is made from the product's code again. */
    const useAutomaticCodes = () =>
        setData(
            'variant_inputs',
            Object.fromEntries([
                ...Object.entries(data.variant_inputs),
                ...combinations.map((combination) => [
                    combination.key,
                    {
                        ...variantInput(combination.key),
                        code: '',
                        code_typed: false,
                    },
                ]),
            ]),
        );

    const addPack = () => {
        const key = `new-${nextPackNumber.current++}`;

        setData('packs', [
            ...data.packs,
            {
                key,
                id: null,
                name: 'Pack',
                pieces: '',
                sold_to_students: false,
                price: '',
            },
        ]);
    };

    const updatePack = (key: string, changes: Partial<ProductPackInput>) =>
        setData(
            'packs',
            data.packs.map((pack) =>
                pack.key === key ? { ...pack, ...changes } : pack,
            ),
        );

    /** The variants whose eStore item Head Office sends in this pack. */
    const variantsUsingPack = (key: string) =>
        data.shared_pack_key === key ? combinations : [];

    const packLabel = (pack: ProductPackInput) =>
        `${pack.name.trim() || 'Pack'} (${pack.pieces || '?'} pcs)`;

    // The eStore item this product is created from, if no variant has its
    // code any more.
    const fromItemCodeMissing =
        fromItem !== null &&
        !combinations.some(
            (combination) => codeOf(combination.key) === fromItem.item_code,
        );

    const sharedPackError = combinations
        .map((_, index) => errors[`variants.${index}.estore_pack_key`])
        .find(Boolean);

    const firstPhotoError = data.photos
        .map((_, index) => errors[`photos.${index}.file`])
        .find(Boolean);

    /** Where on the form a refused box is, in words, e.g. "Pack: pieces in one". */
    const problemPlace = (key: string): { place: string; section: Section } => {
        const [field, index, part] = key.split('.');
        const number = Number(index);

        switch (field) {
            case 'photos':
                return {
                    place:
                        index === undefined ? 'Photos' : `Photo ${number + 1}`,
                    section: 'product-photos',
                };
            case 'name':
                return { place: 'Product name', section: 'product-details' };
            case 'item_code':
                return { place: 'Item Code', section: 'product-details' };
            case 'price':
                return {
                    place: 'Selling Price per piece',
                    section: 'product-packs',
                };
            case 'sold_by_piece':
                return {
                    place: 'Students can buy it',
                    section: 'product-packs',
                };
            case 'low_stock_alert_at':
                return {
                    place: 'Notify me when stock falls to',
                    section: 'product-packs',
                };
            case 'packs': {
                const packName =
                    data.packs[number]?.name.trim() || `Pack ${number + 1}`;
                const box =
                    { name: 'name', pieces: 'pieces in one', price: 'price' }[
                        part
                    ] ?? '';

                return {
                    place:
                        index === undefined ? 'Packs' : `${packName}: ${box}`,
                    section: 'product-packs',
                };
            }
            case 'options':
                return { place: 'Options', section: 'product-options' };
            case 'variants': {
                const variant = combinations[number]?.label ?? 'a variant';

                return {
                    place:
                        part === 'estore_item_code'
                            ? `Item Code of ${variant}`
                            : part === 'estore_pack_key'
                              ? 'Head Office sends it by'
                              : part === 'price'
                                ? `Price for ${variant}`
                                : part === 'status'
                                  ? `Status of ${variant}`
                                  : 'Variants',
                    section: 'product-variants',
                };
            }
            case 'existing_stock_combination':
                return {
                    place: 'Stock already on hand',
                    section: 'product-variants',
                };
            case 'preorders_close_on':
                return {
                    place: 'Preorders close on',
                    section: 'product-status',
                };
            case 'expected_arrival_from':
            case 'expected_arrival_to':
                return {
                    place: 'Expected arrival',
                    section: 'product-status',
                };
            case 'early_bird_price':
            case 'early_bird_pieces':
                return {
                    place: 'Early-bird price',
                    section: 'product-status',
                };
            default:
                return { place: 'Where it shows', section: 'product-status' };
        }
    };

    // The boxes the server refused, top of the page first, each told once.
    const problems = Object.entries(errors)
        .filter((entry): entry is [string, string] => Boolean(entry[1]))
        .map(([key, message]) => ({ key, message, ...problemPlace(key) }))
        .filter(
            (problem, index, all) =>
                all.findIndex(
                    (other) =>
                        other.place === problem.place &&
                        other.message === problem.message,
                ) === index,
        )
        .sort(
            (a, b) => SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section),
        );

    const jumpTo = (section: Section) =>
        document
            .getElementById(section)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // When saving is refused, go up to the first box with a problem.
    const jumpToFirstProblem = useRef(false);
    useEffect(() => {
        if (jumpToFirstProblem.current && problems.length > 0) {
            jumpToFirstProblem.current = false;
            jumpTo(problems[0].section);
        }
    });

    // A box's red message goes away once that box is changed.
    const dataBefore = useRef(data);
    useEffect(() => {
        const before = dataBefore.current;
        dataBefore.current = data;
        const changed = (Object.keys(data) as (keyof ProductFormData)[]).filter(
            (field) => data[field] !== before[field],
        );
        const fixed = Object.keys(form.errors).filter((key) =>
            changed.some((field) => errorBelongsTo(key, field)),
        );

        if (fixed.length > 0) {
            form.clearErrors(...(fixed as Parameters<typeof form.clearErrors>));
        }
        // Only a change to the form clears messages, not new ones arriving.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    // How many variants have each status, e.g. "2 Preorder, 10 Draft".
    const statusCounts = statuses
        .map(({ value, label }) => ({
            label,
            count: variantStatuses.filter((current) => current === value)
                .length,
        }))
        .filter(({ count }) => count > 0)
        .map(({ label, count }) => `${count} ${label}`)
        .join(', ');

    // What pressing Save will save, e.g. "BP-01 Bagong Product · 12
    // variants (2 Preorder, 10 Draft) · Preorder: open until Nov 30, 2026".
    const summary = [
        [productCode, tidyProductName(data.name) || 'This product']
            .filter(Boolean)
            .join(' '),
        hasVariants
            ? `${combinations.length} variants (${statusCounts})`
            : null,
        {
            draft: 'Draft: not visible to students',
            preorder:
                data.preorders_close_on === ''
                    ? 'Preorder: choose the closing date'
                    : `Preorder: open until ${formatDay(data.preorders_close_on)}${data.expected_arrival_from && data.expected_arrival_to ? `, expected ${formatDay(data.expected_arrival_from)} to ${formatDay(data.expected_arrival_to)}` : ''}`,
            available: 'Available: visible to students',
            on_sale: 'On Sale: visible to students',
        }[status],
    ]
        .filter(Boolean)
        .join(' · ');

    // Save Product can be pressed only when everything needed is filled in
    // and nothing typed is wrong; these are what is still missing, each with
    // the message shown under its box.
    const missing = [
        data.name.trim() === '' && {
            key: 'name',
            label: 'Product name',
            message: 'Enter the product name.',
            section: 'product-details',
        },
        status !== 'draft' &&
            data.photos.length === 0 && {
                key: 'photos',
                label: 'Photos',
                message:
                    'Add at least one photo. Only a Draft can be saved without a photo.',
                section: 'product-photos',
            },
        data.sold_by_piece &&
            data.price.trim() === '' && {
                key: 'price',
                label: 'Selling Price per piece',
                message:
                    'Enter the Selling Price per piece (set by Head Office).',
                section: 'product-packs',
            },
        !data.sold_by_piece &&
            !data.packs.some((pack) => pack.sold_to_students) && {
                key: 'sold_by_piece',
                label: 'How students buy it',
                message:
                    'Choose how students buy it: by the piece, by a pack, or both.',
                section: 'product-packs',
            },
        data.packs.some(
            (pack) =>
                pack.name.trim() === '' ||
                pack.pieces.trim() === '' ||
                (pack.sold_to_students && pack.price.trim() === ''),
        ) && {
            key: 'packs',
            label: 'Pack name, pieces and price',
            message:
                'Give every pack a name and its pieces, and a price when students can buy it.',
            section: 'product-packs',
        },
        data.low_stock_alert_at.trim() === '' && {
            key: 'low_stock_alert_at',
            label: 'Notify me when stock falls to',
            message: 'Enter the number of pieces to be warned at, e.g. 5.',
            section: 'product-packs',
        },
        data.options.some(
            (option) => option.choices.length > 0 && option.name.trim() === '',
        ) && {
            key: 'options',
            label: 'Option name',
            message: 'Give every option a name, e.g. Size or Color.',
            section: 'product-options',
        },
        withoutOptions !== null &&
            withoutOptions.stock_on_hand > 0 &&
            combinations[0]?.key !== '' &&
            data.existing_stock_combination === '' && {
                key: 'existing_stock_combination',
                label: 'Which variant the stock on hand is',
                message:
                    'Choose which variant the pieces already in stock are.',
                section: 'product-variants',
            },
        status === 'preorder' &&
            data.preorders_close_on === '' && {
                key: 'preorders_close_on',
                label: 'Preorders close on',
                message: 'Choose the last day students can preorder.',
                section: 'product-status',
            },
        status === 'preorder' &&
            (data.expected_arrival_from === '' ||
                data.expected_arrival_to === '') && {
                key: 'expected_arrival',
                label: 'Expected arrival',
                message:
                    'Choose the first and last day it is expected to arrive.',
                section: 'product-status',
            },
        status === 'preorder' &&
            (data.early_bird_price.trim() === '') !==
                (data.early_bird_pieces.trim() === '') && {
                key: 'early_bird',
                label: 'Early-bird price and pieces',
                message:
                    'Enter both the early-bird price and its pieces, or leave both empty.',
                section: 'product-status',
            },
        (closeDateInPast ||
            arrivalProblem !== undefined ||
            arrivalEndProblem !== undefined) && {
            key: 'preorder_dates',
            label: 'Preorder dates',
            message: 'Correct the preorder dates shown in red.',
            section: 'product-status',
        },
    ].filter(
        (
            item,
        ): item is {
            key: string;
            label: string;
            message: string;
            section: Section;
        } => typeof item === 'object' && item !== null,
    );

    // A required box shows its message once it was left empty, or for every
    // box once the Specialist reaches for the greyed-out Save Product.
    const [touched, setTouched] = useState<string[]>([]);
    const [showAllMissing, setShowAllMissing] = useState(false);
    const touch = (key: string) =>
        setTouched((current) =>
            current.includes(key) ? current : [...current, key],
        );
    const requiredMessage = (key: string): string | undefined =>
        showAllMissing || touched.includes(key)
            ? missing.find((item) => item.key === key)?.message
            : undefined;
    // Save Product first asks "Save this product?".
    const [confirming, setConfirming] = useState(false);
    const askToSave = () => {
        if (missing.length > 0) {
            setShowAllMissing(true);

            return;
        }

        if (!processing) {
            setConfirming(true);
        }
    };

    return (
        <>
            <Head title={product ? 'Edit Product' : 'Add Product'} />

            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    askToSave();
                }}
                className="space-y-7"
            >
                <PageHeader
                    title={product ? 'Edit Product' : 'Add Product'}
                    description="Students and STI staff see the photos, name, price and options on the storefront."
                    actions={
                        <>
                            <Link
                                href={ProductController.index()}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                            >
                                <ArrowLeft size={18} />
                                Back to Products
                            </Link>
                            {product && (
                                <Link
                                    href={ProductStockController.index(
                                        product.id,
                                    )}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                                >
                                    <Boxes size={18} />
                                    Stock History
                                </Link>
                            )}
                        </>
                    }
                />

                <RequiredNote saveLabel="Save Product" />

                {unsaved.prompt}
                {draft.restored && (
                    <DraftRestoredNotice
                        onDiscard={draft.discard}
                        onDismiss={draft.dismiss}
                    />
                )}

                {fromItem && (
                    <section className="flex items-start gap-3 rounded-3xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
                        <Link2 size={20} className="mt-0.5 shrink-0" />
                        <div>
                            <p className="font-black">
                                New product from eStore item{' '}
                                <span className="font-mono">
                                    {fromItem.item_code}
                                </span>{' '}
                                · {fromItem.description}
                            </p>
                            <p className="mt-1 leading-6">
                                Its Item Code is already on the variant below,
                                so its deliveries go into stock when you save.
                                If the item comes in sizes or colors, add the
                                options first, then put{' '}
                                <span className="font-mono">
                                    {fromItem.item_code}
                                </span>{' '}
                                on the right variant.
                            </p>
                        </div>
                    </section>
                )}

                <Panel
                    id="product-photos"
                    className="scroll-mt-24"
                    title={
                        <RequiredLabel required={status !== 'draft'}>
                            Photos
                        </RequiredLabel>
                    }
                    description={`Up to ${MAX_PHOTOS} photos, e.g. the front, back and side of a shirt. The first photo is the main one shown on the storefront. JPG, PNG or WEBP, up to 10 MB each.`}
                >
                    <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {data.photos.map((photo, index) => (
                            <div
                                key={photo.url}
                                className={cn(
                                    'overflow-hidden rounded-2xl border bg-white',
                                    errors[`photos.${index}.file`]
                                        ? 'border-red-300'
                                        : 'border-slate-200',
                                )}
                            >
                                <div className="relative aspect-square bg-slate-100">
                                    <img
                                        src={photo.url}
                                        alt={
                                            photo.label || `Photo ${index + 1}`
                                        }
                                        className="h-full w-full object-cover"
                                    />
                                    {index === 0 && (
                                        <span className="absolute top-2 left-2 rounded-lg bg-[#0D6EFD] px-2 py-1 text-[11px] font-black text-white">
                                            MAIN PHOTO
                                        </span>
                                    )}
                                </div>
                                <div className="space-y-2 p-3">
                                    <input
                                        value={photo.label}
                                        onChange={(event) =>
                                            setData(
                                                'photos',
                                                data.photos.map((current, i) =>
                                                    i === index
                                                        ? {
                                                              ...current,
                                                              label: event
                                                                  .target.value,
                                                          }
                                                        : current,
                                                ),
                                            )
                                        }
                                        list="photo-labels"
                                        maxLength={40}
                                        placeholder="Label, e.g. Front"
                                        className={inputClasses}
                                        aria-label={`Label for photo ${index + 1}`}
                                    />
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex gap-1">
                                            <IconButton
                                                label="Move earlier"
                                                disabled={index === 0}
                                                onClick={() =>
                                                    movePhoto(index, -1)
                                                }
                                            >
                                                <ArrowLeft size={16} />
                                            </IconButton>
                                            <IconButton
                                                label="Move later"
                                                disabled={
                                                    index ===
                                                    data.photos.length - 1
                                                }
                                                onClick={() =>
                                                    movePhoto(index, 1)
                                                }
                                            >
                                                <ArrowRight size={16} />
                                            </IconButton>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setData(
                                                    'photos',
                                                    data.photos.filter(
                                                        (_, i) => i !== index,
                                                    ),
                                                )
                                            }
                                            className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-black text-red-700 transition hover:bg-red-100"
                                        >
                                            <Trash2 size={14} />
                                            Remove
                                        </button>
                                    </div>
                                    <InputError
                                        message={errors[`photos.${index}.file`]}
                                    />
                                </div>
                            </div>
                        ))}

                        {data.photos.length < MAX_PHOTOS && (
                            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-center text-sm font-bold text-slate-500 transition hover:border-blue-300 hover:bg-blue-50/40 hover:text-blue-700">
                                <ImagePlus size={30} />
                                Add photos
                                <span className="text-xs font-medium text-slate-400">
                                    {MAX_PHOTOS - data.photos.length} more
                                    allowed
                                </span>
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    multiple
                                    className="sr-only"
                                    onChange={(event) => {
                                        addPhotos(event.target.files);
                                        event.target.value = '';
                                    }}
                                />
                            </label>
                        )}
                    </div>
                    <datalist id="photo-labels">
                        <option value="Front" />
                        <option value="Back" />
                        <option value="Side" />
                        <option value="Detail" />
                    </datalist>
                    <div className="px-6 pb-6">
                        <InputError
                            message={
                                errors.photos ??
                                firstPhotoError ??
                                requiredMessage('photos')
                            }
                        />
                    </div>
                </Panel>

                <Panel
                    id="product-details"
                    className="scroll-mt-24"
                    title="Details"
                >
                    <div className="grid gap-5 p-6 md:grid-cols-2">
                        <Field
                            label="Product name"
                            required
                            error={errors.name ?? requiredMessage('name')}
                        >
                            <input
                                value={data.name}
                                onChange={(event) =>
                                    setData('name', event.target.value)
                                }
                                onBlur={() => touch('name')}
                                maxLength={120}
                                placeholder="e.g. 42nd Anniversary Shirt"
                                aria-invalid={Boolean(
                                    errors.name ?? requiredMessage('name'),
                                )}
                                className={inputClasses}
                            />
                            {data.name.trim() !== '' &&
                                tidyProductName(data.name) !==
                                    data.name.trim() && (
                                    <p className="mt-1.5 text-xs text-slate-500">
                                        Will be saved as:{' '}
                                        <span className="font-bold text-slate-700">
                                            {tidyProductName(data.name)}
                                        </span>
                                    </p>
                                )}
                        </Field>
                        <Field
                            label="Item Code"
                            hint={
                                data.item_code_typed
                                    ? 'Each variant’s code starts with it, e.g. BP-01-S-RED.'
                                    : 'Made from the name. Each variant’s code starts with it, e.g. BP-01-S-RED. You can change it.'
                            }
                            error={errors.item_code}
                        >
                            <div className="flex gap-2">
                                <input
                                    value={productCode}
                                    onChange={(event) =>
                                        setData((current) => ({
                                            ...current,
                                            item_code:
                                                event.target.value.toUpperCase(),
                                            item_code_typed: true,
                                        }))
                                    }
                                    maxLength={30}
                                    placeholder="Type the product name first"
                                    aria-invalid={Boolean(errors.item_code)}
                                    className={cn(
                                        inputClasses,
                                        'font-mono uppercase placeholder:font-sans placeholder:normal-case',
                                    )}
                                />
                                {data.item_code_typed &&
                                    !product?.item_code && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setData((current) => ({
                                                    ...current,
                                                    item_code: '',
                                                    item_code_typed: false,
                                                }))
                                            }
                                            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                                        >
                                            Make it again
                                        </button>
                                    )}
                            </div>
                        </Field>
                    </div>
                </Panel>

                <Panel
                    id="product-packs"
                    className="scroll-mt-24"
                    title="Pieces and Packs"
                    description="Stock is always counted in pieces. Add a pack when Head Office sends this item in packs, or when students can buy a whole pack, e.g. Pack = 50 pieces. The Selling Price is the price Head Office set; it cannot be below the Cost (what PROWARE paid on the eStore order)."
                >
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-175">
                            <thead className="bg-slate-50">
                                <tr>
                                    <TableHeading>Sold as</TableHeading>
                                    <TableHeading>Pieces in one</TableHeading>
                                    <TableHeading>
                                        Students can buy it
                                    </TableHeading>
                                    <TableHeading>
                                        <RequiredLabel
                                            required={data.sold_by_piece}
                                        >
                                            Selling Price (set by Head Office)
                                        </RequiredLabel>
                                    </TableHeading>
                                    <TableHeading align="right">
                                        <span className="sr-only">Actions</span>
                                    </TableHeading>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-t border-slate-100 align-top">
                                    <td className="px-5 py-4">
                                        <p className="flex h-11 items-center font-black text-slate-900">
                                            Piece
                                        </p>
                                    </td>
                                    <td className="px-5 py-4">
                                        <p className="flex h-11 items-center font-bold text-slate-500">
                                            1
                                        </p>
                                    </td>
                                    <td className="px-5 py-4">
                                        <SellCheckbox
                                            checked={data.sold_by_piece}
                                            onChange={(checked) =>
                                                setData(
                                                    'sold_by_piece',
                                                    checked,
                                                )
                                            }
                                            label="Sell by the piece"
                                        />
                                    </td>
                                    <td className="px-5 py-4">
                                        <PesoInput
                                            value={data.price}
                                            onChange={(value) =>
                                                setData('price', value)
                                            }
                                            placeholder={
                                                data.sold_by_piece
                                                    ? '350'
                                                    : 'Not sold by the piece'
                                            }
                                            disabled={!data.sold_by_piece}
                                            onBlur={() => touch('price')}
                                            invalid={Boolean(
                                                errors.price ??
                                                requiredMessage('price'),
                                            )}
                                            label={
                                                hasVariants
                                                    ? 'Default Selling Price per piece'
                                                    : 'Selling Price per piece'
                                            }
                                        />
                                        {costPerPiece !== null && (
                                            <CostLine
                                                cost={costPerPiece}
                                                price={
                                                    data.sold_by_piece
                                                        ? pesosToCentavos(
                                                              data.price,
                                                          )
                                                        : null
                                                }
                                                unit="piece"
                                            />
                                        )}
                                        {hasVariants && data.sold_by_piece && (
                                            <p className="mt-1 max-w-56 text-xs leading-5 text-slate-500">
                                                {everyVariantPriced
                                                    ? 'Default price. Every variant below has its own price, so this is only used for a variant you leave empty or add later.'
                                                    : 'Default price, used for every variant below without a price of its own.'}
                                            </p>
                                        )}
                                        <InputError
                                            className="mt-1"
                                            message={
                                                errors.price ??
                                                requiredMessage('price')
                                            }
                                        />
                                    </td>
                                    <td className="px-5 py-4" />
                                </tr>

                                {data.packs.map((pack, index) => {
                                    const usedBy = variantsUsingPack(pack.key);

                                    return (
                                        <tr
                                            key={pack.key}
                                            className="border-t border-slate-100 align-top"
                                        >
                                            <td className="px-5 py-4">
                                                <input
                                                    value={pack.name}
                                                    onChange={(event) =>
                                                        updatePack(pack.key, {
                                                            name: event.target
                                                                .value,
                                                        })
                                                    }
                                                    list="pack-names"
                                                    maxLength={30}
                                                    placeholder="e.g. Pack"
                                                    aria-invalid={Boolean(
                                                        errors[
                                                            `packs.${index}.name`
                                                        ],
                                                    )}
                                                    className={cn(
                                                        inputClasses,
                                                        'w-40',
                                                    )}
                                                    aria-label={`Name of pack ${index + 1}`}
                                                />
                                                <InputError
                                                    className="mt-1"
                                                    message={
                                                        errors[
                                                            `packs.${index}.name`
                                                        ]
                                                    }
                                                />
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="flex items-center gap-2">
                                                    <input
                                                        value={pack.pieces}
                                                        onChange={(event) =>
                                                            updatePack(
                                                                pack.key,
                                                                {
                                                                    pieces: digitsOnly(
                                                                        event
                                                                            .target
                                                                            .value,
                                                                    ),
                                                                },
                                                            )
                                                        }
                                                        inputMode="numeric"
                                                        placeholder="50"
                                                        aria-invalid={Boolean(
                                                            errors[
                                                                `packs.${index}.pieces`
                                                            ],
                                                        )}
                                                        className={cn(
                                                            inputClasses,
                                                            'w-28 text-right',
                                                        )}
                                                        aria-label={`Pieces in one ${pack.name || 'pack'}`}
                                                    />
                                                    <span className="text-sm text-slate-500">
                                                        pcs
                                                    </span>
                                                </span>
                                                <InputError
                                                    className="mt-1"
                                                    message={
                                                        errors[
                                                            `packs.${index}.pieces`
                                                        ]
                                                    }
                                                />
                                            </td>
                                            <td className="px-5 py-4">
                                                <SellCheckbox
                                                    checked={
                                                        pack.sold_to_students
                                                    }
                                                    onChange={(checked) =>
                                                        updatePack(pack.key, {
                                                            sold_to_students:
                                                                checked,
                                                        })
                                                    }
                                                    label={`Sell the whole ${pack.name.trim() || 'pack'}`}
                                                />
                                            </td>
                                            <td className="px-5 py-4">
                                                <PesoInput
                                                    value={pack.price}
                                                    onChange={(value) =>
                                                        updatePack(pack.key, {
                                                            price: value,
                                                        })
                                                    }
                                                    placeholder={
                                                        pack.sold_to_students
                                                            ? '900'
                                                            : 'Not sold to students'
                                                    }
                                                    disabled={
                                                        !pack.sold_to_students
                                                    }
                                                    invalid={Boolean(
                                                        errors[
                                                            `packs.${index}.price`
                                                        ],
                                                    )}
                                                    label={`Selling Price of one ${pack.name || 'pack'}`}
                                                />
                                                {costPerPiece !== null &&
                                                    pack.sold_to_students &&
                                                    Number(pack.pieces) > 0 && (
                                                        <CostLine
                                                            cost={
                                                                costPerPiece *
                                                                Number(
                                                                    pack.pieces,
                                                                )
                                                            }
                                                            price={pesosToCentavos(
                                                                pack.price,
                                                            )}
                                                            unit={
                                                                pack.name.trim() ||
                                                                'pack'
                                                            }
                                                        />
                                                    )}
                                                <InputError
                                                    className="mt-1"
                                                    message={
                                                        errors[
                                                            `packs.${index}.price`
                                                        ]
                                                    }
                                                />
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <button
                                                    type="button"
                                                    disabled={usedBy.length > 0}
                                                    title={
                                                        usedBy.length > 0
                                                            ? `Head Office sends ${usedBy.map((combination) => combination.label).join(', ')} in this pack. Change that in Variants first.`
                                                            : undefined
                                                    }
                                                    onClick={() =>
                                                        setData(
                                                            'packs',
                                                            data.packs.filter(
                                                                (current) =>
                                                                    current.key !==
                                                                    pack.key,
                                                            ),
                                                        )
                                                    }
                                                    className="inline-flex h-11 items-center gap-1 rounded-lg px-2 text-sm font-black text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                    <Trash2 size={15} />
                                                    Remove
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <datalist id="pack-names">
                        <option value="Pack" />
                        <option value="Box" />
                        <option value="Bundle" />
                        <option value="Dozen" />
                        <option value="Set" />
                    </datalist>
                    <div className="flex flex-col gap-2 border-t border-slate-100 px-6 py-4">
                        <button
                            type="button"
                            onClick={addPack}
                            disabled={data.packs.length >= MAX_PACKS}
                            className="inline-flex items-center gap-1 self-start rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-600 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <Plus size={14} />
                            Add a pack
                        </button>
                        <InputError
                            message={
                                errors.sold_by_piece ??
                                errors.packs ??
                                requiredMessage('sold_by_piece') ??
                                requiredMessage('packs')
                            }
                        />
                    </div>
                    <div className="border-t border-slate-100 bg-amber-50/40 px-6 py-5">
                        <label className="grid gap-1.5">
                            <span className="flex flex-wrap items-center gap-2 text-sm font-black text-slate-700">
                                <RequiredLabel>
                                    Notify me when stock falls to
                                </RequiredLabel>
                                <input
                                    value={data.low_stock_alert_at}
                                    onBlur={() => touch('low_stock_alert_at')}
                                    onChange={(event) =>
                                        setData(
                                            'low_stock_alert_at',
                                            digitsOnly(event.target.value),
                                        )
                                    }
                                    inputMode="numeric"
                                    placeholder="5"
                                    aria-invalid={Boolean(
                                        errors.low_stock_alert_at ??
                                        requiredMessage('low_stock_alert_at'),
                                    )}
                                    className={cn(
                                        inputClasses,
                                        'w-24 text-right',
                                    )}
                                    aria-label="Low-stock number of pieces"
                                />
                                pcs
                            </span>
                            <span className="text-xs leading-5 text-slate-500">
                                Applies to each variant (e.g. only S/M can be
                                low). You are notified once in the bell, and
                                again after the stock goes back above this
                                number. Enter 0 to be notified only when it runs
                                out. Only Available and On Sale products are
                                watched.
                            </span>
                            <InputError
                                message={
                                    errors.low_stock_alert_at ??
                                    requiredMessage('low_stock_alert_at')
                                }
                            />
                        </label>
                    </div>
                </Panel>

                <Panel
                    id="product-options"
                    className="scroll-mt-24"
                    title="Options"
                    description={`Optional, up to ${MAX_OPTIONS}. Click an option to choose its choices; click another to switch. Size, Program, Color and Capacity have ready-made choices.`}
                >
                    <div className="space-y-4 p-6">
                        <div
                            role="tablist"
                            aria-label="Options"
                            className="flex flex-wrap items-center gap-2"
                        >
                            {Object.keys(optionPresets).map((key) => {
                                const name =
                                    key.charAt(0).toUpperCase() + key.slice(1);
                                const index = data.options.findIndex(
                                    (option) =>
                                        option.name.trim().toLowerCase() ===
                                        key,
                                );

                                return (
                                    <OptionTab
                                        key={key}
                                        label={name}
                                        count={
                                            index === -1
                                                ? null
                                                : data.options[index].choices
                                                      .length
                                        }
                                        active={
                                            index !== -1 &&
                                            index === activeOption
                                        }
                                        hasError={
                                            index !== -1 &&
                                            optionHasError(index)
                                        }
                                        disabled={
                                            index === -1 &&
                                            data.options.length >= MAX_OPTIONS
                                        }
                                        onClick={() =>
                                            showOption(
                                                (option) =>
                                                    option.name
                                                        .trim()
                                                        .toLowerCase() === key,
                                                name,
                                            )
                                        }
                                    />
                                );
                            })}

                            {data.options.map((option, index) =>
                                isPresetName(option.name) ? null : (
                                    <OptionTab
                                        key={`other-${index}`}
                                        label={
                                            option.name.trim() || 'New option'
                                        }
                                        count={option.choices.length}
                                        active={index === activeOption}
                                        hasError={optionHasError(index)}
                                        onClick={() =>
                                            showOption(
                                                (candidate) =>
                                                    candidate === option,
                                                null,
                                            )
                                        }
                                    />
                                ),
                            )}

                            <button
                                type="button"
                                disabled={data.options.length >= MAX_OPTIONS}
                                onClick={() => showOption(() => false, '')}
                                className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-600 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <Plus size={14} />
                                Other option
                            </button>
                        </div>

                        {activeOption === null ||
                        data.options[activeOption] === undefined ? (
                            <p className="text-sm text-slate-500">
                                {data.options.length === 0
                                    ? 'No options. Students buy this product as it is.'
                                    : 'Click an option above to see its choices.'}
                            </p>
                        ) : (
                            <OptionEditor
                                key={activeOption}
                                option={data.options[activeOption]}
                                nameError={
                                    errors[`options.${activeOption}.name`]
                                }
                                choicesError={
                                    errors[`options.${activeOption}.choices`] ??
                                    data.options[activeOption].choices
                                        .map(
                                            (_, choice) =>
                                                errors[
                                                    `options.${activeOption}.choices.${choice}`
                                                ],
                                        )
                                        .find(Boolean)
                                }
                                onChange={(next) =>
                                    updateOption(activeOption, next)
                                }
                                onRemove={() => removeOption(activeOption)}
                            />
                        )}

                        <InputError
                            message={
                                errors.options ?? requiredMessage('options')
                            }
                        />
                    </div>
                    <datalist id="option-names">
                        <option value="Size" />
                        <option value="Program" />
                        <option value="Color" />
                        <option value="Capacity" />
                    </datalist>
                </Panel>

                <Panel
                    id="product-variants"
                    className="scroll-mt-24"
                    title="Variants"
                    description={`Every combination of the options (sizes, colors, departments). Each has its own Item Code, made from the product's code, and its own status: a Draft is hidden from students. Give a variant its own Selling Price when it costs more or less (e.g. a bigger size); leave it empty to use the default${data.sold_by_piece && data.price ? ` (₱${data.price})` : ''}.`}
                >
                    {fromItemCodeMissing && fromItem && (
                        <p className="border-b border-amber-100 bg-amber-50 px-6 py-3 text-sm text-amber-800">
                            This product was started from eStore item{' '}
                            <span className="font-mono font-black">
                                {fromItem.item_code}
                            </span>
                            , but no variant below has that Item Code.
                        </p>
                    )}
                    <div className="space-y-3 border-b border-slate-100 px-6 py-5">
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="grid gap-1.5">
                                <span className="text-sm font-black text-slate-700">
                                    Head Office sends it by
                                </span>
                                <select
                                    value={data.shared_pack_key}
                                    onChange={(event) =>
                                        setData(
                                            'shared_pack_key',
                                            event.target.value,
                                        )
                                    }
                                    aria-invalid={Boolean(sharedPackError)}
                                    className={inputClasses}
                                >
                                    <option value="">Piece</option>
                                    {data.packs.map((pack) => (
                                        <option key={pack.key} value={pack.key}>
                                            {packLabel(pack)}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={sharedPackError} />
                            </label>
                            {someCodesTyped && productCode !== '' && (
                                <div className="grid content-end gap-1.5">
                                    <button
                                        type="button"
                                        onClick={useAutomaticCodes}
                                        className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                                    >
                                        Make every code from {productCode}
                                    </button>
                                </div>
                            )}
                        </div>
                        {withoutOptions !== null &&
                            combinations[0]?.key !== '' && (
                                <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                                    <label className="grid gap-1.5">
                                        <span className="text-sm font-black text-amber-900">
                                            The{' '}
                                            {formatUnits(
                                                withoutOptions.stock_on_hand,
                                                'Piece',
                                            )}{' '}
                                            already in stock: which variant are
                                            they?
                                        </span>
                                        <select
                                            value={
                                                data.existing_stock_combination
                                            }
                                            onChange={(event) =>
                                                setData(
                                                    'existing_stock_combination',
                                                    event.target.value,
                                                )
                                            }
                                            aria-invalid={Boolean(
                                                errors.existing_stock_combination,
                                            )}
                                            className={inputClasses}
                                        >
                                            <option value="">
                                                Choose the variant…
                                            </option>
                                            {combinations.map((combination) => (
                                                <option
                                                    key={combination.key}
                                                    value={combination.key}
                                                >
                                                    {combination.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <p className="text-xs leading-5 text-amber-800">
                                        They keep their stock history and
                                        preorders. The other variants start at 0
                                        pcs. If the pieces are mixed, correct
                                        each variant's stock after saving.
                                    </p>
                                    <InputError
                                        message={
                                            errors.existing_stock_combination ??
                                            requiredMessage(
                                                'existing_stock_combination',
                                            )
                                        }
                                    />
                                </div>
                            )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <TableHeading>Item Code</TableHeading>
                                    <TableHeading>Variant</TableHeading>
                                    <TableHeading>Status</TableHeading>
                                    <TableHeading>
                                        Own Selling Price per piece (optional)
                                    </TableHeading>
                                    {product && (
                                        <TableHeading align="right">
                                            Stock
                                        </TableHeading>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {combinations.map((combination, index) => {
                                    const input = variantInput(combination.key);
                                    const isDraft = input.status === 'draft';
                                    const codeError =
                                        errors[
                                            `variants.${index}.estore_item_code`
                                        ];
                                    const statusError =
                                        errors[`variants.${index}.status`];

                                    return (
                                        <tr
                                            key={combination.key}
                                            className={cn(
                                                'border-t border-slate-100 align-top',
                                                isDraft && 'bg-slate-50/80',
                                            )}
                                        >
                                            <td className="px-5 py-4">
                                                <input
                                                    value={codeOf(
                                                        combination.key,
                                                    )}
                                                    onChange={(event) =>
                                                        updateVariant(
                                                            combination.key,
                                                            {
                                                                code: event.target.value.toUpperCase(),
                                                                code_typed: true,
                                                            },
                                                        )
                                                    }
                                                    maxLength={40}
                                                    placeholder="Item Code"
                                                    aria-label={`Item Code of ${combination.label}`}
                                                    aria-invalid={Boolean(
                                                        codeError,
                                                    )}
                                                    className={cn(
                                                        inputClasses,
                                                        'w-52 font-mono text-xs uppercase',
                                                    )}
                                                />
                                                <InputError
                                                    className="mt-1"
                                                    message={codeError}
                                                />
                                            </td>
                                            <td
                                                className={cn(
                                                    'px-5 py-4 font-black',
                                                    isDraft
                                                        ? 'text-slate-500'
                                                        : 'text-slate-900',
                                                )}
                                            >
                                                <span className="flex min-h-11 items-center">
                                                    {combination.label}
                                                </span>
                                                {isDraft && (
                                                    <span className="block text-xs font-semibold text-slate-500">
                                                        Hidden from students
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                <select
                                                    value={input.status}
                                                    onChange={(event) =>
                                                        updateVariant(
                                                            combination.key,
                                                            {
                                                                status: event
                                                                    .target
                                                                    .value as VariantStatus,
                                                            },
                                                        )
                                                    }
                                                    aria-label={`Status of ${combination.label}`}
                                                    aria-invalid={Boolean(
                                                        statusError,
                                                    )}
                                                    className={cn(
                                                        inputClasses,
                                                        'w-56',
                                                    )}
                                                >
                                                    {statuses.map((choice) => {
                                                        const blocked =
                                                            statusBlockedBecause(
                                                                combination.key,
                                                                choice.value,
                                                            );

                                                        return (
                                                            <option
                                                                key={
                                                                    choice.value
                                                                }
                                                                value={
                                                                    choice.value
                                                                }
                                                                disabled={
                                                                    blocked !==
                                                                        null &&
                                                                    input.status !==
                                                                        choice.value
                                                                }
                                                            >
                                                                {choice.label}
                                                                {blocked !==
                                                                    null &&
                                                                    ` (${blocked})`}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                                <InputError
                                                    className="mt-1"
                                                    message={statusError}
                                                />
                                            </td>
                                            <td className="px-5 py-4">
                                                <PesoInput
                                                    value={input.price}
                                                    onChange={(value) =>
                                                        updateVariant(
                                                            combination.key,
                                                            { price: value },
                                                        )
                                                    }
                                                    placeholder={
                                                        data.sold_by_piece
                                                            ? data.price ||
                                                              'Price per piece'
                                                            : 'Not sold by the piece'
                                                    }
                                                    disabled={
                                                        !data.sold_by_piece
                                                    }
                                                    invalid={Boolean(
                                                        errors[
                                                            `variants.${index}.price`
                                                        ],
                                                    )}
                                                    label={`Price for ${combination.label}`}
                                                />
                                                <InputError
                                                    className="mt-1"
                                                    message={
                                                        errors[
                                                            `variants.${index}.price`
                                                        ]
                                                    }
                                                />
                                            </td>
                                            {product && (
                                                <td className="px-5 py-4 text-right">
                                                    <p className="flex h-11 items-center justify-end gap-1">
                                                        <span className="font-black text-slate-900">
                                                            {(
                                                                stockByCombination[
                                                                    combination
                                                                        .key
                                                                ] ?? 0
                                                            ).toLocaleString(
                                                                'en-PH',
                                                            )}
                                                        </span>
                                                        <span className="text-xs text-slate-500">
                                                            pcs
                                                        </span>
                                                    </p>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Panel>
                <Panel
                    id="product-status"
                    className="scroll-mt-24"
                    title="Where it shows"
                    description="Set each variant's status in the Variants table. The product shows as Available when any variant is, else as a Preorder when any variant is, else it stays a Draft. To put it on sale, use Put on Sale on the Products list."
                >
                    {status === 'on_sale' ? (
                        <div className="m-6 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex items-start gap-3">
                                <Flame size={20} className="mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-black">
                                        On Sale
                                        {product?.sale_ends_at &&
                                            ` until ${formatDateTime(product.sale_ends_at)}`}
                                    </p>
                                    <p className="mt-1 leading-6">
                                        It goes back to Available by itself when
                                        the sale ends. To end it now, press End
                                        sale. To change the sale price or the
                                        days, use Change sale on the Products
                                        list.
                                    </p>
                                </div>
                            </div>
                            {product && (
                                <EndSaleButton
                                    productId={product.id}
                                    productName={product.name}
                                    onEnded={() =>
                                        setData('status', 'available')
                                    }
                                    className="shrink-0 self-start"
                                />
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4 p-6">
                            <div className="rounded-2xl border-2 border-[#0D6EFD] bg-blue-50 p-4">
                                <p className="font-black text-slate-900">
                                    Shows as:{' '}
                                    {
                                        statuses.find(
                                            (choice) => choice.value === status,
                                        )?.label
                                    }
                                    {hasVariants && (
                                        <span className="font-semibold text-slate-600">
                                            {' '}
                                            ({statusCounts})
                                        </span>
                                    )}
                                </p>
                                <p className="mt-1 text-sm leading-5 text-slate-600">
                                    {
                                        statuses.find(
                                            (choice) => choice.value === status,
                                        )?.description
                                    }
                                </p>
                            </div>
                            {hasVariants && (
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-black text-slate-700">
                                        Set every variant to:
                                    </span>
                                    {statuses.map((choice) => (
                                        <button
                                            key={choice.value}
                                            type="button"
                                            disabled={combinations.every(
                                                (combination) =>
                                                    statusBlockedBecause(
                                                        combination.key,
                                                        choice.value,
                                                    ) !== null,
                                            )}
                                            onClick={() =>
                                                setEveryStatus(choice.value)
                                            }
                                            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            {choice.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {!hasVariants && (
                                <p className="text-sm text-slate-500">
                                    Change it with the Status in the Variants
                                    table above.
                                </p>
                            )}
                        </div>
                    )}{' '}
                    {status === 'preorder' && (
                        <div className="border-t border-slate-100 bg-amber-50/40 px-6 py-5">
                            <div className="max-w-md space-y-4">
                                <Field
                                    label="Preorders close on"
                                    required
                                    hint="The last day students can preorder. You can move it later on the Preorders page to collect more."
                                    error={
                                        closeDateInPast
                                            ? 'The close date cannot be in the past.'
                                            : (errors.preorders_close_on ??
                                              requiredMessage(
                                                  'preorders_close_on',
                                              ))
                                    }
                                >
                                    <input
                                        type="date"
                                        value={data.preorders_close_on}
                                        min={today}
                                        onChange={(event) =>
                                            changeCloseDate(event.target.value)
                                        }
                                        onBlur={() =>
                                            touch('preorders_close_on')
                                        }
                                        aria-invalid={
                                            closeDateInPast ||
                                            Boolean(
                                                errors.preorders_close_on ??
                                                requiredMessage(
                                                    'preorders_close_on',
                                                ),
                                            )
                                        }
                                        className={inputClasses}
                                    />
                                </Field>
                                <Field
                                    label="Expected arrival"
                                    required
                                    hint="Filled in as 2 to 3 weeks after the close date. Change it when Head Office says otherwise; students who preordered are notified."
                                    error={
                                        arrivalProblem ??
                                        arrivalEndProblem ??
                                        errors.expected_arrival_from ??
                                        errors.expected_arrival_to ??
                                        requiredMessage('expected_arrival')
                                    }
                                >
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="date"
                                            value={data.expected_arrival_from}
                                            min={
                                                data.preorders_close_on || today
                                            }
                                            onChange={(event) => {
                                                setArrivalChosen(true);
                                                setData(
                                                    'expected_arrival_from',
                                                    event.target.value,
                                                );
                                            }}
                                            onBlur={() =>
                                                touch('expected_arrival')
                                            }
                                            aria-label="Expected arrival, first day"
                                            aria-invalid={
                                                Boolean(arrivalProblem) ||
                                                Boolean(
                                                    errors.expected_arrival_from,
                                                )
                                            }
                                            className={inputClasses}
                                        />
                                        <span className="text-sm font-bold text-slate-500">
                                            to
                                        </span>
                                        <input
                                            type="date"
                                            value={data.expected_arrival_to}
                                            min={
                                                data.expected_arrival_from ||
                                                today
                                            }
                                            onChange={(event) => {
                                                setArrivalChosen(true);
                                                setData(
                                                    'expected_arrival_to',
                                                    event.target.value,
                                                );
                                            }}
                                            onBlur={() =>
                                                touch('expected_arrival')
                                            }
                                            aria-label="Expected arrival, last day"
                                            aria-invalid={
                                                Boolean(arrivalEndProblem) ||
                                                Boolean(
                                                    errors.expected_arrival_to,
                                                )
                                            }
                                            className={inputClasses}
                                        />
                                    </div>
                                </Field>
                                <Field
                                    label="Early-bird price (optional)"
                                    hint="A lower price per piece for the first pieces preordered, first come, first served. Leave both empty for no early-bird price."
                                    error={
                                        errors.early_bird_price ??
                                        errors.early_bird_pieces ??
                                        requiredMessage('early_bird')
                                    }
                                >
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="w-32">
                                            <PesoInput
                                                value={data.early_bird_price}
                                                onChange={(value) =>
                                                    setData(
                                                        'early_bird_price',
                                                        value,
                                                    )
                                                }
                                                placeholder="300"
                                                label="Early-bird price per piece"
                                                invalid={Boolean(
                                                    errors.early_bird_price,
                                                )}
                                            />
                                        </span>
                                        <span className="text-sm font-bold text-slate-500">
                                            for the first
                                        </span>
                                        <input
                                            value={data.early_bird_pieces}
                                            onChange={(event) =>
                                                setData(
                                                    'early_bird_pieces',
                                                    digitsOnly(
                                                        event.target.value,
                                                    ),
                                                )
                                            }
                                            inputMode="numeric"
                                            placeholder="20"
                                            aria-label="Pieces at the early-bird price"
                                            aria-invalid={Boolean(
                                                errors.early_bird_pieces,
                                            )}
                                            className={cn(inputClasses, 'w-24')}
                                        />
                                        <span className="text-sm font-bold text-slate-500">
                                            pcs
                                        </span>
                                    </div>
                                </Field>
                            </div>
                        </div>
                    )}
                    <div className="px-6 pb-6">
                        <InputError message={errors.status} />
                    </div>
                </Panel>

                {problems.length > 0 && (
                    <section
                        role="alert"
                        className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-900"
                    >
                        <p className="font-black">
                            {problems.length === 1
                                ? 'Correct the following field before saving:'
                                : `Correct the following ${problems.length} fields before saving:`}
                        </p>
                        <ul className="mt-3 space-y-2">
                            {problems.map((problem) => (
                                <li
                                    key={problem.key}
                                    className="flex flex-col gap-2 rounded-2xl border border-red-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <span>
                                        <span className="font-black">
                                            {problem.place}:
                                        </span>{' '}
                                        {problem.message}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => jumpTo(problem.section)}
                                        className="shrink-0 self-start rounded-xl border border-red-300 bg-white px-3 py-1.5 text-sm font-black text-red-700 transition hover:bg-red-50 sm:self-auto"
                                    >
                                        Go to field
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                <p className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-600 shadow-sm">
                    <span className="font-black text-slate-800">Summary:</span>{' '}
                    {summary}
                </p>

                {missing.length > 0 && (
                    <section
                        className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
                        data-test="save-product-missing"
                    >
                        <p className="font-black">
                            Save Product works once{' '}
                            {missing.length === 1
                                ? 'this is filled in:'
                                : `these ${missing.length} are filled in:`}
                        </p>
                        <ul className="mt-3 space-y-2">
                            {missing.map((item) => (
                                <li
                                    key={item.key}
                                    className="flex flex-col gap-2 rounded-2xl border border-amber-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <span>
                                        <span className="font-black">
                                            {item.label}:
                                        </span>{' '}
                                        {item.message}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowAllMissing(true);
                                            jumpTo(item.section);
                                        }}
                                        className="shrink-0 self-start rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-sm font-black text-amber-800 transition hover:bg-amber-50 sm:self-auto"
                                    >
                                        Go to field
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <Link
                        href={ProductController.index()}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                        Cancel
                    </Link>
                    {/* Reaching for the greyed-out button shows every
                        message under the boxes still to fill in. */}
                    <span
                        className={cn(
                            'inline-flex',
                            missing.length > 0 && 'cursor-not-allowed',
                        )}
                        onMouseEnter={() =>
                            missing.length > 0 && setShowAllMissing(true)
                        }
                        onClick={() =>
                            missing.length > 0 && setShowAllMissing(true)
                        }
                    >
                        <button
                            type="submit"
                            disabled={processing || missing.length > 0}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0D6EFD] px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-60"
                            data-test="save-product-button"
                        >
                            {processing ? (
                                <LoaderCircle
                                    size={18}
                                    className="animate-spin"
                                />
                            ) : (
                                <Save size={18} />
                            )}
                            {processing ? 'Saving...' : 'Save Product'}
                        </button>
                    </span>
                </div>
            </form>
            <ConfirmDialog
                open={confirming}
                title="Save this product?"
                description={
                    <span className="block space-y-1">
                        <span className="block">{summary}</span>
                        {status === 'draft' ? (
                            <span className="block">
                                It stays hidden from students.
                            </span>
                        ) : (
                            <span className="block">
                                Students and STI staff will see it in the store.
                            </span>
                        )}
                    </span>
                }
                confirmLabel="Save Product"
                cancelLabel="Go back"
                busy={processing}
                onConfirm={() => {
                    setConfirming(false);
                    submit();
                }}
                onClose={() => setConfirming(false)}
            />
        </>
    );
}

function Field({
    label,
    hint,
    error,
    required = false,
    children,
}: {
    label: string;
    hint?: string;
    error?: string;
    /** Shows "*label required" in red: the box must be filled in. */
    required?: boolean;
    children: ReactNode;
}) {
    return (
        <label className="grid gap-1.5">
            <span className="text-sm font-black text-slate-700">
                <RequiredLabel required={required}>{label}</RequiredLabel>
            </span>
            {children}
            {hint && <span className="text-xs text-slate-500">{hint}</span>}
            <InputError message={error} />
        </label>
    );
}

/**
 * The Cost (what PROWARE paid on the eStore order) beside a Selling Price,
 * in red when the price is below it (saving is refused then).
 */
function CostLine({
    cost,
    price,
    unit,
}: {
    cost: number;
    price: number | null;
    unit: string;
}) {
    const below = price !== null && price < cost;

    return (
        <p
            className={cn(
                'mt-1 max-w-56 text-xs leading-5 font-bold',
                below ? 'text-red-600' : 'text-slate-500',
            )}
        >
            Cost on the eStore order: {formatPeso(cost)} per {unit}.
            {below && ' The Selling Price cannot be lower.'}
        </p>
    );
}

function PesoInput({
    value,
    onChange,
    onBlur,
    placeholder,
    label,
    disabled,
    invalid = false,
}: {
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    placeholder?: string;
    label?: string;
    disabled?: boolean;
    /** Outlined in red: saving was refused because of this price. */
    invalid?: boolean;
}) {
    return (
        <span className="relative block">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm font-bold text-slate-400">
                ₱
            </span>
            <input
                value={disabled ? '' : value}
                // Up to ₱100,000.00; endless numbers cannot be typed.
                onChange={(event) => onChange(priceInput(event.target.value))}
                onBlur={onBlur}
                inputMode="decimal"
                placeholder={placeholder}
                aria-label={label}
                aria-invalid={invalid && !disabled}
                disabled={disabled}
                className={cn(
                    inputClasses,
                    'pl-7 disabled:cursor-not-allowed disabled:bg-slate-50',
                )}
            />
        </span>
    );
}

/**
 * The "Students can buy it" tick box of a piece or a pack.
 */
function SellCheckbox({
    checked,
    onChange,
    label,
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
}) {
    return (
        <label
            className={cn(
                'inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-bold transition',
                checked
                    ? 'border-[#0D6EFD] bg-blue-50 text-blue-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
            )}
        >
            <input
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                className="h-4 w-4 shrink-0 accent-[#0D6EFD]"
            />
            {label}
        </label>
    );
}

function IconButton({
    label,
    disabled,
    onClick,
    children,
}: {
    label: string;
    disabled?: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
            {children}
        </button>
    );
}

/**
 * One option in the row of option tabs, with how many choices it has.
 * An option the product does not have yet shows a "+".
 */
function OptionTab({
    label,
    count,
    active,
    hasError,
    disabled,
    onClick,
}: {
    label: string;
    count: number | null;
    active: boolean;
    hasError: boolean;
    disabled?: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={onClick}
            className={cn(
                'inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40',
                active
                    ? 'border-[#0D6EFD] bg-[#0D6EFD] text-white'
                    : hasError
                      ? 'border-red-300 bg-red-50 text-red-700 hover:border-red-400'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700',
            )}
        >
            {count === null && <Plus size={14} />}
            {label}
            {count !== null && (
                <span
                    className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-black',
                        active
                            ? 'bg-white/25 text-white'
                            : count === 0
                              ? 'bg-slate-100 text-slate-500'
                              : 'bg-blue-100 text-blue-700',
                    )}
                >
                    {count}
                </span>
            )}
        </button>
    );
}

/**
 * One option: its name (e.g. Size) and its choices. For common options
 * (Size, Program, Color, Capacity) the ready-made choices are a checklist
 * to tick; anything else is typed in a box opened by "Add choice" (Enter,
 * a comma or "Add"). Ticked choices keep the checklist's order, typed ones
 * follow.
 */
function OptionEditor({
    option,
    nameError,
    choicesError,
    onChange,
    onRemove,
}: {
    option: ProductOptionInput;
    nameError?: string;
    choicesError?: string;
    onChange: (option: ProductOptionInput) => void;
    onRemove: () => void;
}) {
    const [draft, setDraft] = useState('');
    const [duplicate, setDuplicate] = useState<string | null>(null);
    // The typing box opens only after "Add choice" is pressed.
    const [adding, setAdding] = useState(false);

    const preset = presetChoices(option.name);
    const sameChoice = (a: string, b: string) =>
        a.toLowerCase() === b.toLowerCase();
    const isTicked = (choice: string) =>
        option.choices.some((existing) => sameChoice(existing, choice));
    const typedChoices = preset
        ? option.choices.filter(
              (choice) => !preset.some((ready) => sameChoice(ready, choice)),
          )
        : option.choices;

    const setChoices = (choices: string[]) => {
        setDuplicate(null);
        onChange({ ...option, choices });
    };

    const toggle = (choice: string) => {
        if (!preset) {
            return;
        }

        const ticked = preset.filter((ready) =>
            sameChoice(ready, choice) ? !isTicked(ready) : isTicked(ready),
        );

        setChoices([...ticked, ...typedChoices]);
    };

    const addChoice = () => {
        const choice = draft.trim().replace(/,$/, '').trim();

        if (choice === '') {
            return;
        }

        if (option.choices.some((existing) => sameChoice(existing, choice))) {
            setDuplicate(`"${choice}" is already a choice.`);

            return;
        }

        if (preset?.some((ready) => sameChoice(ready, choice))) {
            setDraft('');
            toggle(choice);

            return;
        }

        setChoices([...option.choices, choice]);
        setDraft('');
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            addChoice();
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            closeTyping();
        }
    };

    const closeTyping = () => {
        setDraft('');
        setDuplicate(null);
        setAdding(false);
    };

    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                {preset ? (
                    <p className="text-lg font-black text-slate-900">
                        {option.name.trim()}
                    </p>
                ) : (
                    <div className="md:w-64">
                        <span className="text-sm font-black text-slate-700">
                            Option name
                        </span>
                        <input
                            value={option.name}
                            onChange={(event) =>
                                onChange({
                                    ...option,
                                    name: event.target.value,
                                })
                            }
                            list="option-names"
                            maxLength={40}
                            placeholder="e.g. Design"
                            className={cn(inputClasses, 'mt-1.5')}
                        />
                        <InputError className="mt-1" message={nameError} />
                    </div>
                )}

                <button
                    type="button"
                    onClick={onRemove}
                    className="inline-flex items-center gap-1.5 self-start rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-black text-red-700 transition hover:bg-red-100 md:self-auto"
                >
                    <Trash2 size={15} />
                    Remove option
                </button>
            </div>

            <div className="mt-4">
                <span className="text-sm font-black text-slate-700">
                    Choices
                </span>
                {option.choices.length === 0 && (
                    <p className="mt-1 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        No choices yet — tick at least one to use this option.
                        Until then it stays here but isn't saved with the
                        product.
                    </p>
                )}
                {preset && (
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                        {preset.map((choice) => (
                            <label
                                key={choice}
                                className={cn(
                                    'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition',
                                    isTicked(choice)
                                        ? 'border-[#0D6EFD] bg-blue-50 text-blue-800'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                                )}
                            >
                                <input
                                    type="checkbox"
                                    checked={isTicked(choice)}
                                    onChange={() => toggle(choice)}
                                    className="h-4 w-4 shrink-0 accent-[#0D6EFD]"
                                />
                                {choice}
                            </label>
                        ))}
                    </div>
                )}
                {preset && (
                    <span className="mt-4 block text-xs font-bold tracking-wide text-slate-400 uppercase">
                        Other (not in the list)
                    </span>
                )}
                {(typedChoices.length > 0 || adding) && (
                    <div className="mt-1.5 flex min-h-11 flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                        {typedChoices.map((choice) => (
                            <span
                                key={choice}
                                className="inline-flex items-center gap-1 rounded-lg bg-blue-100 py-1 pr-1 pl-2.5 text-sm font-bold text-blue-800"
                            >
                                {choice}
                                <button
                                    type="button"
                                    onClick={() =>
                                        setChoices(
                                            option.choices.filter(
                                                (current) => current !== choice,
                                            ),
                                        )
                                    }
                                    className="rounded p-0.5 hover:bg-blue-200"
                                    aria-label={`Remove ${choice}`}
                                >
                                    <X size={13} />
                                </button>
                            </span>
                        ))}
                        {adding && (
                            <>
                                <input
                                    value={draft}
                                    onChange={(event) =>
                                        setDraft(event.target.value)
                                    }
                                    onKeyDown={onKeyDown}
                                    maxLength={40}
                                    autoFocus
                                    placeholder="Type a choice, then press Enter"
                                    className="h-8 min-w-32 flex-1 bg-transparent px-1.5 text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                                    aria-label={`Add a choice to ${option.name || 'this option'}`}
                                />
                                <button
                                    type="button"
                                    onClick={addChoice}
                                    className="rounded-xl bg-[#0D6EFD] px-4 py-2 text-sm font-black text-white transition hover:bg-blue-700"
                                >
                                    Add
                                </button>
                                <button
                                    type="button"
                                    onClick={closeTyping}
                                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                                >
                                    Done
                                </button>
                            </>
                        )}
                    </div>
                )}
                {!adding && (
                    <button
                        type="button"
                        onClick={() => setAdding(true)}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-100"
                    >
                        <Plus size={15} />
                        {preset ? 'Add a choice not in the list' : 'Add choice'}
                    </button>
                )}{' '}
                <InputError
                    className="mt-1"
                    message={duplicate ?? choicesError}
                />
            </div>
        </div>
    );
}
