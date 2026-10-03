import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Boxes,
    CalendarClock,
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
import DeliveryProgress from '@/components/delivery-progress';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import Panel, { TableHeading } from '@/components/panel';
import PurchaseOrderDetailsDialog from '@/components/purchase-order-details-dialog';
import SetExpectedDeliveryDialog from '@/components/set-expected-delivery-dialog';
import type { ExpectedDeliveryTarget } from '@/components/set-expected-delivery-dialog';
import SummaryCard from '@/components/summary-card';
import { formatDateOrdered, formatDateTime, formatPeso } from '@/lib/format';
import type {
    Auth,
    DeliveryStatus,
    Paginated,
    PurchaseOrderFilters,
    PurchaseOrderSort,
    PurchaseOrderSummary,
    PurchaseOrderTotals,
} from '@/types';

const primaryButtonClasses =
    'inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700';

const noFilters: PurchaseOrderFilters = {
    search: null,
    category: null,
    status: null,
    sort: 'expected',
    date_from: null,
    date_to: null,
};

const statusChips: { value: DeliveryStatus | null; label: string }[] = [
    { value: null, label: 'All' },
    { value: 'awaiting', label: 'Awaiting Delivery' },
    { value: 'partially_received', label: 'Partially Received' },
    { value: 'completed', label: 'Completed' },
    { value: 'completed_short', label: 'Completed (short)' },
];

const sortOptions: { value: PurchaseOrderSort; label: string }[] = [
    { value: 'expected', label: 'Next expected delivery first' },
    { value: 'newest', label: 'Newest Date Ordered first' },
    { value: 'oldest_waiting', label: 'Still waiting, oldest first' },
];

/**
 * The filters as page-address parameters, leaving out empty ones and the
 * default sort.
 */
function filterQuery(filters: PurchaseOrderFilters): Record<string, string> {
    const query: Record<string, string> = {};

    for (const [key, value] of Object.entries(filters)) {
        if (value && !(key === 'sort' && value === 'expected')) {
            query[key] = value;
        }
    }

    return query;
}

/**
 * "Tomorrow, Oct 2", "Today, Oct 1" or "Oct 5, 2026".
 */
function describeExpected(date: string, today: string): string {
    const days = Math.round(
        (new Date(`${date}T00:00:00`).getTime() -
            new Date(`${today}T00:00:00`).getTime()) /
            86_400_000,
    );
    const formatted = formatDateOrdered(date);

    if (days === 0) {
        return `Today, ${formatted}`;
    }

    if (days === 1) {
        return `Tomorrow, ${formatted}`;
    }

    return days < 0 ? `${formatted} (passed)` : formatted;
}

function describeScope(filters: PurchaseOrderFilters): string {
    if (filters.search || filters.category || filters.status) {
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
    today,
}: {
    purchaseOrders: Paginated<PurchaseOrderSummary>;
    summary: PurchaseOrderTotals;
    filters: PurchaseOrderFilters;
    categories: string[];
    openPurchaseOrderId: number | null;
    today: string;
}) {
    const { auth, errors } = usePage<{
        auth: Auth;
        errors: Record<string, string>;
    }>().props;
    const isSpecialist = auth.user.role === 'specialist';
    const isFiltered = Boolean(
        filters.search ||
        filters.category ||
        filters.status ||
        filters.date_from ||
        filters.date_to,
    );
    const [viewingId, setViewingId] = useState<number | null>(
        openPurchaseOrderId,
    );
    const [settingDateFor, setSettingDateFor] =
        useState<ExpectedDeliveryTarget | null>(null);
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
        showList({ ...noFilters, sort: filters.sort });
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
                onSetExpectedDate={(order) => {
                    setViewingId(null);
                    setSettingDateFor(order);
                }}
            />

            <SetExpectedDeliveryDialog
                order={settingDateFor}
                today={today}
                onClose={() => setSettingDateFor(null)}
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

                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-slate-500">
                                Delivery:
                            </span>
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
                        </div>

                        <label className="flex items-center gap-2 text-sm font-bold text-slate-500">
                            Sort:
                            <select
                                value={filters.sort}
                                onChange={(event) =>
                                    showList({
                                        ...filters,
                                        sort: event.target
                                            .value as PurchaseOrderSort,
                                    })
                                }
                                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            >
                                {sortOptions.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>
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
                            className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
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
                    description={`${sortOptions.find((option) => option.value === filters.sort)?.label ?? ''}. Open View Details to see every item, what has arrived, and the delivery history.`}
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
                                                Delivery
                                            </TableHeading>
                                            <TableHeading>
                                                Expected Delivery
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
                                                            {purchaseOrder.ordered_by &&
                                                                ` by ${purchaseOrder.ordered_by}`}
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
                                                    <td className="px-5 py-4">
                                                        <DeliveryProgress
                                                            progress={
                                                                purchaseOrder
                                                            }
                                                        />
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        {purchaseOrder.expected_delivery_date ? (
                                                            <>
                                                                <p className="text-sm font-black text-slate-800">
                                                                    {describeExpected(
                                                                        purchaseOrder.expected_delivery_date,
                                                                        today,
                                                                    )}
                                                                </p>
                                                                {purchaseOrder.expected_delivery_note && (
                                                                    <p className="mt-1 max-w-48 truncate text-xs text-slate-500">
                                                                        {
                                                                            purchaseOrder.expected_delivery_note
                                                                        }
                                                                    </p>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <p className="text-sm text-slate-400">
                                                                {[
                                                                    'awaiting',
                                                                    'partially_received',
                                                                ].includes(
                                                                    purchaseOrder.delivery_status,
                                                                )
                                                                    ? 'Not set yet'
                                                                    : '—'}
                                                            </p>
                                                        )}
                                                        {isSpecialist &&
                                                            [
                                                                'awaiting',
                                                                'partially_received',
                                                            ].includes(
                                                                purchaseOrder.delivery_status,
                                                            ) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setSettingDateFor(
                                                                            purchaseOrder,
                                                                        )
                                                                    }
                                                                    className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-100"
                                                                >
                                                                    <CalendarClock
                                                                        size={
                                                                            15
                                                                        }
                                                                    />
                                                                    {purchaseOrder.expected_delivery_date
                                                                        ? 'Change date'
                                                                        : 'Set delivery date'}
                                                                </button>
                                                            )}
                                                    </td>
                                                    <td className="px-5 py-4 text-right">
                                                        <p className="text-base font-black text-blue-700">
                                                            {formatPeso(
                                                                purchaseOrder.total_amount_centavos,
                                                            )}
                                                        </p>
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            No. of Items:{' '}
                                                            {
                                                                purchaseOrder.items_count
                                                            }
                                                        </p>
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
