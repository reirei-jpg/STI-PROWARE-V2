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
import EndSaleButton from '@/components/end-sale-button';
import InputError from '@/components/input-error';
import PageHeader from '@/components/page-header';
import Panel, { TableHeading } from '@/components/panel';
import { formatDateTime } from '@/lib/format';
import { optionPresets, presetChoices } from '@/lib/product-option-presets';
import { variantCombinations } from '@/lib/product-variants';
import { cn } from '@/lib/utils';
import type {
    EditableProduct,
    ProductFromItem,
    ProductOptionInput,
    ProductPackInput,
    ProductStatus,
} from '@/types';

const MAX_PHOTOS = 6;
const MAX_OPTIONS = 3;
const MAX_PACKS = 5;

type PhotoInput = {
    id: number | null;
    url: string;
    file: File | null;
    label: string;
};

type VariantInput = {
    estore_item_code: string;
    estore_pack_key: string;
    price: string;
};

type ProductFormData = {
    name: string;
    sold_by_piece: boolean;
    price: string;
    status: ProductStatus;
    preorders_close_on: string;
    low_stock_alert_at: string;
    photos: PhotoInput[];
    packs: ProductPackInput[];
    options: ProductOptionInput[];
    variant_inputs: Record<string, VariantInput>;
    /** Every variant shares one eStore Item Code (e.g. every color). */
    shares_item_code: boolean;
    shared_item_code: string;
    shared_pack_key: string;
};

const emptyVariantInput: VariantInput = {
    estore_item_code: '',
    estore_pack_key: '',
    price: '',
};

/** Keeps only digits, so "50 pcs" becomes "50". */
const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, 6);

const statuses: { value: ProductStatus; label: string; description: string }[] =
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
    'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

