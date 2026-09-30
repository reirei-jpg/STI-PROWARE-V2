import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Boxes,
    ClipboardList,
    Eye,
    FileScan,
    Search,
    SearchX,
    Wallet,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController';
import PurchaseOrderScanController from '@/actions/App/Http/Controllers/PurchaseOrderScanController';
import DateRangeFilter from '@/components/date-range-filter';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import Panel, { TableHeading } from '@/components/panel';
import PurchaseOrderDetailsDialog from '@/components/purchase-order-details-dialog';
import SummaryCard from '@/components/summary-card';
import { formatDateOrdered, formatDateTime, formatPeso } from '@/lib/format';
import type {
    Auth,
    Paginated,
    PurchaseOrderFilters,
    PurchaseOrderSummary,
    PurchaseOrderTotals,
} from '@/types';

const primaryButtonClasses =
    'inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700';

const noFilters: PurchaseOrderFilters = {
    search: null,
    category: null,
    date_from: null,
    date_to: null,
};

/**
 * The filters as page-address parameters, leaving out empty ones.
 */
function filterQuery(filters: PurchaseOrderFilters): Record<string, string> {
    const query: Record<string, string> = {};

    for (const [key, value] of Object.entries(filters)) {
        if (value) {
            query[key] = value;
        }
    }

    return query;
}

function describeScope(filters: PurchaseOrderFilters): string {
    if (filters.search || filters.category) {
        return 'Orders matching your search and filters';
    }

    if (filters.date_from && filters.date_to) {
        return `Orders dated ${formatDateOrdered(filters.date_from)} to ${formatDateOrdered(filters.date_to)}`;
    }

    if (filters.date_from) {
        return `Orders dated ${formatDateOrdered(filters.date_from)} onwards`;
    }

    if (filters.date_to) {
        return `Orders dated up to ${formatDateOrdered(filters.date_to)}`;
    }

    return 'Across all uploaded purchase orders';
}

