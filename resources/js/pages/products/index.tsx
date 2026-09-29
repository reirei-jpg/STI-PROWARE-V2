import { Head, Link, router } from '@inertiajs/react';
import { ImageIcon, Package, Pencil, Plus, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ProductController from '@/actions/App/Http/Controllers/ProductController';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import Panel, { TableHeading } from '@/components/panel';
import ProductStatusBadge from '@/components/product-status-badge';
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

    return query;
}

export default function ProductsIndex({
    products,
    filters,
}: {
    products: Paginated<ProductListItem>;
    filters: ProductFilters;
}) {
    const [search, setSearch] = useState(filters.search ?? '');
    const isFiltered = filters.search !== null || filters.status !== null;
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
                    search: search.trim() === '' ? null : search.trim(),
                    status: filters.status,
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
                        <Link
                            href={ProductController.create()}
                            className={primaryButtonClasses}
                        >
                            <Plus size={18} />
                            Add Product
                        </Link>
                    }
                />

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

                    <div className="flex flex-wrap gap-2">
                        {statusChips.map((chip) => (
                            <button
                                key={chip.label}
                                type="button"
                                onClick={() =>
                                    showList({
                                        search: filters.search,
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
                    </div>
                </section>

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
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    {product.sale_price_centavos !==
                                                    null ? (
                                                        <span className="inline-flex items-baseline gap-2">
                                                            <span className="text-sm text-slate-400 line-through">
                                                                {formatPeso(
                                                                    product.price_centavos,
                                                                )}
                                                            </span>
                                                            <span className="text-base font-black text-red-600">
                                                                {formatPeso(
                                                                    product.sale_price_centavos,
                                                                )}
                                                            </span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-base font-black text-blue-700">
                                                            {formatPeso(
                                                                product.price_centavos,
                                                            )}
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
                                                <td className="px-5 py-4 text-right">
                                                    <Link
                                                        href={ProductController.edit(
                                                            product.id,
                                                        )}
                                                        className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-100"
                                                    >
                                                        <Pencil size={15} />
                                                        Edit
                                                    </Link>
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
        </>
    );
}
