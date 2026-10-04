import { Head, Link, router, usePage } from '@inertiajs/react';
import { Plus, Search, SearchX, Truck, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import DeliveryController from '@/actions/App/Http/Controllers/DeliveryController';
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController';
import DateRangeFilter from '@/components/date-range-filter';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import Panel, { TableHeading } from '@/components/panel';
import { formatDateOrdered, formatDateTime } from '@/lib/format';
import { formatUnits } from '@/lib/units';
import type {
    Auth,
    DeliveryFilters,
    DeliveryListItem,
    Paginated,
} from '@/types';

const primaryButtonClasses =
    'inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700';

function filterQuery(filters: DeliveryFilters): Record<string, string> {
    const query: Record<string, string> = {};

    for (const [key, value] of Object.entries(filters)) {
        if (value) {
            query[key] = value;
        }
    }

    return query;
}

export default function DeliveriesIndex({
    deliveries,
    filters,
}: {
    deliveries: Paginated<DeliveryListItem>;
    filters: DeliveryFilters;
}) {
    const { errors, auth } = usePage<{
        errors: Record<string, string>;
        auth: Auth;
    }>().props;
    // The School Admin only looks; recording deliveries is the Specialist's.
    const canRecord = auth.user.role === 'specialist';
    const [search, setSearch] = useState(filters.search ?? '');
    const firstRender = useRef(true);
    const isFiltered = Boolean(
        filters.search || filters.date_from || filters.date_to,
    );

    const showList = (next: DeliveryFilters) => {
        router.get(DeliveryController.index().url, filterQuery(next), {
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

    const clearFilters = () => {
        setSearch('');
        showList({ search: null, date_from: null, date_to: null });
    };

    return (
        <>
            <Head title="Deliveries" />

            <div className="space-y-7">
                <PageHeader
                    title="Deliveries"
                    description="Everything that arrived from Head Office, newest first. Each delivery updates the orders it belongs to."
                    actions={
                        canRecord && (
                            <Link
                                href={DeliveryController.create()}
                                className={primaryButtonClasses}
                            >
                                <Plus size={18} />
                                Record Delivery
                            </Link>
                        )
                    }
                />

                <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 lg:max-w-sm">
                        <Search size={18} className="shrink-0" />
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search by SI #, DR # or Order #"
                            className="w-full min-w-0 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                            aria-label="Search by SI #, DR # or Order #"
                        />
                    </label>

                    <DateRangeFilter
                        label="Date Received"
                        dateFrom={filters.date_from}
                        dateTo={filters.date_to}
                        serverError={errors.date_from ?? errors.date_to}
                        onChange={(dateFrom, dateTo) =>
                            showList({
                                ...filters,
                                date_from: dateFrom,
                                date_to: dateTo,
                            })
                        }
                    />

                    {isFiltered && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                            <X size={15} />
                            Clear search and all filters
                        </button>
                    )}
                </section>

                <Panel
                    title="Recorded Deliveries"
                    description="Open an order on Purchase Orders to see what is still to come."
                >
                    {deliveries.data.length === 0 ? (
                        <div className="px-6 py-16 text-center">
                            {isFiltered ? (
                                <SearchX
                                    size={44}
                                    className="mx-auto text-slate-300"
                                />
                            ) : (
                                <Truck
                                    size={44}
                                    className="mx-auto text-slate-300"
                                />
                            )}
                            <h3 className="mt-4 text-lg font-black text-slate-800">
                                {isFiltered
                                    ? 'No deliveries match your search or filters'
                                    : 'No deliveries recorded yet'}
                            </h3>
                            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                                {isFiltered
                                    ? 'Check the number you typed, or clear the filters.'
                                    : 'When boxes arrive from Head Office, record them here so every order shows what has arrived.'}
                            </p>
                            {isFiltered ? (
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className={`mt-6 ${primaryButtonClasses}`}
                                >
                                    Clear filters
                                </button>
                            ) : (
                                canRecord && (
                                    <Link
                                        href={DeliveryController.create()}
                                        className={`mt-6 ${primaryButtonClasses}`}
                                    >
                                        <Plus size={17} />
                                        Record Delivery
                                    </Link>
                                )
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-225">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <TableHeading>
                                                Date Received
                                            </TableHeading>
                                            <TableHeading>SI #</TableHeading>
                                            <TableHeading>DR #</TableHeading>
                                            <TableHeading>Orders</TableHeading>
                                            <TableHeading align="right">
                                                Added to Stock
                                            </TableHeading>
                                            <TableHeading>
                                                Recorded By
                                            </TableHeading>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {deliveries.data.map((delivery) => (
                                            <tr
                                                key={delivery.id}
                                                className="border-t border-slate-100 align-top text-sm"
                                            >
                                                <td className="px-5 py-4">
                                                    <p className="font-black text-slate-900">
                                                        {formatDateOrdered(
                                                            delivery.received_on,
                                                        )}
                                                    </p>
                                                    {delivery.note && (
                                                        <p className="mt-1 max-w-56 text-xs text-slate-500">
                                                            {delivery.note}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 font-mono text-slate-700">
                                                    {delivery.sales_invoice_number ??
                                                        '—'}
                                                </td>
                                                <td className="px-5 py-4 font-mono text-slate-700">
                                                    {delivery.delivery_receipt_number ??
                                                        '—'}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {delivery.orders.map(
                                                            (order) => (
                                                                <Link
                                                                    key={
                                                                        order.id
                                                                    }
                                                                    href={PurchaseOrderController.index(
                                                                        {
                                                                            query: {
                                                                                view: order.id,
                                                                            },
                                                                        },
                                                                    )}
                                                                    className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-mono text-xs font-black text-blue-700 transition hover:bg-blue-100"
                                                                    title="Open this purchase order"
                                                                >
                                                                    {order.order_number
                                                                        ? `#${order.order_number}`
                                                                        : 'Open order'}
                                                                </Link>
                                                            ),
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <p className="text-base font-black text-emerald-700">
                                                        {delivery.pieces_added_to_stock >
                                                        0
                                                            ? `+${formatUnits(delivery.pieces_added_to_stock, 'Piece')}`
                                                            : '—'}
                                                    </p>
                                                    {delivery.items_not_in_stock >
                                                        0 && (
                                                        <p className="mt-1 text-xs font-bold text-amber-700">
                                                            {delivery.items_not_in_stock ===
                                                            1
                                                                ? '1 item not linked to a product yet'
                                                                : `${delivery.items_not_in_stock} items not linked to a product yet`}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <p className="font-semibold text-slate-700">
                                                        {delivery.recorded_by}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {formatDateTime(
                                                            delivery.recorded_at,
                                                        )}
                                                    </p>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <Pagination
                                pagination={deliveries}
                                itemName="deliveries"
                            />
                        </>
                    )}
                </Panel>
            </div>
        </>
    );
}
