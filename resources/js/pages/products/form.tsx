import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    ImagePlus,
    LoaderCircle,
    Plus,
    Save,
    Trash2,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import ProductController from '@/actions/App/Http/Controllers/ProductController';
import InputError from '@/components/input-error';
import PageHeader from '@/components/page-header';
import Panel, { TableHeading } from '@/components/panel';
import { optionPresets, presetChoices } from '@/lib/product-option-presets';
import { variantCombinations } from '@/lib/product-variants';
import { cn } from '@/lib/utils';
import type {
    EditableProduct,
    ProductOptionInput,
    ProductStatus,
} from '@/types';

const MAX_PHOTOS = 6;
const MAX_OPTIONS = 3;

type PhotoInput = {
    id: number | null;
    url: string;
    file: File | null;
    label: string;
};

type VariantInput = { estore_item_code: string; price: string };

type ProductFormData = {
    name: string;
    price: string;
    status: ProductStatus;
    sale_price: string;
    photos: PhotoInput[];
    options: ProductOptionInput[];
    variant_inputs: Record<string, VariantInput>;
};

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
        {
            value: 'on_sale',
            label: 'On Sale',
            description:
                'Shown under On Sale at a lower price, to clear slow-moving stock.',
        },
    ];

const inputClasses =
    'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

export default function ProductForm({
    product,
}: {
    product: EditableProduct | null;
}) {
    const form = useForm<ProductFormData>({
        name: product?.name ?? '',
        price: product?.price ?? '',
        status: product?.status ?? 'draft',
        sale_price: product?.sale_price ?? '',
        photos:
            product?.photos.map((photo) => ({
                id: photo.id,
                url: photo.url,
                file: null,
                label: photo.label,
            })) ?? [],
        options: product?.options ?? [],
        variant_inputs: Object.fromEntries(
            (product?.variants ?? []).map((variant) => [
                variant.combination,
                {
                    estore_item_code: variant.estore_item_code,
                    price: variant.price,
                },
            ]),
        ),
    });

    const { data, setData, processing } = form;
    const errors = form.errors as Record<string, string | undefined>;
    const combinations = variantCombinations(
        data.options.filter(
            (option) => option.name.trim() !== '' && option.choices.length > 0,
        ),
    );

    // Free the previews of newly chosen photos when leaving the page.
    const previews = useRef<string[]>([]);
    useEffect(
        () => () => previews.current.forEach((url) => URL.revokeObjectURL(url)),
        [],
    );

    const submit = () => {
        form.transform((current) => ({
            name: current.name,
            price: current.price,
            status: current.status,
            sale_price: current.status === 'on_sale' ? current.sale_price : '',
            photos: current.photos.map((photo) => ({
                id: photo.id ?? '',
                file: photo.file ?? '',
                label: photo.label,
            })),
            options: current.options,
            variants: combinations.map((combination) => ({
                combination: combination.key,
                estore_item_code:
                    current.variant_inputs[combination.key]?.estore_item_code ??
                    '',
                price: current.variant_inputs[combination.key]?.price ?? '',
            })),
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
     * when the product does not have it yet (null: never add). The option
     * being left is dropped when nothing was chosen in it, so a quick look
     * never blocks saving.
     */
    const showOption = (
        matches: (option: ProductOptionInput) => boolean,
        newName: string | null,
    ) => {
        const current =
            activeOption === null ? undefined : data.options[activeOption];

        if (current !== undefined && matches(current)) {
            return;
        }

        let options =
            current !== undefined && current.choices.length === 0
                ? data.options.filter((option) => option !== current)
                : [...data.options];
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
            [key]: {
                estore_item_code:
                    data.variant_inputs[key]?.estore_item_code ?? '',
                price: data.variant_inputs[key]?.price ?? '',
                [field]: value,
            },
        });

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
                        <Link
                            href={ProductController.index()}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                            <ArrowLeft size={18} />
                            Back to Products
                        </Link>
                    }
                />

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
                        <Field
                            label="Student price"
                            hint="What students pay, not the Head Office cost."
                            error={errors.price}
                        >
                            <PesoInput
                                value={data.price}
                                onChange={(value) => setData('price', value)}
                                placeholder="350"
                            />
                        </Field>
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
                    description="Every combination of the options. Add the eStore Item Code so deliveries from uploaded purchase orders match the right variant. Leave the price blank to use the student price."
                >
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-150">
                            <thead className="bg-slate-50">
                                <tr>
                                    <TableHeading>Variant</TableHeading>
                                    <TableHeading>
                                        eStore Item Code
                                    </TableHeading>
                                    <TableHeading>
                                        Price (optional)
                                    </TableHeading>
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
                                        <td className="px-5 py-4">
                                            <input
                                                value={
                                                    data.variant_inputs[
                                                        combination.key
                                                    ]?.estore_item_code ?? ''
                                                }
                                                onChange={(event) =>
                                                    updateVariant(
                                                        combination.key,
                                                        'estore_item_code',
                                                        event.target.value,
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
                                            <PesoInput
                                                value={
                                                    data.variant_inputs[
                                                        combination.key
                                                    ]?.price ?? ''
                                                }
                                                onChange={(value) =>
                                                    updateVariant(
                                                        combination.key,
                                                        'price',
                                                        value,
                                                    )
                                                }
                                                placeholder={
                                                    data.price ||
                                                    'Student price'
                                                }
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
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Panel>

                <Panel
                    title="Where it shows"
                    description="Choose how students see this product on the storefront."
                >
                    <div className="grid gap-3 p-6 md:grid-cols-2 xl:grid-cols-4">
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
                                        checked={data.status === status.value}
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

                    {data.status === 'on_sale' && (
                        <div className="border-t border-slate-100 px-6 py-5">
                            <div className="max-w-sm">
                                <Field
                                    label="Sale price"
                                    hint={
                                        data.price && data.sale_price
                                            ? `Students see ₱${data.price} crossed out, then ₱${data.sale_price}.`
                                            : 'Must be lower than the student price.'
                                    }
                                    error={errors.sale_price}
                                >
                                    <PesoInput
                                        value={data.sale_price}
                                        onChange={(value) =>
                                            setData('sale_price', value)
                                        }
                                        placeholder="300"
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
                        disabled={processing}
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
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
}) {
    return (
        <span className="relative block">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm font-bold text-slate-400">
                ₱
            </span>
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                inputMode="decimal"
                placeholder={placeholder}
                aria-label={label}
                className={cn(inputClasses, 'pl-7')}
            />
        </span>
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
            {count !== null && count > 0 && (
                <span
                    className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-black',
                        active
                            ? 'bg-white/25 text-white'
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