export default function PurchaseOrdersIndex({
    purchaseOrders,
    summary,
    filters,
    categories,
    openPurchaseOrderId,
}: {
    purchaseOrders: Paginated<PurchaseOrderSummary>;
    summary: PurchaseOrderTotals;
    filters: PurchaseOrderFilters;
    categories: string[];
    openPurchaseOrderId: number | null;
}) {
    const { auth, errors } = usePage<{
        auth: Auth;
        errors: Record<string, string>;
    }>().props;
    const isSpecialist = auth.user.role === 'specialist';
    const isFiltered = Object.values(filters).some((value) => value !== null);
    const [viewingId, setViewingId] = useState<number | null>(
        openPurchaseOrderId,
    );
    const [search, setSearch] = useState(filters.search ?? '');
    const firstRender = useRef(true);

    const showList = (next: PurchaseOrderFilters) => {
        router.get(PurchaseOrderController.index().url, filterQuery(next), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    // Search by Order # as the Specialist types, after a short pause.
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
        showList(noFilters);
    };

    const closeDetails = () => {
        setViewingId(null);

        // Opened from a notification: drop "?view=" so a refresh does not reopen it.
        if (openPurchaseOrderId !== null) {
            showList(filters);
        }
    };

    const summaryScope = describeScope(filters);

    return (
        <>
            <Head title="Purchase Orders" />

            <PurchaseOrderDetailsDialog
                purchaseOrderId={viewingId}
                onClose={closeDetails}
            />

            <div className="space-y-7">
                <PageHeader
                    title="Purchase Orders"
                    description="Orders placed in the eStore, approved by the School Admin, and uploaded to PROWARE."
                    actions={
                        isSpecialist && (
                            <Link
                                href={PurchaseOrderScanController.create()}
                                className={primaryButtonClasses}
                            >
                                <FileScan size={18} />
                                Scan eStore PO
                            </Link>
                        )
                    }
                />

                <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 lg:max-w-xs">
                            <Search size={18} className="shrink-0" />
                            <input
                                type="search"
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                inputMode="numeric"
                                placeholder="Search by Order #"
                                className="w-full min-w-0 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                                aria-label="Search by Order #"
                            />
                        </label>

                        {categories.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-slate-500">
                                    Category:
                                </span>
                                {[null, ...categories].map((category) => (
                                    <button
                                        key={category ?? 'all'}
                                        type="button"
                                        onClick={() =>
                                            showList({ ...filters, category })
                                        }
                                        className={`rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                                            filters.category === category
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {category ?? 'All'}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <DateRangeFilter
                        label="Date Ordered"
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
                            className="inline-flex items-center gap-2 text-sm font-black text-blue-700 hover:underline"
                        >
                            <X size={15} />
                            Clear search and all filters
                        </button>
                    )}
                </section>

                <section className="grid gap-4 md:grid-cols-3">
                    <SummaryCard
                        label="Orders Uploaded"
                        value={String(summary.orders_count)}
                        description={
                            isFiltered
                                ? summaryScope
                                : 'eStore purchase orders uploaded to PROWARE'
                        }
                        icon={ClipboardList}
                    />
                    <SummaryCard
                        label="Total QTY Ordered"
                        value={summary.total_qty_ordered.toLocaleString(
                            'en-PH',
                        )}
                        description={summaryScope}
                        icon={Boxes}
                    />
                    <SummaryCard
                        label="Total Amount (Ordered)"
                        value={formatPeso(summary.total_amount_centavos)}
                        description={`${summaryScope}, at Head Office cost`}
                        icon={Wallet}
                    />
                </section>

                <Panel
                    title="Uploaded Purchase Orders"
                    description="Newest Date Ordered first. Open View Details to see everything in an order."
                >
                    {purchaseOrders.data.length === 0 && isFiltered ? (
                        <div className="px-6 py-16 text-center">
                            <SearchX
                                size={44}
                                className="mx-auto text-slate-300"
                            />
                            <h3 className="mt-4 text-lg font-black text-slate-800">
                                No purchase orders match your search or filters
                            </h3>
                            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                                Check the Order #, try other filters, or clear
                                them to see every purchase order.
                            </p>
                            <button
                                type="button"
                                onClick={clearFilters}
                                className={`mt-6 ${primaryButtonClasses}`}
                            >
                                Clear filters
                            </button>
                        </div>
                    ) : purchaseOrders.data.length === 0 ? (
                        <div className="px-6 py-16 text-center">
                            <ClipboardList
                                size={44}
                                className="mx-auto text-slate-300"
                            />
                            <h3 className="mt-4 text-lg font-black text-slate-800">
                                No purchase orders yet
                            </h3>
                            {isSpecialist ? (
                                <>
                                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                                        Paste the order details email from the
                                        eStore to add the first one.
                                    </p>
                                    <Link
                                        href={PurchaseOrderScanController.create()}
                                        className={`mt-6 ${primaryButtonClasses}`}
                                    >
                                        <FileScan size={17} />
                                        Scan eStore PO
                                    </Link>
                                </>
                            ) : (
                                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                                    Purchase orders will appear here once the
                                    Specialist uploads them.
                                </p>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-250">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <TableHeading>Order #</TableHeading>
                                            <TableHeading>
                                                Category
                                            </TableHeading>
                                            <TableHeading>
                                                Ordered by
                                            </TableHeading>
                                            <TableHeading align="right">
                                                No. of Items
                                            </TableHeading>
                                            <TableHeading align="right">
                                                Total Amount (Ordered)
                                            </TableHeading>
                                            <TableHeading>
                                                Uploaded By
                                            </TableHeading>
                                            <TableHeading align="right">
                                                Actions
                                            </TableHeading>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {purchaseOrders.data.map(
                                            (purchaseOrder) => (
                                                <tr
                                                    key={purchaseOrder.id}
                                                    className="border-t border-slate-100"
                                                >
                                                    <td className="px-5 py-4">
                                                        <p className="font-mono text-sm font-black text-blue-700">
                                                            {purchaseOrder.order_number
                                                                ? `#${purchaseOrder.order_number}`
                                                                : '—'}
                                                        </p>
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            Ordered{' '}
                                                            {formatDateOrdered(
                                                                purchaseOrder.date_ordered,
                                                            )}
                                                        </p>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        {purchaseOrder.category ? (
                                                            <span className="inline-flex rounded-full bg-blue-100 px-3 py-1.5 text-xs font-black text-blue-700">
                                                                {
                                                                    purchaseOrder.category
                                                                }
                                                            </span>
                                                        ) : (
                                                            <span className="text-sm text-slate-400">
                                                                —
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                                                        {purchaseOrder.ordered_by ??
                                                            '—'}
                                                    </td>
                                                    <td className="px-5 py-4 text-right text-sm font-black text-slate-800">
                                                        {
                                                            purchaseOrder.items_count
                                                        }
                                                    </td>
                                                    <td className="px-5 py-4 text-right text-base font-black text-blue-700">
                                                        {formatPeso(
                                                            purchaseOrder.total_amount_centavos,
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <p className="text-sm font-semibold text-slate-700">
                                                            {
                                                                purchaseOrder.uploaded_by
                                                            }
                                                        </p>
                                                        <p className="mt-1 text-xs text-slate-400">
                                                            {formatDateTime(
                                                                purchaseOrder.uploaded_at,
                                                            )}
                                                        </p>
                                                    </td>
                                                    <td className="px-5 py-4 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setViewingId(
                                                                    purchaseOrder.id,
                                                                )
                                                            }
                                                            className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-100"
                                                        >
                                                            <Eye size={15} />
                                                            View Details
                                                        </button>
                                                    </td>
                                                </tr>
                                            ),
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <Pagination
                                pagination={purchaseOrders}
                                itemName="purchase orders"
                            />
                        </>
                    )}
                </Panel>
            </div>
        </>
    );
}
