import { Head, Link, router } from '@inertiajs/react';
import {
    Boxes,
    Flame,
    Hourglass,
    ImageIcon,
    Link2,
    Package,
    Pencil,
    Plus,
    Search,
    TriangleAlert,
    Unlink,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ItemLinkController from '@/actions/App/Http/Controllers/ItemLinkController';
import ProductController from '@/actions/App/Http/Controllers/ProductController';
import ProductStockController from '@/actions/App/Http/Controllers/ProductStockController';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import Panel, { TableHeading } from '@/components/panel';
import EndSaleButton from '@/components/end-sale-button';
import ProductStatusBadge from '@/components/product-status-badge';
import PutOnSaleDialog from '@/components/put-on-sale-dialog';
import { formatDateTime, formatPeso } from '@/lib/format';
import type {
    Paginated,
    ProductFilters,
    ProductListItem,
    ProductStatus,
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

    if (filters.stock === 'slow' && filters.slow_days !== 18) {
        query.slow_days = String(filters.slow_days);
    }

    return query;
}

export default function ProductsIndex({
    products,
    filters,
    itemsToLinkCount,
    itemsToSplitCount,
    lowStockCount,
    slowMovingCount,
}: {
    products: Paginated<ProductListItem>;
    filters: ProductFilters;
    itemsToLinkCount: number;
    /** Shared codes that arrived but are not split by variant yet. */
    itemsToSplitCount: number;
    lowStockCount: number;
    slowMovingCount: number;
}) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [slowDays, setSlowDays] = useState(String(filters.slow_days));
    const [selling, setSelling] = useState<number | null>(null);
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
                                {itemsToLinkCount + itemsToSplitCount > 0 && (
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-800">
                                        {(
                                            itemsToLinkCount + itemsToSplitCount
                                        ).toLocaleString('en-PH')}
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
                    <section className="flex flex-col gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                                <Unlink size={20} />
                            </span>
                            <div>
                                <p className="font-black text-amber-900">
                                    {itemsToLinkCount === 1
                                        ? '1 eStore item is not linked to a product yet'
                                        : `${itemsToLinkCount.toLocaleString('en-PH')} eStore items are not linked to a product yet`}
                                </p>
                                <p className="mt-1 text-sm text-amber-800">
                                    Their deliveries are not counted as stock
                                    until you link them. Link each item once;
                                    after that its deliveries go into stock by
                                    themselves.
                                </p>
                            </div>
                        </div>
                        <Link
                            href={ItemLinkController.index()}
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-amber-700"
                        >
                            <Link2 size={17} />
                            Link Items
                        </Link>
                    </section>
                )}

                {itemsToSplitCount > 0 && (
                    <section className="flex flex-col gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                                <Boxes size={20} />
                            </span>
                            <div>
                                <p className="font-black text-emerald-900">
                                    {itemsToSplitCount === 1
                                        ? '1 delivered item is waiting to be split into stock'
                                        : `${itemsToSplitCount.toLocaleString('en-PH')} delivered items are waiting to be split into stock`}
                                </p>
                                <p className="mt-1 text-sm text-emerald-800">
                                    Their code is shared by every variant (e.g.
                                    every color). Enter how many of each arrived
                                    so each variant gets its stock.
                                </p>
                            </div>
                        </div>
                        <Link
                            href={ItemLinkController.index()}
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700"
                        >
                            <Boxes size={17} />
                            Split into stock
                        </Link>
                    </section>
                )}

                <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
                    <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 lg:max-w-sm">
                        <Search size={18} className="shrink-0" />
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search by product name"
                            className="w-full min-w-0 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                            aria-label="Search by product name"
                        />
                    </label>

                    <div className="flex flex-wrap items-center gap-2">
                        {statusChips.map((chip) => (
                            <button
                                key={chip.label}
                                type="button"
                                onClick={() =>
                                    showList({
                                        ...filters,
                                        status: chip.value,
                                    })
                                }
                                className={`rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                                    filters.status === chip.value
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
                                    stock:
                                        filters.stock === 'low' ? null : 'low',
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
                </section>

                {filters.stock === 'slow' && (
                    <section className="flex flex-col gap-3 rounded-3xl border border-red-100 bg-red-50/60 p-5 text-sm text-red-900 md:flex-row md:items-center md:justify-between">
                        <p className="leading-6">
                            <b>Slow-moving:</b> Available products in stock that
                            first arrived at least this many days ago and sold
                            nothing since. Put them on sale to clear them. Until
                            students can buy through PROWARE, nothing has sales
                            yet, so this lists items in stock that long.
                        </p>
                        <form
                            className="flex shrink-0 items-center gap-2"
                            onSubmit={(event) => {
                                event.preventDefault();
                                const days = Number(slowDays);

                                if (
                                    Number.isInteger(days) &&
                                    days >= 1 &&
                                    days <= 365
                                ) {
                                    showList({ ...filters, slow_days: days });
                                }
                            }}
                        >
                            <span className="font-bold">No sales for</span>
                            <input
                                value={slowDays}
                                onChange={(event) =>
                                    setSlowDays(
                                        event.target.value
                                            .replace(/\D/g, '')
                                            .slice(0, 3),
                                    )
                                }
                                inputMode="numeric"
                                className="h-9 w-16 rounded-lg border border-red-200 bg-white px-2 text-right text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-red-100"
                                aria-label="Days without sales"
                            />
                            <span className="font-bold">days</span>
                            <button
                                type="submit"
                                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-black text-white hover:bg-red-700"
                            >
                                Show
                            </button>
                        </form>
                    </section>
                )}

                <Panel
                    title="All Products"
                    description="Most recently changed first."
                >
                    {products.data.length === 0 ? (
                        <div className="px-6 py-16 text-center">
                            <Package
                                size={44}
                                className="mx-auto text-slate-300"
                            />
                            <h3 className="mt-4 text-lg font-black text-slate-800">
                                {isFiltered
                                    ? 'No products match your search or filter'
                                    : 'No products yet'}
                            </h3>
                            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                                {isFiltered
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
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-225">
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
                                                No. of Variants
                                            </TableHeading>
                                            <TableHeading>
                                                Last Updated
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
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-300">
                                                            {product.photo_url ? (
                                                                <img
                                                                    src={
                                                                        product.photo_url
                                                                    }
                                                                    alt=""
                                                                    className="h-full w-full object-cover"
                                                                />
                                                            ) : (
                                                                <ImageIcon
                                                                    size={22}
                                                                />
                                                            )}
                                                        </div>
                                                        <span className="font-black text-slate-900">
                                                            {product.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <ProductStatusBadge
                                                        status={product.status}
                                                        label={
                                                            product.status_label
                                                        }
                                                    />
                                                    {product.sale_ends_at && (
                                                        <p className="mt-1 text-xs font-bold text-red-700">
                                                            until{' '}
                                                            {formatDateTime(
                                                                product.sale_ends_at,
                                                            )}
                                                        </p>
                                                    )}
                                                    {filters.stock ===
                                                        'slow' && (
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            In stock since{' '}
                                                            {formatDateTime(
                                                                product.first_received_at,
                                                            )}
                                                            {' · '}
                                                            {product.last_sale_at
                                                                ? `last sale ${formatDateTime(product.last_sale_at)}`
                                                                : 'no sales yet'}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <StudentPrice
                                                        product={product}
                                                    />
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <span
                                                        className={`text-base font-black ${
                                                            product.stock_on_hand >
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
                                                        <span
                                                            className="mt-1 flex justify-end"
                                                            title={`A variant is at or below ${product.low_stock_alert_at} pcs`}
                                                        >
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-800">
                                                                <TriangleAlert
                                                                    size={12}
                                                                />
                                                                Low stock
                                                            </span>
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 text-right text-sm font-black text-slate-800">
                                                    {product.variants_count}
                                                </td>
                                                <td className="px-5 py-4 text-sm text-slate-500">
                                                    {formatDateTime(
                                                        product.updated_at,
                                                    )}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex justify-end gap-2">
                                                        <Link
                                                            href={ProductStockController.index(
                                                                product.id,
                                                            )}
                                                            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                                                        >
                                                            <Boxes size={15} />
                                                            Stock
                                                        </Link>
                                                        {(product.status ===
                                                            'on_sale' ||
                                                            (product.status ===
                                                                'available' &&
                                                                product.stock_on_hand >
                                                                    0)) && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setSelling(
                                                                        product.id,
                                                                    )
                                                                }
                                                                className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 text-sm font-black text-red-700 transition hover:bg-red-100"
                                                            >
                                                                <Flame
                                                                    size={15}
                                                                />
                                                                {product.status ===
                                                                'on_sale'
                                                                    ? 'Change sale'
                                                                    : 'Put on Sale'}
                                                            </button>
                                                        )}
                                                        {product.status ===
                                                            'on_sale' && (
                                                            <EndSaleButton
                                                                productId={
                                                                    product.id
                                                                }
                                                                productName={
                                                                    product.name
                                                                }
                                                            />
                                                        )}
                                                        <Link
                                                            href={ProductController.edit(
                                                                product.id,
                                                            )}
                                                            className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 text-sm font-black text-blue-700 transition hover:bg-blue-100"
                                                        >
                                                            <Pencil size={15} />
                                                            Edit
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <Pagination
                                pagination={products}
                                itemName="products"
                            />
                        </>
                    )}
                </Panel>
            </div>

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
