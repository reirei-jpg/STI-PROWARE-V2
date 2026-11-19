import { Head, Link, router } from '@inertiajs/react';
import {
    CalendarDays,
    Eye,
    Hourglass,
    PackageX,
    Link2,
    Package,
    Plus,
    Search,
    TriangleAlert,
    Unlink,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ItemLinkController from '@/actions/App/Http/Controllers/ItemLinkController';
import ProductController from '@/actions/App/Http/Controllers/ProductController';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import Panel, { TableHeading, TableScroll } from '@/components/panel';
import ProductDetailsDialog from '@/components/product-details-dialog';
import ProductStatusBadge from '@/components/product-status-badge';
import { isOutOfStock } from '@/lib/product-stock';
import { openCalendar } from '@/lib/open-calendar';
import PutOnSaleDialog from '@/components/put-on-sale-dialog';
import { formatDateOrdered, formatPeso } from '@/lib/format';
import { isSameSearch } from '@/lib/utils';
import type {
    Paginated,
    ProductDetails,
    ProductFilters,
    ProductListItem,
    ProductStatus,
    VariantStatus,
} from '@/types';

const primaryButtonClasses =
    'inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700';

const statusChips: { value: ProductStatus | null; label: string }[] = [
    { value: null, label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'preorder', label: 'Preorder' },
    { value: 'available', label: 'Available' },
    { value: 'on_sale', label: 'On Sale' },
];

function filterQuery(filters: ProductFilters): Record<string, string> {
    const query: Record<string, string> = {};

    if (filters.search) {
        query.search = filters.search;
    }

    if (filters.status) {
        query.status = filters.status;
    }

    if (filters.stock) {
        query.stock = filters.stock;
    }

    // Slow-moving starts at 1 month and All slow; other choices are kept in the address.
    if (filters.stock === 'slow') {
        if (filters.slow === 'days') {
            query.slow_days = String(filters.slow_days);
        } else if (filters.slow && filters.slow !== 'month') {
            query.slow = filters.slow;
        }

        if (filters.slow === 'range' && filters.slow_from) {
            query.slow_from = filters.slow_from;

            if (filters.slow_to) {
                query.slow_to = filters.slow_to;
            }
        }

        if (filters.sold && filters.sold !== 'all') {
            query.sold = filters.sold;
        }
    }

    return query;
}

export default function ProductsIndex({
    products,
    filters,
    itemsToLinkCount,
    lowStockCount,
    outOfStockCount,
    slowMovingCount,
    details,
}: {
    products: Paginated<ProductListItem>;
    filters: ProductFilters;
    itemsToLinkCount: number;
    /** Shared codes that arrived but are not split by variant yet. */
    lowStockCount: number;
    outOfStockCount: number;
    slowMovingCount: number;
    /** The product opened in View Details, loaded when it opens. */
    details?: ProductDetails | null;
}) {
    const [search, setSearch] = useState(filters.search ?? '');

    // The Draft list shows only the Draft part of a product whose other
    // sizes or colors are in the store.
    const showsDraftPart = (product: ProductListItem): boolean =>
        filters.status === 'draft' && product.status !== 'draft';
    const [selling, setSelling] = useState<number | null>(null);
    const [viewingId, setViewingId] = useState<number | null>(null);
    const viewing =
        products.data.find((product) => product.id === viewingId) ?? null;
    const isFiltered =
        filters.search !== null ||
        filters.status !== null ||
        filters.stock !== null;
    const firstRender = useRef(true);

    const showList = (next: ProductFilters) => {
        router.get(ProductController.index().url, filterQuery(next), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    // Search as the Specialist types, after a short pause.
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;

            return;
        }

        if (isSameSearch(search, filters.search)) {
            return;
        }

        const timer = window.setTimeout(
            () =>
                showList({
                    ...filters,
                    search: search.trim() === '' ? null : search.trim(),
                }),
            400,
        );

        return () => window.clearTimeout(timer);
        // Only the typed text should trigger a search.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    // The popup opens at once and fills in when its details arrive.
    const openDetails = (productId: number) => {
        setViewingId(productId);
        router.reload({ data: { details: productId }, only: ['details'] });
    };

    return (
        <>
            <Head title="Products" />

            <div className="space-y-7">
                <PageHeader
                    title="Products"
                    description="Merchandise students see on the storefront. Set each product as Draft, Preorder, Available or On Sale."
                    actions={
                        <>
                            <Link
                                href={ItemLinkController.index()}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                            >
                                <Link2 size={18} />
                                Items to Link
                                {itemsToLinkCount > 0 && (
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-800">
                                        {itemsToLinkCount.toLocaleString(
                                            'en-PH',
                                        )}
                                    </span>
                                )}
                            </Link>
                            <Link
                                href={ProductController.create()}
                                className={primaryButtonClasses}
                            >
                                <Plus size={18} />
                                Add Product
                            </Link>
                        </>
                    }
                />

                {itemsToLinkCount > 0 && (
                    <section className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                        <p
                            className="flex items-center gap-2 text-sm font-bold text-amber-900"
                            title="Their deliveries are not counted as stock until you link them. Link each item once; after that its deliveries go into stock by themselves."
                        >
                            <Unlink size={16} className="shrink-0" />
                            {itemsToLinkCount === 1
                                ? '1 eStore item is not linked to a product yet'
                                : `${itemsToLinkCount.toLocaleString('en-PH')} eStore items are not linked to a product yet`}
                        </p>
                        <Link
                            href={ItemLinkController.index()}
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-amber-700"
                        >
                            <Link2 size={15} />
                            Link Items
                        </Link>
                    </section>
                )}

                <Panel>
                    <div className="space-y-4 border-b border-slate-100 px-6 py-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <h2 className="font-black text-slate-900">
                                    All Products
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    {filters.stock === 'slow'
                                        ? 'The fewest sold first.'
                                        : 'Most recently changed first.'}
                                </p>
                            </div>
                            <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 lg:max-w-xs">
                                <Search size={18} className="shrink-0" />
                                <input
                                    type="search"
                                    maxLength={120}
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Search by product name"
                                    className="w-full min-w-0 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                                    aria-label="Search by product name"
                                />
                            </label>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {statusChips.map((chip) => (
                                <button
                                    key={chip.label}
                                    type="button"
                                    // One button at a time: a status turns off
                                    // Low stock, Out of stock and Slow-moving.
                                    onClick={() =>
                                        showList({
                                            ...filters,
                                            status: chip.value,
                                            stock: null,
                                        })
                                    }
                                    className={`rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                                        filters.status === chip.value &&
                                        filters.stock === null
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {chip.label}
                                </button>
                            ))}
                            <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
                            <button
                                type="button"
                                onClick={() =>
                                    showList({
                                        ...filters,
                                        status: null,
                                        stock:
                                            filters.stock === 'low'
                                                ? null
                                                : 'low',
                                    })
                                }
                                aria-pressed={filters.stock === 'low'}
                                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                                    filters.stock === 'low'
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                                }`}
                            >
                                <TriangleAlert size={14} />
                                Low stock
                                <span
                                    className={`rounded-full px-1.5 text-[11px] font-black ${
                                        filters.stock === 'low'
                                            ? 'bg-white/25'
                                            : 'bg-amber-100'
                                    }`}
                                >
                                    {lowStockCount.toLocaleString('en-PH')}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    showList({
                                        ...filters,
                                        status: null,
                                        stock:
                                            filters.stock === 'out'
                                                ? null
                                                : 'out',
                                    })
                                }
                                aria-pressed={filters.stock === 'out'}
                                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                                    filters.stock === 'out'
                                        ? 'bg-red-600 text-white'
                                        : 'bg-red-50 text-red-700 hover:bg-red-100'
                                }`}
                            >
                                <PackageX size={14} />
                                Out of stock
                                <span
                                    className={`rounded-full px-1.5 text-[11px] font-black ${
                                        filters.stock === 'out'
                                            ? 'bg-white/25'
                                            : 'bg-red-100'
                                    }`}
                                >
                                    {outOfStockCount.toLocaleString('en-PH')}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    showList({
                                        ...filters,
                                        status: null,
                                        stock:
                                            filters.stock === 'slow'
                                                ? null
                                                : 'slow',
                                    })
                                }
                                aria-pressed={filters.stock === 'slow'}
                                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                                    filters.stock === 'slow'
                                        ? 'bg-red-500 text-white'
                                        : 'bg-red-50 text-red-700 hover:bg-red-100'
                                }`}
                            >
                                <Hourglass size={14} />
                                Slow-moving
                                <span
                                    className={`rounded-full px-1.5 text-[11px] font-black ${
                                        filters.stock === 'slow'
                                            ? 'bg-white/25'
                                            : 'bg-red-100'
                                    }`}
                                >
                                    {slowMovingCount.toLocaleString('en-PH')}
                                </span>
                            </button>
                        </div>
                        {filters.stock === 'slow' && (
                            <section className="space-y-3 rounded-2xl border border-red-100 bg-red-50/60 p-4 text-sm text-red-900">
                                <p className="leading-6">
                                    <b>Slow-moving:</b> products in the store
                                    with stock that sold {SLOW_MOST_SOLD} pieces
                                    or fewer in the period you choose, the
                                    fewest sold first. A product never sold
                                    counts from the day its stock arrived. Put
                                    them on sale to clear them.
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="w-24 font-bold">
                                        Period:
                                    </span>
                                    {(
                                        [
                                            ['week', '1 week'],
                                            ['month', '1 month'],
                                            ['year', '1 year'],
                                        ] as const
                                    ).map(([value, label]) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() =>
                                                showList({
                                                    ...filters,
                                                    slow: value,
                                                    slow_from: null,
                                                    slow_to: null,
                                                })
                                            }
                                            aria-pressed={
                                                (filters.slow ?? 'month') ===
                                                value
                                            }
                                            className={chipClasses(
                                                (filters.slow ?? 'month') ===
                                                    value,
                                            )}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                    <span
                                        className={`inline-flex flex-wrap items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-black ${
                                            filters.slow === 'range'
                                                ? 'bg-red-600 text-white'
                                                : 'border border-red-200 bg-white text-red-700'
                                        }`}
                                    >
                                        <CalendarDays size={14} />
                                        {/* Clicking the word or the box opens the calendar. */}
                                        <label className="inline-flex cursor-pointer items-center gap-2">
                                            From
                                            <input
                                                type="date"
                                                onClick={openCalendar}
                                                value={filters.slow_from ?? ''}
                                                max={today}
                                                onChange={(event) =>
                                                    event.target.value !== '' &&
                                                    showList({
                                                        ...filters,
                                                        slow: 'range',
                                                        slow_from:
                                                            event.target.value,
                                                        // A To day before the new From day is cleared.
                                                        slow_to:
                                                            filters.slow_to &&
                                                            filters.slow_to >=
                                                                event.target
                                                                    .value
                                                                ? filters.slow_to
                                                                : null,
                                                    })
                                                }
                                                aria-label="From this day"
                                                className="cursor-pointer rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 outline-none"
                                            />
                                        </label>
                                        <label className="inline-flex cursor-pointer items-center gap-2">
                                            To
                                            <input
                                                type="date"
                                                onClick={openCalendar}
                                                value={filters.slow_to ?? ''}
                                                min={
                                                    filters.slow_from ??
                                                    undefined
                                                }
                                                max={today}
                                                onChange={(event) =>
                                                    event.target.value !== '' &&
                                                    showList({
                                                        ...filters,
                                                        slow: 'range',
                                                        // Picked first: From is one month before, to change if needed.
                                                        slow_from:
                                                            filters.slow_from &&
                                                            filters.slow_from <=
                                                                event.target
                                                                    .value
                                                                ? filters.slow_from
                                                                : monthBefore(
                                                                      event
                                                                          .target
                                                                          .value,
                                                                  ),
                                                        slow_to:
                                                            event.target.value,
                                                    })
                                                }
                                                aria-label="To this day"
                                                className="cursor-pointer rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 outline-none"
                                            />
                                        </label>
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="w-24 font-bold">
                                        Units sold:
                                    </span>
                                    {(
                                        [
                                            [
                                                'all',
                                                `${SLOW_MOST_SOLD} or fewer`,
                                            ],
                                            ['none', 'None'],
                                            ['few', '1–2'],
                                            ['some', `3–${SLOW_MOST_SOLD}`],
                                        ] as const
                                    ).map(([value, label]) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() =>
                                                showList({
                                                    ...filters,
                                                    sold: value,
                                                })
                                            }
                                            aria-pressed={
                                                (filters.sold ?? 'all') ===
                                                value
                                            }
                                            className={chipClasses(
                                                (filters.sold ?? 'all') ===
                                                    value,
                                            )}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>{' '}
                            </section>
                        )}
                    </div>
                    {products.data.length === 0 ? (
                        <div className="px-6 py-16 text-center">
                            <Package
                                size={44}
                                className="mx-auto text-slate-300"
                            />
                            <h3 className="mt-4 text-lg font-black text-slate-800">
                                {filters.stock === 'slow'
                                    ? 'No slow-moving products in this time'
                                    : isFiltered
                                      ? 'No products match your search or filter'
                                      : 'No products yet'}
                            </h3>
                            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                                {filters.stock === 'slow'
                                    ? `A product counts only when it was already in stock on the first day${filters.slow === 'range' && filters.slow_from ? ` (${formatDateOrdered(filters.slow_from)})` : ''}, so it had the whole time to sell. Choose an earlier day or another time.`
                                    : isFiltered
                                      ? 'Try another name or status, or clear the filters.'
                                      : 'Add the first product, e.g. the 42nd Anniversary Shirt, with its photo and price.'}
                            </p>
                            {isFiltered ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearch('');
                                        showList({
                                            search: null,
                                            status: null,
                                            stock: null,
                                            slow_days: filters.slow_days,
                                            slow: 'month',
                                            slow_from: null,
                                            slow_to: null,
                                            sold: 'all',
                                        });
                                    }}
                                    className={`mt-6 ${primaryButtonClasses}`}
                                >
                                    <X size={17} />
                                    Clear filters
                                </button>
                            ) : (
                                <Link
                                    href={ProductController.create()}
                                    className={`mt-6 ${primaryButtonClasses}`}
                                >
                                    <Plus size={17} />
                                    Add Product
                                </Link>
                            )}
                        </div>
                    ) : (
                        <>
                            <TableScroll stickyActions>
                                <table className="w-full min-w-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <TableHeading>Product</TableHeading>
                                            <TableHeading>Status</TableHeading>
                                            <TableHeading align="right">
                                                Student Price
                                            </TableHeading>
                                            <TableHeading align="right">
                                                Stock
                                            </TableHeading>
                                            <TableHeading align="right">
                                                Actions
                                            </TableHeading>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {products.data.map((product) => (
                                            <tr
                                                key={product.id}
                                                className="border-t border-slate-100"
                                            >
                                                <td className="px-5 py-3.5">
                                                    <p className="font-black text-slate-900">
                                                        {product.name}
                                                    </p>
                                                    <p className="mt-0.5 text-xs text-slate-500">
                                                        {/* The Draft, Low stock and Out of stock lists show
                                                            only those sizes or colors. */}
                                                        {product.stock_sizes
                                                            ? stockSizesLine(
                                                                  product.stock_sizes,
                                                                  filters.stock ===
                                                                      'out',
                                                              )
                                                            : showsDraftPart(
                                                                    product,
                                                                )
                                                              ? `${product.variant_statuses.draft} Draft ${product.variant_statuses.draft === 1 ? 'variant' : 'variants'}`
                                                              : `${product.variants_count} ${product.variants_count === 1 ? 'variant' : 'variants'}${statusBreakdown(product.variant_statuses)}`}
                                                        {product.updated_at &&
                                                            ` · updated ${formatDateOrdered(product.updated_at)}`}
                                                    </p>
                                                    {filters.stock ===
                                                        'slow' && (
                                                        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                                                            {product.sold_in_period !==
                                                                null && (
                                                                <span
                                                                    className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                                                                        product.sold_in_period ===
                                                                        0
                                                                            ? 'bg-red-100 text-red-700'
                                                                            : product.sold_in_period <=
                                                                                2
                                                                              ? 'bg-amber-100 text-amber-800'
                                                                              : 'bg-slate-100 text-slate-700'
                                                                    }`}
                                                                >
                                                                    {product.sold_in_period.toLocaleString(
                                                                        'en-PH',
                                                                    )}{' '}
                                                                    sold
                                                                </span>
                                                            )}
                                                            <span>
                                                                {product.days_without_sale !==
                                                                    null &&
                                                                    `${product.days_without_sale.toLocaleString('en-PH')} ${product.days_without_sale === 1 ? 'day' : 'days'} since ${product.last_sale_at ? 'its last sale' : 'it arrived'} · `}
                                                                In stock since{' '}
                                                                {formatDateOrdered(
                                                                    product.first_received_at,
                                                                )}
                                                                {' · '}
                                                                {product.last_sale_at
                                                                    ? `last sale ${formatDateOrdered(product.last_sale_at)}`
                                                                    : 'no sales yet'}
                                                            </span>
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    {/* In the Draft list, a product in the store
                                                        shows the Draft sizes or colors it is listed for. */}
                                                    {product.stock_sizes ? (
                                                        filters.stock ===
                                                        'out' ? (
                                                            <ProductStatusBadge
                                                                status="out_of_stock"
                                                                label="Out of stock"
                                                            />
                                                        ) : (
                                                            <ProductStatusBadge
                                                                status="preorder"
                                                                label="Low stock"
                                                            />
                                                        )
                                                    ) : showsDraftPart(
                                                          product,
                                                      ) ? (
                                                        <ProductStatusBadge
                                                            status="draft"
                                                            label="Draft"
                                                        />
                                                    ) : isOutOfStock(
                                                          product,
                                                      ) ? (
                                                        // In the store with nothing left: not "Available".
                                                        <ProductStatusBadge
                                                            status="out_of_stock"
                                                            label="Out of stock"
                                                        />
                                                    ) : (
                                                        <ProductStatusBadge
                                                            status={
                                                                product.status
                                                            }
                                                            label={
                                                                product.status_label
                                                            }
                                                        />
                                                    )}
                                                    {product.sale_ends_at &&
                                                        !product.stock_sizes && (
                                                            <p className="mt-1 text-xs font-bold whitespace-nowrap text-red-700">
                                                                until{' '}
                                                                {formatDateOrdered(
                                                                    product.sale_ends_at,
                                                                )}
                                                            </p>
                                                        )}
                                                </td>
                                                <td className="px-5 py-3.5 text-right">
                                                    <StudentPrice
                                                        product={product}
                                                    />
                                                    {product.below_cost && (
                                                        <p
                                                            className="mt-1 inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-0.5 text-xs font-black whitespace-nowrap text-red-700"
                                                            title={`Sells at ${formatPeso(product.below_cost.price_centavos)}${product.below_cost.variant_label ? ` (${product.below_cost.variant_label})` : ''} but cost ${formatPeso(product.below_cost.cost_centavos)} per piece${product.below_cost.order_number ? ` on Order #${product.below_cost.order_number}` : ''}.`}
                                                        >
                                                            <TriangleAlert
                                                                size={12}
                                                            />
                                                            Selling below cost
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                                    {/* In the Draft list, a product in the store shows the
                                                        pieces of its Draft sizes or colors. In the store with
                                                        nothing left: Out of stock, not "0 pcs Low". */}
                                                    {product.stock_sizes ? (
                                                        filters.stock ===
                                                        'out' ? (
                                                            <span className="text-sm font-black text-red-600">
                                                                Out of stock
                                                            </span>
                                                        ) : (
                                                            <>
                                                                <span className="text-base font-black text-amber-700">
                                                                    {product.stock_sizes
                                                                        .reduce(
                                                                            (
                                                                                sum,
                                                                                size,
                                                                            ) =>
                                                                                sum +
                                                                                size.free_to_sell,
                                                                            0,
                                                                        )
                                                                        .toLocaleString(
                                                                            'en-PH',
                                                                        )}
                                                                </span>{' '}
                                                                <span className="text-xs text-slate-500">
                                                                    pcs left
                                                                </span>
                                                            </>
                                                        )
                                                    ) : showsDraftPart(
                                                          product,
                                                      ) ? (
                                                        <>
                                                            <span className="text-base font-black text-slate-400">
                                                                {product.draft_stock_on_hand.toLocaleString(
                                                                    'en-PH',
                                                                )}
                                                            </span>{' '}
                                                            <span className="text-xs text-slate-500">
                                                                pcs
                                                            </span>
                                                        </>
                                                    ) : isOutOfStock(
                                                          product,
                                                      ) ? (
                                                        <span className="text-sm font-black text-red-600">
                                                            Out of stock
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <span
                                                                className={`text-base font-black ${
                                                                    product.low_stock
                                                                        ? 'text-amber-700'
                                                                        : product.stock_on_hand >
                                                                            0
                                                                          ? 'text-slate-900'
                                                                          : 'text-slate-400'
                                                                }`}
                                                            >
                                                                {product.stock_on_hand.toLocaleString(
                                                                    'en-PH',
                                                                )}
                                                            </span>{' '}
                                                            <span className="text-xs text-slate-500">
                                                                pcs
                                                            </span>
                                                            {product.low_stock && (
                                                                <p
                                                                    className="mt-0.5 flex items-center justify-end gap-1 text-xs font-black text-amber-700"
                                                                    title={`A size or color is at or below ${product.low_stock_alert_at} pcs`}
                                                                >
                                                                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                                                                    Low
                                                                </p>
                                                            )}
                                                        </>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            openDetails(
                                                                product.id,
                                                            )
                                                        }
                                                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 text-sm font-black text-blue-700 transition hover:bg-blue-100"
                                                    >
                                                        <Eye size={15} />
                                                        View Details
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </TableScroll>

                            <Pagination
                                pagination={products}
                                itemName="products"
                            />
                        </>
                    )}
                </Panel>
            </div>

            <ProductDetailsDialog
                product={viewing}
                // Another product's details (from before) count as loading.
                details={
                    details === null || details?.id === viewingId
                        ? details
                        : undefined
                }
                onClose={() => setViewingId(null)}
                only={
                    filters.stock === 'low' || filters.stock === 'out'
                        ? filters.stock
                        : filters.status === 'draft'
                          ? 'draft'
                          : null
                }
                onPutOnSale={(productId) => {
                    setViewingId(null);
                    setSelling(productId);
                }}
            />

            <PutOnSaleDialog
                productId={selling}
                onClose={() => setSelling(null)}
            />
        </>
    );
}

/**
 * The price per piece (crossed out with the sale price when On Sale), and
 * the price of each pack students can buy.
 */
function StudentPrice({ product }: { product: ProductListItem }) {
    return (
        <div className="grid justify-items-end gap-1">
            {product.sold_by_piece &&
                product.price_centavos !== null &&
                (product.sale_price_centavos !== null &&
                product.sale_by_variant ? (
                    <span className="inline-flex items-baseline gap-1">
                        <span className="text-xs text-slate-500">
                            Sale from
                        </span>
                        <span className="text-base font-black text-red-600">
                            {formatPeso(product.sale_price_centavos)}
                        </span>
                        <span className="text-xs text-slate-500">/ pc</span>
                    </span>
                ) : product.sale_price_centavos !== null ? (
                    <span className="inline-flex items-baseline gap-2">
                        <span className="text-sm text-slate-400 line-through">
                            {formatPeso(product.price_centavos)}
                        </span>
                        <span className="text-base font-black text-red-600">
                            {formatPeso(product.sale_price_centavos)}
                        </span>
                        <span className="text-xs text-slate-500">/ pc</span>
                    </span>
                ) : (
                    <span className="inline-flex items-baseline gap-1">
                        <span className="text-base font-black text-blue-700">
                            {formatPeso(product.price_centavos)}
                        </span>
                        <span className="text-xs text-slate-500">/ pc</span>
                    </span>
                ))}
            {product.packs_for_sale.map((pack) => (
                <span
                    key={pack.name}
                    className="inline-flex items-baseline gap-1"
                >
                    {pack.sale_price_centavos !== null ? (
                        <>
                            <span className="text-xs text-slate-400 line-through">
                                {formatPeso(pack.price_centavos)}
                            </span>
                            <span className="text-sm font-black text-red-600">
                                {formatPeso(pack.sale_price_centavos)}
                            </span>
                        </>
                    ) : (
                        <span className="text-sm font-black text-blue-700">
                            {formatPeso(pack.price_centavos)}
                        </span>
                    )}
                    <span className="text-xs text-slate-500">
                        / {pack.name} of {pack.pieces}
                    </span>
                </span>
            ))}
        </div>
    );
}

/**
 * " · 12 Available · 6 Draft" when a product's sizes or colors do not all
 * have the same status; nothing when they do.
 */
function statusBreakdown(
    counts: Record<VariantStatus | 'out_of_stock', number>,
): string {
    const parts = (
        [
            ['available', 'Available'],
            ['out_of_stock', 'Out of stock'],
            ['preorder', 'Preorder'],
            ['draft', 'Draft'],
        ] as const
    )
        .filter(([status]) => counts[status] > 0)
        .map(([status, label]) => `${counts[status]} ${label}`);

    return parts.length > 1 ? ` · ${parts.join(' · ')}` : '';
}

/**
 * The sizes or colors a product is in the Low stock or Out of stock list
 * for: "Low: S 2 pcs, M 3 pcs and 2 more", or "Out of stock: S, XL". Without
 * options: "Low: 5 pcs left" or "Out of stock".
 */
function stockSizesLine(
    sizes: { label: string | null; free_to_sell: number }[],
    out: boolean,
): string {
    const named = sizes.filter((size) => size.label !== null);

    if (named.length === 0) {
        const left = sizes.reduce((sum, size) => sum + size.free_to_sell, 0);

        return out
            ? 'Out of stock'
            : `Low: ${left} ${left === 1 ? 'pc' : 'pcs'} left`;
    }

    const shown = named
        .slice(0, 3)
        .map((size) =>
            out
                ? size.label
                : `${size.label} ${size.free_to_sell} ${size.free_to_sell === 1 ? 'pc' : 'pcs'}`,
        )
        .join(', ');
    const more = named.length - 3;

    return `${out ? 'Out of stock' : 'Low'}: ${shown}${more > 0 ? ` and ${more} more` : ''}`;
}

/** At most this many pieces sold in the time chosen: slow-moving (FilterProductsRequest). */
const SLOW_MOST_SOLD = 5;

/** Today on this computer, "YYYY-MM-DD", the latest day the calendars allow. */
const today = new Date().toLocaleDateString('en-CA');

/** A Slow-moving choice button, red while chosen. */
function chipClasses(chosen: boolean): string {
    return `rounded-lg px-3 py-2 text-xs font-black transition ${
        chosen
            ? 'bg-red-600 text-white'
            : 'border border-red-200 bg-white text-red-700 hover:bg-red-50'
    }`;
}

/** "2026-02-28" → "2026-01-28": one month before a day picked as To. */
function monthBefore(day: string): string {
    const date = new Date(`${day}T00:00:00`);
    date.setMonth(date.getMonth() - 1);

    return date.toLocaleDateString('en-CA');
}