export default function ProductForm({
    product,
    fromItem,
    today,
}: {
    product: EditableProduct | null;
    fromItem: ProductFromItem | null;
    /** Today in the school's time zone, "YYYY-MM-DD". */
    today: string;
}) {
    // A saved product whose variants all have the same code shares it.
    const savedVariants = product?.variants ?? [];
    const savedSharedVariant =
        savedVariants.length > 1 &&
        savedVariants[0].estore_item_code !== '' &&
        savedVariants.every(
            (variant) =>
                variant.estore_item_code === savedVariants[0].estore_item_code,
        )
            ? savedVariants[0]
            : null;

    const form = useForm<ProductFormData>({
        name: product?.name ?? fromItem?.description.slice(0, 120) ?? '',
        sold_by_piece: product?.sold_by_piece ?? true,
        price: product?.price ?? '',
        status: product?.status ?? 'draft',
        preorders_close_on: product?.preorders_close_on ?? '',
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
        variant_inputs: product
            ? Object.fromEntries(
                  product.variants.map((variant) => [
                      variant.combination,
                      {
                          estore_item_code: variant.estore_item_code,
                          estore_pack_key: variant.estore_pack_key,
                          price: variant.price,
                      },
                  ]),
              )
            : fromItem
              ? {
                    '': {
                        ...emptyVariantInput,
                        estore_item_code: fromItem.item_code,
                    },
                }
              : {},
        shares_item_code: savedSharedVariant !== null,
        shared_item_code:
            savedSharedVariant?.estore_item_code ?? fromItem?.item_code ?? '',
        shared_pack_key: savedSharedVariant?.estore_pack_key ?? '',
    });

    const { data, setData, processing } = form;
    const errors = form.errors as Record<string, string | undefined>;
    const combinations = variantCombinations(
        data.options.filter(
            (option) => option.name.trim() !== '' && option.choices.length > 0,
        ),
    );
    const stockByCombination = Object.fromEntries(
        (product?.variants ?? []).map((variant) => [
            variant.combination,
            variant.stock_on_hand,
        ]),
    );
    const variantInput = (key: string): VariantInput =>
        data.variant_inputs[key] ?? emptyVariantInput;
    // Sharing one code only applies when there are several variants.
    const sharesItemCode = data.shares_item_code && combinations.length > 1;
    // With variants, the price per piece is the default for those without
    // a price of their own.
    const hasVariants = combinations.length > 1;
    const everyVariantPriced =
        hasVariants &&
        combinations.every(
            (combination) => variantInput(combination.key).price.trim() !== '',
        );
    /** The code and pack a variant is saved with, shared or its own. */
    const savedCodeAndPack = (key: string) =>
        sharesItemCode
            ? {
                  estore_item_code: data.shared_item_code,
                  estore_pack_key: data.shared_pack_key,
              }
            : {
                  estore_item_code: variantInput(key).estore_item_code,
                  estore_pack_key: variantInput(key).estore_pack_key,
              };

    // A new close date cannot be before today; a date already saved that
    // has passed (preorders closed) may stay as it is.
    const closeDateInPast =
        data.status === 'preorder' &&
        data.preorders_close_on !== '' &&
        data.preorders_close_on < today &&
        data.preorders_close_on !== (product?.preorders_close_on ?? '');

    // New packs get a key of their own until they are saved.
    const nextPackNumber = useRef(1);

    // Free the previews of newly chosen photos when leaving the page.
    const previews = useRef<string[]>([]);
    useEffect(
        () => () => previews.current.forEach((url) => URL.revokeObjectURL(url)),
        [],
    );

    const submit = () => {
        form.transform((current) => ({
            name: current.name,
            sold_by_piece: current.sold_by_piece,
            price: current.sold_by_piece ? current.price : '',
            status: current.status,
            preorders_close_on:
                current.status === 'preorder' ? current.preorders_close_on : '',
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
            variants: combinations.map((combination) => {
                const input =
                    current.variant_inputs[combination.key] ??
                    emptyVariantInput;

                return {
                    combination: combination.key,
                    ...savedCodeAndPack(combination.key),
                    price: current.sold_by_piece ? input.price : '',
                };
            }),
            ...(product ? { _method: 'put' } : {}),
        }));

        form.post(
            product
                ? ProductController.update(product.id).url
                : ProductController.store().url,
            { forceFormData: true, preserveScroll: true },
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

    const updateVariant = (
        key: string,
        field: keyof VariantInput,
        value: string,
    ) =>
        setData('variant_inputs', {
            ...data.variant_inputs,
            [key]: { ...variantInput(key), [field]: value },
        });

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
        combinations.filter(
            (combination) =>
                savedCodeAndPack(combination.key).estore_pack_key === key,
        );

    const packLabel = (pack: ProductPackInput) =>
        `${pack.name.trim() || 'Pack'} (${pack.pieces || '?'} pcs)`;

    // The eStore item this product is created from, if its code is no
    // longer on any variant (e.g. after options were added).
    const fromItemCodeMissing =
        fromItem !== null &&
        !combinations.some(
            (combination) =>
                savedCodeAndPack(combination.key)
                    .estore_item_code.trim()
                    .toUpperCase() === fromItem.item_code,
        );

    // Server errors for the shared code come back on the variants.
    const sharedCodeError = combinations
        .map((_, index) => errors[`variants.${index}.estore_item_code`])
        .find(Boolean);
    const sharedPackError = combinations
        .map((_, index) => errors[`variants.${index}.estore_pack_key`])
        .find(Boolean);

    const firstPhotoError = data.photos
        .map((_, index) => errors[`photos.${index}.file`])
        .find(Boolean);

    return (
        <>
            <Head title={product ? 'Edit Product' : 'Add Product'} />

            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                }}
                className="space-y-7"
            >
                <PageHeader
                    title={product ? 'Edit Product' : 'Add Product'}
                    description="Students see the photos, name, price and options on the storefront."
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
                                Its eStore Item Code is already on the variant
                                below, so its deliveries go into stock when you
                                save. If the item comes in sizes or colors, add
                                the options first, then put{' '}
                                <span className="font-mono">
                                    {fromItem.item_code}
                                </span>{' '}
                                on the right variant.
                            </p>
                        </div>
                    </section>
                )}

                <Panel
                    title="Photos"
                    description={`Up to ${MAX_PHOTOS} photos, e.g. the front, back and side of a shirt. The first photo is the main one shown on the storefront. JPG, PNG or WEBP, up to 5 MB each.`}
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
                                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-black text-red-600 transition hover:bg-red-50"
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
                            message={errors.photos ?? firstPhotoError}
                        />
                    </div>
                </Panel>

                <Panel title="Details">
                    <div className="grid gap-5 p-6 md:grid-cols-2">
                        <Field label="Product name" error={errors.name}>
                            <input
                                value={data.name}
                                onChange={(event) =>
                                    setData('name', event.target.value)
                                }
                                maxLength={120}
                                placeholder="e.g. 42nd Anniversary Shirt"
                                className={inputClasses}
                            />
                        </Field>
                    </div>
                </Panel>

                <Panel
                    title="Pieces and Packs"
                    description="Stock is always counted in pieces. Add a pack when Head Office sends this item in packs, or when students can buy a whole pack, e.g. Pack = 50 pieces. Student prices are what students pay, not the Head Office cost."
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
                                    <TableHeading>Student price</TableHeading>
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
                                            label={
                                                hasVariants
                                                    ? 'Default price per piece'
                                                    : 'Price per piece'
                                            }
                                        />
                                        {hasVariants && data.sold_by_piece && (
                                            <p className="mt-1 max-w-56 text-xs leading-5 text-slate-500">
                                                {everyVariantPriced
                                                    ? 'Default price. Every variant below has its own price, so this is only used for a variant you leave empty or add later.'
                                                    : 'Default price, used for every variant below without a price of its own.'}
                                            </p>
                                        )}
                                        <InputError
                                            className="mt-1"
                                            message={errors.price}
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
                                                    label={`Price of one ${pack.name || 'pack'}`}
                                                />
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
                            message={errors.sold_by_piece ?? errors.packs}
                        />
                    </div>
                    <div className="border-t border-slate-100 bg-amber-50/40 px-6 py-5">
                        <label className="grid gap-1.5">
                            <span className="flex flex-wrap items-center gap-2 text-sm font-black text-slate-700">
                                Notify me when stock falls to
                                <input
                                    value={data.low_stock_alert_at}
                                    onChange={(event) =>
                                        setData(
                                            'low_stock_alert_at',
                                            digitsOnly(event.target.value),
                                        )
                                    }
                                    inputMode="numeric"
                                    placeholder="5"
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
                                low). You are told once in the bell, and again
                                after the stock goes back above this number.
                                Enter 0 to be told only when it runs out. Only
                                Available and On Sale products are watched.
                            </span>
                            <InputError message={errors.low_stock_alert_at} />
                        </label>
                    </div>
                </Panel>

                <Panel
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

                        <InputError message={errors.options} />
                    </div>
                    <datalist id="option-names">
                        <option value="Size" />
                        <option value="Program" />
                        <option value="Color" />
                        <option value="Capacity" />
                    </datalist>
                </Panel>

                <Panel
                    title="Variants"
                    description={`Every combination of the options. Add the eStore Item Code so deliveries from uploaded purchase orders go into the right variant's stock, and choose how Head Office sends it. Give a variant its own price when it costs more or less (e.g. a bigger size); leave it empty to use the default price per piece${data.sold_by_piece && data.price ? ` (₱${data.price})` : ''}.`}
                >
                    {fromItemCodeMissing && fromItem && (
                        <p className="border-b border-amber-100 bg-amber-50 px-6 py-3 text-sm text-amber-800">
                            <span className="font-mono font-black">
                                {fromItem.item_code}
                            </span>{' '}
                            is not on any variant yet. Type it on the variant
                            that matches {fromItem.description}, or choose "One
                            code for all variants" if every variant comes under
                            this code.
                        </p>
                    )}
                    {combinations.length > 1 && (
                        <div className="space-y-4 border-b border-slate-100 px-6 py-5">
                            <div>
                                <p className="text-sm font-black text-slate-700">
                                    eStore Item Code
                                </p>
                                <div className="mt-2 grid gap-2 md:grid-cols-2">
                                    <CodeModeChoice
                                        checked={!sharesItemCode}
                                        onChange={() =>
                                            setData('shares_item_code', false)
                                        }
                                        title="Each variant has its own code"
                                        description="e.g. Chibi Keychain IT and Chibi Keychain HRM are different eStore items."
                                    />
                                    <CodeModeChoice
                                        checked={sharesItemCode}
                                        onChange={() =>
                                            setData({
                                                ...data,
                                                shares_item_code: true,
                                                shared_item_code:
                                                    data.shared_item_code ||
                                                    (combinations
                                                        .map(
                                                            (combination) =>
                                                                variantInput(
                                                                    combination.key,
                                                                )
                                                                    .estore_item_code,
                                                        )
                                                        .find(Boolean) ??
                                                        ''),
                                            })
                                        }
                                        title="One code for all variants"
                                        description="e.g. one STI Umbrella code for every color. When it arrives, you enter how many of each you received."
                                    />
                                </div>
                            </div>
                            {sharesItemCode && (
                                <div className="grid gap-4 md:grid-cols-2">
                                    <label className="grid gap-1.5">
                                        <span className="text-sm font-black text-slate-700">
                                            eStore Item Code for all variants
                                        </span>
                                        <input
                                            value={data.shared_item_code}
                                            onChange={(event) =>
                                                setData(
                                                    'shared_item_code',
                                                    event.target.value,
                                                )
                                            }
                                            maxLength={40}
                                            placeholder="e.g. PRUM01-01"
                                            className={cn(
                                                inputClasses,
                                                'font-mono uppercase',
                                            )}
                                        />
                                        <InputError message={sharedCodeError} />
                                    </label>
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
                                            className={inputClasses}
                                        >
                                            <option value="">Piece</option>
                                            {data.packs.map((pack) => (
                                                <option
                                                    key={pack.key}
                                                    value={pack.key}
                                                >
                                                    {packLabel(pack)}
                                                </option>
                                            ))}
                                        </select>
                                        <InputError message={sharedPackError} />
                                    </label>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-225">
                            <thead className="bg-slate-50">
                                <tr>
                                    <TableHeading>Variant</TableHeading>
                                    {!sharesItemCode && (
                                        <>
                                            <TableHeading>
                                                eStore Item Code
                                            </TableHeading>
                                            <TableHeading>
                                                Head Office sends it by
                                            </TableHeading>
                                        </>
                                    )}
                                    <TableHeading>
                                        Own price per piece (optional)
                                    </TableHeading>
                                    {product && (
                                        <TableHeading align="right">
                                            Stock
                                        </TableHeading>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {combinations.map((combination, index) => (
                                    <tr
                                        key={combination.key}
                                        className="border-t border-slate-100 align-top"
                                    >
                                        <td className="px-5 py-4 font-black text-slate-900">
                                            {combination.label}
                                        </td>
                                        {!sharesItemCode && (
                                            <>
                                                <td className="px-5 py-4">
                                                    <input
                                                        value={
                                                            variantInput(
                                                                combination.key,
                                                            ).estore_item_code
                                                        }
                                                        onChange={(event) =>
                                                            updateVariant(
                                                                combination.key,
                                                                'estore_item_code',
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                        maxLength={40}
                                                        placeholder="e.g. PRCU01-01"
                                                        className={cn(
                                                            inputClasses,
                                                            'font-mono uppercase',
                                                        )}
                                                        aria-label={`eStore Item Code for ${combination.label}`}
                                                    />
                                                    <InputError
                                                        className="mt-1"
                                                        message={
                                                            errors[
                                                                `variants.${index}.estore_item_code`
                                                            ]
                                                        }
                                                    />
                                                </td>
                                                <td className="px-5 py-4">
                                                    <select
                                                        value={
                                                            variantInput(
                                                                combination.key,
                                                            ).estore_pack_key
                                                        }
                                                        onChange={(event) =>
                                                            updateVariant(
                                                                combination.key,
                                                                'estore_pack_key',
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                        className={cn(
                                                            inputClasses,
                                                            'w-48',
                                                        )}
                                                        aria-label={`How Head Office sends ${combination.label}`}
                                                    >
                                                        <option value="">
                                                            Piece
                                                        </option>
                                                        {data.packs.map(
                                                            (pack) => (
                                                                <option
                                                                    key={
                                                                        pack.key
                                                                    }
                                                                    value={
                                                                        pack.key
                                                                    }
                                                                >
                                                                    {packLabel(
                                                                        pack,
                                                                    )}
                                                                </option>
                                                            ),
                                                        )}
                                                        {variantInput(
                                                            combination.key,
                                                        ).estore_pack_key !==
                                                            '' &&
                                                            !data.packs.some(
                                                                (pack) =>
                                                                    pack.key ===
                                                                    variantInput(
                                                                        combination.key,
                                                                    )
                                                                        .estore_pack_key,
                                                            ) && (
                                                                <option
                                                                    value={
                                                                        variantInput(
                                                                            combination.key,
                                                                        )
                                                                            .estore_pack_key
                                                                    }
                                                                >
                                                                    Removed pack
                                                                    — choose
                                                                    again
                                                                </option>
                                                            )}
                                                    </select>
                                                    <InputError
                                                        className="mt-1"
                                                        message={
                                                            errors[
                                                                `variants.${index}.estore_pack_key`
                                                            ]
                                                        }
                                                    />
                                                </td>
                                            </>
                                        )}
                                        <td className="px-5 py-4">
                                            <PesoInput
                                                value={
                                                    variantInput(
                                                        combination.key,
                                                    ).price
                                                }
                                                onChange={(value) =>
                                                    updateVariant(
                                                        combination.key,
                                                        'price',
                                                        value,
                                                    )
                                                }
                                                placeholder={
                                                    data.sold_by_piece
                                                        ? data.price ||
                                                          'Price per piece'
                                                        : 'Not sold by the piece'
                                                }
                                                disabled={!data.sold_by_piece}
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
                                                                combination.key
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
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Panel>

                <Panel
                    title="Where it shows"
                    description="Choose how students see this product on the storefront. To put it on sale, use Put on Sale on the Products list."
                >
                    {data.status === 'on_sale' ? (
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
                        <div className="grid gap-3 p-6 md:grid-cols-3">
                            {statuses.map((status) => (
                                <label
                                    key={status.value}
                                    className={cn(
                                        'cursor-pointer rounded-2xl border-2 p-4 transition',
                                        data.status === status.value
                                            ? 'border-[#0D6EFD] bg-blue-50'
                                            : 'border-slate-200 bg-white hover:border-slate-300',
                                    )}
                                >
                                    <span className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="status"
                                            value={status.value}
                                            checked={
                                                data.status === status.value
                                            }
                                            onChange={() =>
                                                setData('status', status.value)
                                            }
                                            className="h-4 w-4 accent-[#0D6EFD]"
                                        />
                                        <span className="font-black text-slate-900">
                                            {status.label}
                                        </span>
                                    </span>
                                    <span className="mt-2 block text-sm leading-5 text-slate-500">
                                        {status.description}
                                    </span>
                                </label>
                            ))}
                        </div>
                    )}
                    {data.status === 'preorder' && (
                        <div className="border-t border-slate-100 bg-amber-50/40 px-6 py-5">
                            <div className="max-w-sm">
                                <Field
                                    label="Preorders close on"
                                    hint="The last day students can preorder. You can move it later on the Preorders page to collect more."
                                    error={
                                        closeDateInPast
                                            ? 'The close date cannot be in the past.'
                                            : errors.preorders_close_on
                                    }
                                >
                                    <input
                                        type="date"
                                        value={data.preorders_close_on}
                                        min={today}
                                        onChange={(event) =>
                                            setData(
                                                'preorders_close_on',
                                                event.target.value,
                                            )
                                        }
                                        className={cn(
                                            inputClasses,
                                            closeDateInPast && 'border-red-300',
                                        )}
                                    />
                                </Field>
                            </div>
                        </div>
                    )}
                    <div className="px-6 pb-6">
                        <InputError message={errors.status} />
                    </div>
                </Panel>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <Link
                        href={ProductController.index()}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={processing || closeDateInPast}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D6EFD] px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        data-test="save-product-button"
                    >
                        {processing ? (
                            <LoaderCircle size={18} className="animate-spin" />
                        ) : (
                            <Save size={18} />
                        )}
                        {processing ? 'Saving...' : 'Save Product'}
                    </button>
                </div>
            </form>
        </>
    );
}

function Field({
    label,
    hint,
    error,
    children,
}: {
    label: string;
    hint?: string;
    error?: string;
    children: ReactNode;
}) {
    return (
        <label className="grid gap-1.5">
            <span className="text-sm font-black text-slate-700">{label}</span>
            {children}
            {hint && <span className="text-xs text-slate-500">{hint}</span>}
            <InputError message={error} />
        </label>
    );
}

function PesoInput({
    value,
    onChange,
    placeholder,
    label,
    disabled,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    disabled?: boolean;
}) {
    return (
        <span className="relative block">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm font-bold text-slate-400">
                ₱
            </span>
            <input
                value={disabled ? '' : value}
                onChange={(event) => onChange(event.target.value)}
                inputMode="decimal"
                placeholder={placeholder}
                aria-label={label}
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
 * to tick; anything else is typed in the "Other" box (Enter, a comma or
 * "Add"). Ticked choices keep the checklist's order, typed ones follow.
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
                    className="inline-flex items-center gap-1 self-start rounded-lg px-2 py-2 text-sm font-black text-red-600 transition hover:bg-red-50 md:self-auto"
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
                    <input
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={onKeyDown}
                        maxLength={40}
                        placeholder={
                            preset
                                ? 'Type another choice, then press Enter'
                                : option.choices.length === 0
                                  ? 'Type a choice, then press Enter'
                                  : 'Add another'
                        }
                        className="h-8 min-w-32 flex-1 bg-transparent px-1.5 text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                        aria-label={`Add a choice to ${option.name || 'this option'}`}
                    />
                    <button
                        type="button"
                        onClick={addChoice}
                        className="rounded-lg px-2.5 py-1 text-xs font-black text-blue-700 hover:bg-blue-50"
                    >
                        Add
                    </button>
                </div>
                <InputError
                    className="mt-1"
                    message={duplicate ?? choicesError}
                />
            </div>
        </div>
    );
}

/**
 * One of the two ways variants get their eStore Item Code: each its own,
 * or one code shared by all of them.
 */
function CodeModeChoice({
    checked,
    onChange,
    title,
    description,
}: {
    checked: boolean;
    onChange: () => void;
    title: string;
    description: string;
}) {
    return (
        <label
            className={cn(
                'flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition',
                checked
                    ? 'border-[#0D6EFD] bg-blue-50'
                    : 'border-slate-200 bg-white hover:border-slate-300',
            )}
        >
            <input
                type="radio"
                name="item_code_mode"
                checked={checked}
                onChange={onChange}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#0D6EFD]"
            />
            <span>
                <span className="block text-sm font-black text-slate-900">
                    {title}
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                    {description}
                </span>
            </span>
        </label>
    );
}
