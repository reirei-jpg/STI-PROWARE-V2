import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Boxes,
    CheckCircle2,
    Link2,
    PackagePlus,
    Search,
    SearchX,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ItemLinkController from '@/actions/App/Http/Controllers/ItemLinkController';
import ProductController from '@/actions/App/Http/Controllers/ProductController';
import LinkItemDialog from '@/components/link-item-dialog';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import Panel, { TableHeading } from '@/components/panel';
import SplitDeliveredDialog from '@/components/split-delivered-dialog';
import { formatDateOrdered, formatPeso } from '@/lib/format';
import { formatConversion } from '@/lib/units';
import type {
    ItemsToLinkFilters,
    ItemToLink,
    ItemToSplit,
    Paginated,
} from '@/types';

const primaryButtonClasses =
    'inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700';

/**
 * eStore items from uploaded orders that are not linked to a product yet.
 * Linking an item (or creating a product from it) is done once; after that
 * its deliveries go into stock by themselves.
 */
export default function ItemsToLink({
    items,
    filters,
    toSplit,
}: {
    items: Paginated<ItemToLink>;
    filters: ItemsToLinkFilters;
    toSplit: ItemToSplit[];
}) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [linking, setLinking] = useState<ItemToLink | null>(null);
    const [splitting, setSplitting] = useState<ItemToSplit | null>(null);
    const firstRender = useRef(true);

    const showList = (next: ItemsToLinkFilters) => {
        router.get(
            ItemLinkController.index().url,
            next.search ? { search: next.search } : {},
            { preserveState: true, preserveScroll: true, replace: true },
        );
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
                }),
            400,
        );

        return () => window.clearTimeout(timer);
        // Only the typed text should trigger a search.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    return (
        <>
            <Head title="Items to Link" />

            <div className="space-y-7">
                <PageHeader
                    title="Items to Link"
                    description="eStore items from your uploaded orders that are not linked to a product yet. Link each item once; after that, its deliveries go into stock by themselves."
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

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 lg:max-w-sm">
                        <Search size={18} className="shrink-0" />
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search by Item Code or description"
                            className="w-full min-w-0 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                            aria-label="Search by Item Code or description"
                        />
                    </label>
                </section>

                {toSplit.length > 0 && (
                    <Panel
                        title="Received, split it into stock"
                        description="These codes are shared by every variant of a product (e.g. every color). Count what arrived and enter how many of each, so each variant gets its own stock."
                    >
                        <ul className="divide-y divide-slate-100">
                            {toSplit.map((item) => (
                                <li
                                    key={item.item_code}
                                    className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div>
                                        <p className="font-mono font-black text-blue-700">
                                            {item.item_code}
                                        </p>
                                        <p className="mt-1 text-sm font-semibold text-slate-800">
                                            {item.product_name} ·{' '}
                                            {item.split_into.length} variants
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            Arrived, not in stock yet:{' '}
                                            <span className="font-black text-amber-700">
                                                {formatConversion(
                                                    item.units_waiting,
                                                    item.unit_name,
                                                    item.pieces_per_unit,
                                                )}
                                            </span>
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSplitting(item)}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700"
                                    >
                                        <Boxes size={16} />
                                        Split into stock
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </Panel>
                )}

                <Panel
                    title="Not Linked Yet"
                    description="Items that already arrived come first: they are waiting to be added to stock. Quantities are as ordered on the eStore, because PROWARE does not know yet if Head Office counts each item by the piece or by the pack."
                >
                    {items.data.length === 0 ? (
                        <div className="px-6 py-16 text-center">
                            {filters.search ? (
                                <>
                                    <SearchX
                                        size={44}
                                        className="mx-auto text-slate-300"
                                    />
                                    <h3 className="mt-4 text-lg font-black text-slate-800">
                                        No item matches "{filters.search}"
                                    </h3>
                                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                                        It may be linked already. Try another
                                        code or description.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearch('');
                                            showList({ search: null });
                                        }}
                                        className={`mt-6 ${primaryButtonClasses}`}
                                    >
                                        <X size={17} />
                                        Clear search
                                    </button>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2
                                        size={44}
                                        className="mx-auto text-emerald-300"
                                    />
                                    <h3 className="mt-4 text-lg font-black text-slate-800">
                                        Every eStore item is linked to a product
                                    </h3>
                                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                                        Deliveries of these items go into stock
                                        by themselves. New items show up here
                                        when you upload an order with them.
                                    </p>
                                    <Link
                                        href={ProductController.index()}
                                        className={`mt-6 ${primaryButtonClasses}`}
                                    >
                                        <ArrowLeft size={17} />
                                        Back to Products
                                    </Link>
                                </>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-250">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <TableHeading>
                                                eStore Item
                                            </TableHeading>
                                            <TableHeading>
                                                Category
                                            </TableHeading>
                                            <TableHeading>
                                                Last Ordered
                                            </TableHeading>
                                            <TableHeading align="right">
                                                QTY Ordered
                                            </TableHeading>
                                            <TableHeading align="right">
                                                Received, not in stock
                                            </TableHeading>
                                            <TableHeading align="right">
                                                Actions
                                            </TableHeading>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.data.map((item) => (
                                            <tr
                                                key={item.item_code}
                                                className="border-t border-slate-100 align-top text-sm"
                                            >
                                                <td className="px-5 py-4">
                                                    <p className="font-mono font-black text-blue-700">
                                                        {item.item_code}
                                                    </p>
                                                    <p className="mt-1 font-semibold text-slate-800">
                                                        {item.description}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        eStore Unit Price:{' '}
                                                        {formatPeso(
                                                            item.unit_price_centavos,
                                                        )}
                                                    </p>
                                                </td>
                                                <td className="px-5 py-4 text-slate-700">
                                                    {item.category ?? '—'}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <p className="font-mono font-black text-slate-800">
                                                        {item.latest_order_number
                                                            ? `#${item.latest_order_number}`
                                                            : '—'}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {formatDateOrdered(
                                                            item.latest_date_ordered,
                                                        )}
                                                    </p>
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <p className="font-black text-slate-800">
                                                        {item.quantity_ordered.toLocaleString(
                                                            'en-PH',
                                                        )}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {item.orders_count === 1
                                                            ? '1 order'
                                                            : `${item.orders_count} orders`}
                                                    </p>
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    {item.waiting_for_stock >
                                                    0 ? (
                                                        <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 font-black text-amber-800">
                                                            {item.waiting_for_stock.toLocaleString(
                                                                'en-PH',
                                                            )}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400">
                                                            Not received yet
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex flex-wrap justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setLinking(item)
                                                            }
                                                            className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-100"
                                                        >
                                                            <Link2 size={15} />
                                                            Link to a product
                                                        </button>
                                                        <Link
                                                            href={ProductController.create(
                                                                {
                                                                    query: {
                                                                        item_code:
                                                                            item.item_code,
                                                                    },
                                                                },
                                                            )}
                                                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                                                        >
                                                            <PackagePlus
                                                                size={15}
                                                            />
                                                            Create product
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <Pagination pagination={items} itemName="items" />
                        </>
                    )}
                </Panel>
            </div>

            <LinkItemDialog item={linking} onClose={() => setLinking(null)} />
            <SplitDeliveredDialog
                item={splitting}
                onClose={() => setSplitting(null)}
            />
        </>
    );
}
