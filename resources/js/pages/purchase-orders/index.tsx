import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Boxes,
    CalendarSearch,
    ClipboardList,
    Eye,
    FileScan,
    Wallet,
} from 'lucide-react';
import { useState } from 'react';
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

/**
 * The filters as page-address parameters, leaving out empty ones.
 */
function filterQuery(filters: PurchaseOrderFilters): Record<string, string> {
    const query: Record<string, string> = {};

    if (filters.date_from) {
        query.date_from = filters.date_from;
    }

    if (filters.date_to) {
        query.date_to = filters.date_to;
    }

    return query;
}

function describeRange(filters: PurchaseOrderFilters): string {
    if (filters.date_from && filters.date_to) {
        return `Orders dated ${formatDateOrdered(filters.date_from)} to ${formatDateOrdered(filters.date_to)}`;
    }

    if (filters.date_from) {
        return `Orders dated ${formatDateOrdered(filters.date_from)} onwards`;
    }

    return `Orders dated up to ${formatDateOrdered(filters.date_to)}`;
}

export default function PurchaseOrdersIndex({
    purchaseOrders,
    summary,
    filters,
    openPurchaseOrderId,
}: {
    purchaseOrders: Paginated<PurchaseOrderSummary>;
    summary: PurchaseOrderTotals;
    filters: PurchaseOrderFilters;
    openPurchaseOrderId: number | null;
}) {
    const { auth, errors } = usePage<{
        auth: Auth;
        errors: Record<string, string>;
    }>().props;
    const isSpecialist = auth.user.role === 'specialist';
    const isFiltered = filters.date_from !== null || filters.date_to !== null;
    const [viewingId, setViewingId] = useState<number | null>(
        openPurchaseOrderId,
    );

    const showList = (query: Record<string, string>) => {
        router.get(PurchaseOrderController.index().url, query, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const closeDetails = () => {
        setViewingId(null);

        // Opened from a notification: drop "?view=" so a refresh does not reopen it.
        if (openPurchaseOrderId !== null) {
            showList(filterQuery(filters));
        }
    };

    const summaryScope = isFiltered
        ? describeRange(filters)
        : 'Across all uploaded purchase orders';

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

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <DateRangeFilter
                        label="Date Ordered"
                        dateFrom={filters.date_from}
                        dateTo={filters.date_to}
                        serverError={errors.date_from ?? errors.date_to}
                        onChange={(dateFrom, dateTo) =>
                            showList(
                                filterQuery({
                                    date_from: dateFrom,
                                    date_to: dateTo,
                                }),
                            )
                        }
                    />
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
                            <CalendarSearch
                                size={44}
                                className="mx-auto text-slate-300"
                            />
                            <h3 className="mt-4 text-lg font-black text-slate-800">
                                No purchase orders match these dates
                            </h3>
                            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                                Try other dates, or clear the filters to see
                                every purchase order.
                            </p>
                            <button
                                type="button"
                                onClick={() => showList({})}
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
                                        Upload the purchase order file from an
                                        eStore email to add the first one.
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
                                <table className="w-full min-w-225">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <TableHeading>
                                                Date Ordered
                                            </TableHeading>
                                            <TableHeading>
                                                Category
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
                                                    <td className="px-5 py-4 font-black text-slate-900">
                                                        {formatDateOrdered(
                                                            purchaseOrder.date_ordered,
                                                        )}
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
