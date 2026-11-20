import { Head, router, usePage } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    CalendarDays,
    Download,
    Eye,
    Gift,
    LoaderCircle,
    Search,
    ShoppingCart,
    Tag,
    TrendingDown,
    TrendingUp,
    Trophy,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import SalesReportController from '@/actions/App/Http/Controllers/SalesReportController';
import InputError from '@/components/input-error';
import FreeUniformGroupDialog from '@/components/free-uniform-group-dialog';
import PageHeader from '@/components/page-header';
import PurchaseOrderDetailsDialog from '@/components/purchase-order-details-dialog';
import Pagination from '@/components/pagination';
import Panel, { TableHeading, TableScroll } from '@/components/panel';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { monthBefore, todayIso } from '@/lib/dates';
import { formatDateOrdered, formatDateTime, formatPeso } from '@/lib/format';
import { openCalendar } from '@/lib/open-calendar';
import { formatUnits } from '@/lib/units';
import { cn, isSameSearch } from '@/lib/utils';
import type {
    BestSellerRow,
    FreeRow,
    FreeUniformGroupDetails,
    Paginated,
    PriceHistory,
    SalesPeriod,
    SalesReportFilters,
    SalesSummary,
    SalesTab,
    SoldDetails,
    SoldProduct,
    SoldRow,
    SpentRow,
} from '@/types';

const periods: { value: SalesPeriod; label: string }[] = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
];

const tabs: { value: SalesTab; label: string }[] = [
    { value: 'spent', label: 'Purchases' },
    { value: 'sold', label: 'Sales' },
    { value: 'best', label: 'Top Sellers' },
    { value: 'free', label: 'Free Uniforms' },
];

/**
 * The Specialist's Sales Reports, in plain words. For a period: what was
 * spent on eStore orders; what was sold, each product with its Cost (what
 * PROWARE paid on the eStore order), its Price (what the student paid), the
 * Profit and Head Office's price now (View Details: each size or color,
 * and what Head Office charged on each eStore order); the best sellers; what was sold below its
 * Cost; and what free uniforms (promo) were worth. Four tabs list the details.
 */
export default function SalesReportsIndex({
    summary,
    spent,
    sold,
    best,
    free,
    free_group,
    sold_details,
    filters,
}: {
    summary: SalesSummary;
    spent: Paginated<SpentRow> | null;
    sold: Paginated<SoldProduct> | null;
    best: Paginated<BestSellerRow> | null;
    free: Paginated<FreeRow> | null;
    /** The group opened with View Details on Free Uniforms; undefined until loaded. */
    free_group?: FreeUniformGroupDetails | null;
    /** The product opened with View Details on Sales; undefined until loaded. */
    sold_details?: SoldDetails | null;
    filters: SalesReportFilters;
}) {
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const [search, setSearch] = useState(filters.search ?? '');
    const pickedDates = filters.period === 'custom';
    const today = todayIso();
    const firstRender = useRef(true);
    const periodText =
        filters.date_from === filters.date_to
            ? formatDateOrdered(filters.date_from)
            : `${formatDateOrdered(filters.date_from)} to ${formatDateOrdered(filters.date_to)}`;

    const show = (next: Partial<SalesReportFilters>) => {
        const merged = { ...filters, ...next };
        const query: Record<string, string> = {};

        if (merged.tab !== 'sold') {
            query.tab = merged.tab;
        }

        if (merged.period !== 'all') {
            query.period = merged.period;
        }

        if (merged.period === 'custom') {
            query.date_from = merged.date_from;
            query.date_to = merged.date_to;
        }

        if (merged.search) {
            query.search = merged.search;
        }

        if (merged.tab === 'sold' && merged.only) {
            query.only = merged.only;
        }

        router.get(SalesReportController.index().url, query, {
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
            () => show({ search: search.trim() === '' ? null : search.trim() }),
            400,
        );

        return () => window.clearTimeout(timer);
        // Only the typed search starts a new search.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const exportQuery: Record<string, string> =
        filters.period === 'custom'
            ? {
                  period: 'custom',
                  date_from: filters.date_from,
                  date_to: filters.date_to,
              }
            : { period: filters.period };

    return (
        <>
            <Head title="Sales Reports" />

            <div className="space-y-6">
                <PageHeader
                    title="Sales Reports"
                    description="Purchases from the eStore, sales and profit with our prices beside the eStore prices, top sellers, sales below cost, and what free uniforms were worth."
                />

                <section
                    className={cn(
                        'grid gap-4 sm:grid-cols-2',
                        summary.below_cost_lines > 0
                            ? 'xl:grid-cols-4'
                            : 'xl:grid-cols-3',
                    )}
                >
                    <Card
                        icon={ShoppingCart}
                        tone="blue"
                        label="Total Purchases"
                        value={formatPeso(summary.spent_centavos)}
                        detail={`${summary.purchase_orders} eStore ${summary.purchase_orders === 1 ? 'order' : 'orders'} (by order date)${summary.spent_for_preorders_centavos > 0 ? ` · ${formatPeso(summary.spent_for_preorders_centavos)} for preorders` : ''}`}
                        note={
                            summary.not_arrived_centavos > 0
                                ? `${formatPeso(summary.not_arrived_centavos)} not received (${summary.short_orders} ${summary.short_orders === 1 ? 'order' : 'orders'} closed short) · not included`
                                : undefined
                        }
                        onClick={() => show({ tab: 'spent' })}
                    />
                    <Card
                        icon={
                            summary.profit_centavos < 0
                                ? TrendingDown
                                : TrendingUp
                        }
                        tone={summary.profit_centavos < 0 ? 'red' : 'green'}
                        label="Gross Profit"
                        value={formatPeso(summary.profit_centavos)}
                        detail={`Sales ${formatPeso(summary.costed_price_centavos)} − Cost ${formatPeso(summary.cost_centavos)}`}
                        onClick={() => show({ tab: 'sold', only: null })}
                    />
                    {/* A price set before a dearer eStore order arrived can still sell below Cost. */}
                    {summary.below_cost_lines > 0 && (
                        <Card
                            icon={Tag}
                            tone="red"
                            label="Loss on Below-Cost Sales"
                            value={formatPeso(summary.below_cost_loss_centavos)}
                            detail={`${summary.below_cost_lines} ${summary.below_cost_lines === 1 ? 'sale' : 'sales'} sold below cost`}
                            onClick={() =>
                                show({ tab: 'sold', only: 'below_cost' })
                            }
                        />
                    )}
                    <Card
                        icon={Gift}
                        tone="amber"
                        label="Free Uniforms"
                        value={formatPeso(summary.free_cost_centavos)}
                        detail={`${formatUnits(summary.free_pieces, 'Piece')} at cost · ${formatPeso(summary.free_price_centavos)} at selling price`}
                        onClick={() => show({ tab: 'free' })}
                    />
                </section>

                <Panel>
                    {/* The period first, between the cards and the tabs. */}
                    <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                            {periods.map((period) => (
                                <button
                                    key={period.value}
                                    type="button"
                                    onClick={() =>
                                        show({ period: period.value })
                                    }
                                    aria-pressed={
                                        filters.period === period.value
                                    }
                                    className={cn(
                                        'rounded-xl px-4 py-2.5 text-sm font-black transition',
                                        filters.period === period.value
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                                    )}
                                >
                                    {period.label}
                                </button>
                            ))}
                            {/* From / To, as on Products > Slow-moving: either day can be picked first. */}
                            <span
                                className={cn(
                                    'inline-flex flex-wrap items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-black',
                                    pickedDates
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-600',
                                )}
                            >
                                <CalendarDays size={16} />
                                {/* Clicking the word or the box opens the calendar. */}
                                <label className="inline-flex cursor-pointer items-center gap-2">
                                    From
                                    <input
                                        type="date"
                                        onClick={openCalendar}
                                        value={
                                            pickedDates ? filters.date_from : ''
                                        }
                                        max={
                                            pickedDates
                                                ? filters.date_to
                                                : today
                                        }
                                        onChange={(event) =>
                                            event.target.value !== '' &&
                                            show({
                                                period: 'custom',
                                                date_from: event.target.value,
                                                // Picked alone: up to today.
                                                date_to:
                                                    pickedDates &&
                                                    filters.date_to >=
                                                        event.target.value
                                                        ? filters.date_to
                                                        : today,
                                            })
                                        }
                                        aria-label="From this day"
                                        className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-bold text-slate-800 outline-none"
                                    />
                                </label>
                                <label className="inline-flex cursor-pointer items-center gap-2">
                                    To
                                    <input
                                        type="date"
                                        onClick={openCalendar}
                                        value={
                                            pickedDates ? filters.date_to : ''
                                        }
                                        min={
                                            pickedDates
                                                ? filters.date_from
                                                : undefined
                                        }
                                        max={today}
                                        onChange={(event) =>
                                            event.target.value !== '' &&
                                            show({
                                                period: 'custom',
                                                // Picked first: From is one month before, to change if needed.
                                                date_from:
                                                    pickedDates &&
                                                    filters.date_from <=
                                                        event.target.value
                                                        ? filters.date_from
                                                        : monthBefore(
                                                              event.target
                                                                  .value,
                                                          ),
                                                date_to: event.target.value,
                                            })
                                        }
                                        aria-label="To this day"
                                        className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-bold text-slate-800 outline-none"
                                    />
                                </label>
                                {pickedDates && (
                                    <button
                                        type="button"
                                        onClick={() => show({ period: 'all' })}
                                        className="inline-flex size-7 items-center justify-center rounded-lg bg-white/20 transition hover:bg-white/30"
                                        aria-label="Clear the dates"
                                        title="Clear the dates (All Time)"
                                    >
                                        <X size={15} />
                                    </button>
                                )}
                            </span>
                        </div>
                        <p className="text-base font-black text-slate-900">
                            {periodText}
                        </p>
                    </div>
                    <InputError
                        className="border-b border-slate-100 px-6 py-2"
                        message={errors.date_from ?? errors.date_to}
                    />

                    <div className="flex justify-center border-b border-slate-100 px-6 py-5">
                        <div className="inline-flex flex-wrap justify-center rounded-2xl border border-slate-200 bg-slate-50 p-1">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.value}
                                    type="button"
                                    onClick={() =>
                                        show({ tab: tab.value, only: null })
                                    }
                                    className={cn(
                                        'rounded-xl px-4 py-2 text-sm font-black transition',
                                        filters.tab === tab.value
                                            ? 'bg-[#0D6EFD] text-white shadow-sm'
                                            : 'text-slate-600 hover:bg-white',
                                    )}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {filters.tab === 'sold' && (
                        <div className="border-b border-slate-100 px-6 py-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 sm:w-72">
                                    <Search size={18} className="shrink-0" />
                                    <input
                                        type="search"
                                        maxLength={120}
                                        value={search}
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
                                        placeholder="Search item"
                                        className="w-full min-w-0 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                                        aria-label="Search item"
                                    />
                                </label>
                                <a
                                    href={
                                        SalesReportController.export({
                                            query: exportQuery,
                                        }).url
                                    }
                                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                                >
                                    <Download size={16} />
                                    Export to Excel
                                </a>
                            </div>
                        </div>
                    )}

                    {spent && <SpentTable rows={spent} />}
                    {sold && (
                        <>
                            <div className="border-b border-slate-100 px-6 py-3">
                                <p className="text-xs text-slate-500">
                                    Sorted by highest gross profit, then
                                    quantity sold. eStore Cost is from the
                                    latest eStore order.
                                </p>
                            </div>
                            {filters.only === 'below_cost' && (
                                <div className="flex flex-col gap-2 border-b border-red-100 bg-red-50/70 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="flex items-center gap-2 text-sm font-black text-red-700">
                                        <TrendingDown size={16} />
                                        Showing only products sold below cost
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => show({ only: null })}
                                        className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                                    >
                                        Show all products
                                    </button>
                                </div>
                            )}
                            <SoldTable
                                rows={sold}
                                details={sold_details}
                                onlyBelowCost={filters.only === 'below_cost'}
                                search={filters.search}
                            />
                        </>
                    )}
                    {best && (
                        <BestSellersTable rows={best} details={sold_details} />
                    )}
                    {free && (
                        <FreeTable rows={free} groupDetails={free_group} />
                    )}
                </Panel>
            </div>
        </>
    );
}

const toneClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
} as const;

function Card({
    icon: Icon,
    tone,
    label,
    value,
    detail,
    note,
    onClick,
}: {
    icon: LucideIcon;
    tone: keyof typeof toneClasses;
    label: string;
    value: string;
    detail: string;
    note?: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
            <span
                className={cn(
                    'flex size-11 items-center justify-center rounded-2xl',
                    toneClasses[tone],
                )}
            >
                <Icon size={21} />
            </span>
            <span className="mt-4 text-xs font-black tracking-wide text-slate-500 uppercase">
                {label}
            </span>
            <span
                className={cn(
                    'mt-0.5 text-2xl font-black tracking-tight',
                    tone === 'red'
                        ? 'text-red-600'
                        : tone === 'green'
                          ? 'text-emerald-700'
                          : 'text-slate-900',
                )}
            >
                {value}
            </span>
            <span className="text-sm text-slate-500">{detail}</span>
            {note && (
                <span className="mt-2 text-xs font-bold text-amber-700">
                    {note}
                </span>
            )}
        </button>
    );
}

function Empty({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
    return (
        <div className="px-6 py-16 text-center">
            <Icon size={44} className="mx-auto text-slate-300" />
            <p className="mt-4 text-lg font-black text-slate-800">{text}</p>
        </div>
    );
}

/** The V1 colors: amber waiting, blue in progress, green done, red short. */
const spentStatusClasses: Record<SpentRow['delivery_status'], string> = {
    awaiting: 'bg-amber-100 text-amber-800',
    partially_received: 'bg-blue-100 text-blue-700',
    completed: 'bg-emerald-100 text-emerald-700',
    completed_short: 'bg-red-100 text-red-700',
};

/**
 * 1. Purchases: the uploaded eStore orders of the period: what was bought,
 * whether it arrived, how much was for buyers' preorders and what it cost
 * (closed short: only what arrived, with what did not arrive). A click
 * opens the order with its items (to read only: Stock In is on Purchase
 * Orders).
 */
function SpentTable({ rows }: { rows: Paginated<SpentRow> }) {
    const [viewingId, setViewingId] = useState<number | null>(null);

    if (rows.data.length === 0) {
        return (
            <Empty icon={ShoppingCart} text="No eStore orders in this period" />
        );
    }

    return (
        <>
            <PurchaseOrderDetailsDialog
                purchaseOrderId={viewingId}
                onClose={() => setViewingId(null)}
                readOnly
            />
            <TableScroll>
                <table className="w-full min-w-240">
                    <thead className="bg-slate-50">
                        <tr>
                            <TableHeading>Order #</TableHeading>
                            <TableHeading>Date ordered</TableHeading>
                            <TableHeading>Items</TableHeading>
                            <TableHeading>Status</TableHeading>
                            <TableHeading align="right">Received</TableHeading>
                            <TableHeading align="right">
                                For preorders
                            </TableHeading>
                            <TableHeading align="right">Amount</TableHeading>
                            <TableHeading>Uploaded by</TableHeading>
                            <TableHeading align="right">
                                <span className="sr-only">Actions</span>
                            </TableHeading>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.data.map((row) => (
                            <tr
                                key={row.id}
                                onClick={() => setViewingId(row.id)}
                                className="cursor-pointer border-t border-slate-100 text-sm transition hover:bg-slate-50"
                            >
                                <td className="px-5 py-4 font-mono font-black text-blue-700">
                                    {row.order_number
                                        ? `#${row.order_number}`
                                        : 'No order #'}
                                </td>
                                <td className="px-5 py-4 text-slate-700">
                                    {formatDateOrdered(row.date_ordered)}
                                </td>
                                <td className="max-w-64 px-5 py-4 font-semibold text-slate-800">
                                    {row.items_label}
                                </td>
                                <td className="px-5 py-4">
                                    <span
                                        className={cn(
                                            'inline-flex rounded-full px-2.5 py-1 text-xs font-black whitespace-nowrap',
                                            spentStatusClasses[
                                                row.delivery_status
                                            ],
                                        )}
                                    >
                                        {row.delivery_status_label}
                                    </span>
                                </td>
                                {/* How much of the order arrived: green all, amber some, red closed short. */}
                                <td className="px-5 py-4 text-right whitespace-nowrap">
                                    <span
                                        className={cn(
                                            'font-black',
                                            row.delivery_status ===
                                                'completed_short'
                                                ? 'text-red-600'
                                                : row.quantity_received >=
                                                    row.quantity_ordered
                                                  ? 'text-emerald-700'
                                                  : 'text-amber-700',
                                        )}
                                    >
                                        {row.quantity_received.toLocaleString(
                                            'en-PH',
                                        )}
                                    </span>
                                    <span className="font-semibold text-slate-500">
                                        {' '}
                                        of{' '}
                                        {row.quantity_ordered.toLocaleString(
                                            'en-PH',
                                        )}
                                    </span>
                                </td>
                                {/* How many of the ordered items were for buyers' preorders. */}
                                <td className="px-5 py-4 text-right whitespace-nowrap">
                                    {row.preorder_quantity === null ? (
                                        <span
                                            className="font-black text-slate-300"
                                            title="Ordered before preorders were counted"
                                        >
                                            —
                                        </span>
                                    ) : row.preorder_quantity > 0 ? (
                                        <span className="font-black text-blue-700">
                                            {row.preorder_quantity.toLocaleString(
                                                'en-PH',
                                            )}
                                        </span>
                                    ) : (
                                        <span className="font-semibold text-slate-400">
                                            None
                                        </span>
                                    )}
                                </td>
                                <td className="px-5 py-4 text-right whitespace-nowrap">
                                    <p className="text-base font-black text-slate-900">
                                        {formatPeso(row.total_centavos)}
                                    </p>
                                    {/* Closed short: only what arrived counts. */}
                                    {row.not_arrived_centavos > 0 && (
                                        <>
                                            <p className="text-xs font-semibold text-slate-500">
                                                of{' '}
                                                {formatPeso(
                                                    row.ordered_centavos,
                                                )}{' '}
                                                ordered
                                            </p>
                                            <p className="text-xs font-bold text-red-600">
                                                {formatPeso(
                                                    row.not_arrived_centavos,
                                                )}{' '}
                                                not received
                                            </p>
                                        </>
                                    )}
                                </td>
                                <td className="px-5 py-4 text-slate-700">
                                    {row.uploaded_by}
                                </td>
                                <td className="px-5 py-4 text-right">
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setViewingId(row.id);
                                        }}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 text-sm font-black whitespace-nowrap text-blue-700 transition hover:bg-blue-100"
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
            {rows.data.some((row) => row.not_arrived_centavos > 0) && (
                <p className="border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
                    An order closed short (the rest will not arrive) includes
                    only what was received. What was not received is shown in
                    red and is not included.
                </p>
            )}
            {rows.data.some((row) => row.preorder_quantity === null) && (
                <p className="border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
                    For preorders "—": ordered before preorders were counted.
                </p>
            )}
            <Pagination pagination={rows} itemName="orders" />
        </>
    );
}

/**
 * Top Sellers: products ranked by pieces sold in the period (all sizes,
 * colors and prices together; the same pieces share a rank), with their
 * sales, profit and top variant. View Details is the same as on Sales.
 */
function BestSellersTable({
    rows,
    details,
}: {
    rows: Paginated<BestSellerRow>;
    details: SoldDetails | null | undefined;
}) {
    const [viewingId, setViewingId] = useState<number | null>(null);

    if (rows.data.length === 0) {
        return <Empty icon={Trophy} text="Nothing sold in this period" />;
    }

    const view = (productId: number) => {
        setViewingId(productId);
        router.reload({ data: { details: productId }, only: ['sold_details'] });
    };

    return (
        <>
            <SoldDetailsDialog
                open={viewingId !== null}
                // Another product's details (from before) count as loading.
                details={
                    details === null || details?.product_id === viewingId
                        ? details
                        : undefined
                }
                onClose={() => setViewingId(null)}
            />
            <div className="border-b border-slate-100 px-6 py-3">
                <p className="text-xs text-slate-500">
                    Ranked by quantity sold, then total sales. Products with the
                    same quantity share a rank.
                </p>
            </div>
            <TableScroll>
                <table className="w-full min-w-220">
                    <thead className="bg-slate-50">
                        <tr>
                            <TableHeading>Rank</TableHeading>
                            <TableHeading>Product</TableHeading>
                            <TableHeading align="right">Qty Sold</TableHeading>
                            <TableHeading>Top Variant</TableHeading>
                            <TableHeading align="right">
                                Total Sales
                            </TableHeading>
                            <TableHeading align="right">
                                Gross Profit
                            </TableHeading>
                            <TableHeading align="right">
                                <span className="sr-only">Actions</span>
                            </TableHeading>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.data.map((row) => (
                            <tr
                                key={row.product_id}
                                onClick={() => view(row.product_id)}
                                className="cursor-pointer border-t border-slate-100 text-sm transition hover:bg-slate-50"
                            >
                                <td className="px-5 py-4">
                                    <span
                                        className={cn(
                                            'inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-black',
                                            row.rank <= 3
                                                ? 'bg-amber-100 text-amber-800'
                                                : 'bg-slate-100 text-slate-600',
                                        )}
                                    >
                                        #{row.rank}
                                    </span>
                                </td>
                                <td className="px-5 py-4 font-black text-slate-900">
                                    {row.product_name}
                                </td>
                                <td className="px-5 py-4 text-right text-base font-black whitespace-nowrap text-slate-900">
                                    {formatUnits(row.pieces, 'Piece')}
                                </td>
                                <td className="px-5 py-4 whitespace-nowrap text-slate-700">
                                    {row.top_variant_label === null
                                        ? 'One size'
                                        : `${row.top_variant_label} · ${formatUnits(row.top_variant_pieces, 'Piece')}`}
                                </td>
                                <td className="px-5 py-4 text-right font-black whitespace-nowrap text-slate-900">
                                    {formatPeso(row.price_total_centavos)}
                                </td>
                                <td
                                    className={cn(
                                        'px-5 py-4 text-right font-black whitespace-nowrap',
                                        row.profit_centavos === null
                                            ? 'text-slate-400'
                                            : row.profit_centavos < 0
                                              ? 'text-red-600'
                                              : 'text-emerald-700',
                                    )}
                                >
                                    {row.profit_centavos === null
                                        ? '—'
                                        : formatPeso(row.profit_centavos)}
                                </td>
                                <td className="px-5 py-4 text-right">
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            view(row.product_id);
                                        }}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 text-sm font-black whitespace-nowrap text-blue-700 transition hover:bg-blue-100"
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
            <Pagination pagination={rows} itemName="products" />
        </>
    );
}

/** 2 and 3. Each item sold at each price: Cost, Price, Profit. */
/**
 * 2. Sales: one row per product, all its sizes, colors and prices
 * together, with its eStore price now. View Details shows each size or
 * color, and what Head Office charged on each eStore order of it.
 */
function SoldTable({
    rows,
    details,
    onlyBelowCost,
    search,
}: {
    rows: Paginated<SoldProduct>;
    details: SoldDetails | null | undefined;
    onlyBelowCost: boolean;
    /** The search typed, for the empty message. */
    search: string | null;
}) {
    const [viewingId, setViewingId] = useState<number | null>(null);

    if (rows.data.length === 0) {
        return (
            <Empty
                icon={TrendingUp}
                text={
                    search
                        ? `No sold product matches "${search}"`
                        : onlyBelowCost
                          ? 'No sales below cost in this period'
                          : 'Nothing sold in this period'
                }
            />
        );
    }

    const view = (productId: number) => {
        setViewingId(productId);
        router.reload({ data: { details: productId }, only: ['sold_details'] });
    };

    return (
        <>
            <SoldDetailsDialog
                open={viewingId !== null}
                // Another product's details (from before) count as loading.
                details={
                    details === null || details?.product_id === viewingId
                        ? details
                        : undefined
                }
                onClose={() => setViewingId(null)}
            />
            <TableScroll>
                <table className="w-full min-w-260">
                    <thead className="bg-slate-50">
                        <tr>
                            <TableHeading>Product</TableHeading>
                            <TableHeading align="right">
                                eStore Cost
                            </TableHeading>
                            <TableHeading align="right">
                                Selling Price
                            </TableHeading>
                            <TableHeading align="right">Qty Sold</TableHeading>
                            <TableHeading align="right">
                                Total Sales
                            </TableHeading>
                            <TableHeading align="right">
                                Total Cost
                            </TableHeading>
                            <TableHeading align="right">
                                Gross Profit
                            </TableHeading>
                            <TableHeading align="right">
                                <span className="sr-only">Actions</span>
                            </TableHeading>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.data.map((row) => (
                            <SoldProductRow
                                key={row.product_id}
                                row={row}
                                onView={() => view(row.product_id)}
                            />
                        ))}
                    </tbody>
                </table>
            </TableScroll>
            <Pagination pagination={rows} itemName="products" />
        </>
    );
}

function SoldProductRow({
    row,
    onView,
}: {
    row: SoldProduct;
    onView: () => void;
}) {
    return (
        <tr
            onClick={onView}
            className={cn(
                'cursor-pointer border-t border-slate-100 align-top text-sm transition hover:bg-slate-50',
                row.below_cost && 'bg-red-50/60 hover:bg-red-50',
            )}
        >
            <td className="min-w-52 px-5 py-4">
                <p className="font-black text-slate-900">{row.product_name}</p>
                <p className="text-xs text-slate-500">
                    {row.variants_count === 1
                        ? '1 variant'
                        : `${row.variants_count} variants`}
                    {row.item_code && (
                        <span className="font-mono font-black text-blue-700">
                            {' '}
                            · {row.item_code}
                        </span>
                    )}
                </p>
                {row.below_cost && (
                    <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-black text-red-700">
                        <TrendingDown size={12} />
                        Below cost · loss {formatPeso(row.loss_centavos)}
                    </p>
                )}
            </td>
            <td className="px-5 py-4 text-right">
                {row.estore_unit_price_centavos === null ? (
                    <span className="text-xs text-slate-400">
                        Not on an eStore order yet
                    </span>
                ) : (
                    <>
                        <p className="font-black whitespace-nowrap text-slate-900">
                            {formatPeso(row.estore_unit_price_centavos)}
                            <span className="font-semibold text-slate-500">
                                {' '}
                                {perUnit(
                                    row.estore_unit_name,
                                    row.estore_pieces_per_unit,
                                )}
                            </span>
                        </p>
                        {row.estore_pieces_per_unit > 1 &&
                            row.estore_cost_per_piece_centavos !== null && (
                                <p className="text-xs font-bold whitespace-nowrap text-slate-700">
                                    ={' '}
                                    {formatPeso(
                                        row.estore_cost_per_piece_centavos,
                                    )}{' '}
                                    per piece
                                </p>
                            )}
                        <p>
                            <PriceChange
                                current={row.estore_unit_price_centavos}
                                change={row.estore_change_centavos}
                            />
                        </p>
                    </>
                )}
            </td>
            <td className="px-5 py-4 text-right whitespace-nowrap">
                <span className="font-black text-slate-900">
                    {priceRange(row.price_from_centavos, row.price_to_centavos)}
                </span>
                <span className="text-slate-500"> / pc</span>
                {row.lower_price_labels.length > 0 && (
                    <span className="block text-[11px] font-black text-red-600">
                        Includes{' '}
                        {row.lower_price_labels
                            .map((label) =>
                                label === 'On sale'
                                    ? 'sale price'
                                    : label.toLowerCase(),
                            )
                            .join(', ')}
                    </span>
                )}
            </td>
            <td className="px-5 py-4 text-right font-bold whitespace-nowrap text-slate-700">
                {formatUnits(row.pieces, 'Piece')}
            </td>
            <td className="px-5 py-4 text-right font-black whitespace-nowrap text-slate-900">
                {formatPeso(row.price_total_centavos)}
            </td>
            <td className="px-5 py-4 text-right whitespace-nowrap text-slate-700">
                {row.cost_total_centavos === null
                    ? '—'
                    : formatPeso(row.cost_total_centavos)}
            </td>
            <td
                className={cn(
                    'px-5 py-4 text-right text-base font-black whitespace-nowrap',
                    row.profit_centavos === null
                        ? 'text-slate-300'
                        : row.profit_centavos < 0
                          ? 'text-red-600'
                          : 'text-emerald-700',
                )}
            >
                {row.profit_centavos === null
                    ? '—'
                    : formatPeso(row.profit_centavos)}
            </td>
            <td className="px-5 py-4 text-right">
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onView();
                    }}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 text-sm font-black whitespace-nowrap text-blue-700 transition hover:bg-blue-100"
                >
                    <Eye size={15} />
                    View Details
                </button>
            </td>
        </tr>
    );
}
/** One size or color at one price, in a product's View Details. */
function SoldTableRow({ row }: { row: SoldRow }) {
    const unit = row.pieces_per_unit > 1 ? row.unit_name.toLowerCase() : 'pc';

    return (
        <tr
            className={cn(
                'border-t border-slate-100 align-top text-sm',
                row.below_cost && 'bg-red-50/60',
            )}
        >
            <td className="px-5 py-4">
                <p className="font-black text-slate-900">
                    {row.variant_label ?? 'One size'}
                </p>
                <p className="text-xs text-slate-500">
                    {row.pieces_per_unit > 1
                        ? `${row.unit_name} of ${row.pieces_per_unit}`
                        : 'By the piece'}
                </p>
                {row.below_cost && (
                    <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-black text-red-700">
                        <TrendingDown size={12} />
                        Below cost · loss {formatPeso(row.loss_centavos)}
                    </p>
                )}
            </td>
            <td className="px-5 py-4 text-right whitespace-nowrap">
                {row.cost_each_centavos === null ? (
                    <span className="text-slate-300">—</span>
                ) : (
                    <Each value={row.cost_each_centavos} unit={unit} />
                )}
            </td>
            <td className="px-5 py-4 text-right whitespace-nowrap">
                {row.normal_each_centavos !== null && (
                    <span className="mr-1.5 text-xs text-slate-400 line-through">
                        {formatPeso(row.normal_each_centavos)}
                    </span>
                )}
                <Each
                    value={row.price_each_centavos}
                    unit={unit}
                    className={
                        row.normal_each_centavos !== null
                            ? 'text-red-600'
                            : undefined
                    }
                />
                {row.normal_each_centavos !== null && (
                    <span className="block text-[11px] font-black text-red-600">
                        {row.lower_price_label ?? 'On sale'} ·{' '}
                        {formatPeso(
                            row.normal_each_centavos - row.price_each_centavos,
                        )}{' '}
                        less each
                    </span>
                )}
            </td>
            <td className="px-5 py-4 text-right font-bold whitespace-nowrap text-slate-700">
                {formatUnits(row.quantity, row.unit_name)}
            </td>
            <td className="px-5 py-4 text-right font-black whitespace-nowrap text-slate-900">
                {formatPeso(row.price_total_centavos)}
            </td>
            <td className="px-5 py-4 text-right whitespace-nowrap text-slate-700">
                {row.cost_total_centavos === null
                    ? '—'
                    : formatPeso(row.cost_total_centavos)}
            </td>
            <td
                className={cn(
                    'px-5 py-4 text-right text-base font-black whitespace-nowrap',
                    row.profit_centavos === null
                        ? 'text-slate-300'
                        : row.profit_centavos < 0
                          ? 'text-red-600'
                          : 'text-emerald-700',
                )}
            >
                {row.profit_centavos === null
                    ? '—'
                    : formatPeso(row.profit_centavos)}
            </td>
        </tr>
    );
}

function Each({
    value,
    unit,
    className,
}: {
    value: number;
    unit: string;
    className?: string;
}): ReactNode {
    return (
        <span className={cn('font-black text-slate-900', className)}>
            {formatPeso(value)}
            <span className="font-normal text-slate-500"> / {unit}</span>
        </span>
    );
}

/**
 * 4. Free uniforms given (promo), one row per Free Uniforms group: its
 * students, sets, pieces and what they were worth. View Details shows each
 * student with their sizes. Pieces given one by one before there were
 * groups are one row per day.
 */
function FreeTable({
    rows,
    groupDetails,
}: {
    rows: Paginated<FreeRow>;
    groupDetails: FreeUniformGroupDetails | null | undefined;
}) {
    const [viewingGroupId, setViewingGroupId] = useState<number | null>(null);
    const [viewingDay, setViewingDay] = useState<FreeRow | null>(null);

    if (rows.data.length === 0) {
        return (
            <div className="px-6 py-16 text-center">
                <Gift size={44} className="mx-auto text-slate-300" />
                <p className="mt-4 text-lg font-black text-slate-800">
                    No free uniforms given in this period
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                    Free uniforms are recorded by group on the Free Uniforms
                    page.
                </p>
            </div>
        );
    }

    const view = (row: FreeRow) => {
        if (row.group_id === null) {
            setViewingDay(row);

            return;
        }

        setViewingGroupId(row.group_id);
        router.reload({
            data: { free_group: row.group_id },
            only: ['free_group'],
        });
    };

    return (
        <>
            <FreeUniformGroupDialog
                open={viewingGroupId !== null}
                // Another group's details (from before) count as loading.
                details={
                    groupDetails === null || groupDetails?.id === viewingGroupId
                        ? groupDetails
                        : undefined
                }
                onClose={() => setViewingGroupId(null)}
                // A report shows the group only: giving is on the Free Uniforms page.
                readOnly
            />
            <FreePiecesDialog
                row={viewingDay}
                onClose={() => setViewingDay(null)}
            />
            <div className="border-b border-slate-100 px-6 py-3">
                <p className="text-xs text-slate-500">
                    Newest first. Value at Cost is what the pieces cost on their
                    eStore orders; Value at Selling Price uses today&apos;s
                    selling price.
                </p>
            </div>
            <TableScroll>
                <table className="w-full min-w-240">
                    <thead className="bg-slate-50">
                        <tr>
                            <TableHeading>Group</TableHeading>
                            <TableHeading>Recipients</TableHeading>
                            <TableHeading align="right">Qty Given</TableHeading>
                            <TableHeading align="right">
                                Value at Cost
                            </TableHeading>
                            <TableHeading align="right">
                                Value at Selling Price
                            </TableHeading>
                            <TableHeading align="right">
                                <span className="sr-only">Actions</span>
                            </TableHeading>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.data.map((row) => (
                            <tr
                                key={row.key}
                                onClick={() => view(row)}
                                className="cursor-pointer border-t border-slate-100 align-top text-sm transition hover:bg-slate-50"
                            >
                                <td className="px-5 py-4 whitespace-nowrap">
                                    <p className="font-black text-slate-900">
                                        {row.group_id === null
                                            ? 'Not in a group'
                                            : `Group #${row.group_id}`}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {formatDateTime(row.given_at)}
                                    </p>
                                    {row.given_by && (
                                        <p className="text-xs text-slate-500">
                                            by {row.given_by}
                                        </p>
                                    )}
                                </td>
                                <td className="px-5 py-4">
                                    <p className="font-bold text-slate-800">
                                        {row.students_count}{' '}
                                        {row.students_count === 1
                                            ? 'student'
                                            : 'students'}
                                        {row.sets && (
                                            <span className="font-semibold text-slate-500">
                                                {' '}
                                                · {row.sets}
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {row.names.join(', ')}
                                        {row.more_names > 0 &&
                                            ` +${row.more_names} more`}
                                    </p>
                                </td>
                                <td className="px-5 py-4 text-right whitespace-nowrap">
                                    <p className="font-black text-slate-800">
                                        {formatUnits(row.pieces, 'Piece')}
                                    </p>
                                    {row.still_to_give > 0 && (
                                        <p className="text-xs font-bold text-amber-700">
                                            {row.still_to_give} pending
                                        </p>
                                    )}
                                </td>
                                <td className="px-5 py-4 text-right whitespace-nowrap">
                                    <p className="font-black text-slate-900">
                                        {formatPeso(row.cost_centavos)}
                                    </p>
                                    {row.missing_cost_pieces > 0 && (
                                        <p className="text-xs font-bold text-amber-700">
                                            {row.missing_cost_pieces} without a
                                            Cost
                                        </p>
                                    )}
                                </td>
                                <td className="px-5 py-4 text-right whitespace-nowrap text-slate-700">
                                    {formatPeso(row.price_centavos)}
                                </td>
                                <td className="px-5 py-4 text-right">
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            view(row);
                                        }}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 text-sm font-black whitespace-nowrap text-blue-700 transition hover:bg-blue-100"
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
            <Pagination pagination={rows} itemName="groups" />
        </>
    );
}

/**
 * A day of pieces given one by one (before there were groups): each piece
 * with who received it and what it was worth.
 */
function FreePiecesDialog({
    row,
    onClose,
}: {
    row: FreeRow | null;
    onClose: () => void;
}) {
    return (
        <Dialog
            open={row !== null}
            onOpenChange={(isOpen) => !isOpen && onClose()}
        >
            <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-4xl">
                <div className="border-b border-slate-100 px-6 py-5">
                    <DialogTitle className="text-lg font-black text-slate-900">
                        Free Uniforms · not in a group
                    </DialogTitle>
                    <DialogDescription className="text-sm text-slate-500">
                        {row && formatDateOrdered(row.given_at.slice(0, 10))} ·
                        given one by one, before there were groups
                    </DialogDescription>
                </div>
                <div className="overflow-y-auto px-6 py-4">
                    <TableScroll>
                        <table className="w-full min-w-180 text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <TableHeading>Recipient</TableHeading>
                                    <TableHeading>Product</TableHeading>
                                    <TableHeading align="right">
                                        Qty Given
                                    </TableHeading>
                                    <TableHeading align="right">
                                        Value at Cost
                                    </TableHeading>
                                    <TableHeading align="right">
                                        Value at Selling Price
                                    </TableHeading>
                                </tr>
                            </thead>
                            <tbody>
                                {row?.items.map((item) => (
                                    <tr
                                        key={item.id}
                                        className="border-t border-slate-100 align-top"
                                    >
                                        <td className="px-5 py-3">
                                            <p className="font-bold text-slate-800">
                                                {item.recipient_name}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                Enrollment form #
                                                {item.enrollment_form_number}
                                            </p>
                                        </td>
                                        <td className="px-5 py-3">
                                            <p className="font-black text-slate-900">
                                                {item.product_name}
                                            </p>
                                            {item.variant_label && (
                                                <p className="text-xs text-slate-500">
                                                    {item.variant_label}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-right font-bold text-slate-700">
                                            {formatUnits(item.pieces, 'Piece')}
                                        </td>
                                        <td className="px-5 py-3 text-right font-black whitespace-nowrap text-slate-900">
                                            {item.cost_centavos === null ? (
                                                <span className="text-xs font-bold text-amber-700">
                                                    Cost not set
                                                </span>
                                            ) : (
                                                formatPeso(item.cost_centavos)
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-right whitespace-nowrap text-slate-700">
                                            {formatPeso(item.price_centavos)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </TableScroll>
                </div>
                <footer className="flex justify-end border-t border-slate-200 bg-slate-50/60 px-6 py-3">
                    <DialogClose className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50">
                        Close
                    </DialogClose>
                </footer>
            </DialogContent>
        </Dialog>
    );
}

/** "per piece", or "per Pack (10 pcs)" for an item Head Office sends in packs. */
function perUnit(unitName: string, piecesPerUnit: number): string {
    return piecesPerUnit > 1
        ? `per ${unitName} (${piecesPerUnit} pcs)`
        : 'per piece';
}

/** "₱450.00", or "₱450.00 – ₱480.00" when sizes have different prices. */
function priceRange(from: number | null, to: number | null): string {
    if (from === null || to === null) {
        return 'No price';
    }

    return from === to
        ? formatPeso(from)
        : `${formatPeso(from)} – ${formatPeso(to)}`;
}

/**
 * How Head Office's price moved from the order before, in plain words:
 * "₱620.00 → ₱650.00", dearer in red, cheaper in green.
 */
function PriceChange({
    current,
    change,
}: {
    current: number;
    /** Up or down from the order before; null on the first order. */
    change: number | null;
}) {
    if (change === null) {
        return (
            <span className="text-xs text-slate-400">First eStore order</span>
        );
    }

    if (change === 0) {
        return (
            <span className="text-xs font-semibold text-slate-500">
                No change
            </span>
        );
    }

    return (
        <span
            className={cn(
                'text-xs font-black whitespace-nowrap',
                change > 0 ? 'text-red-700' : 'text-emerald-700',
            )}
        >
            {formatPeso(current - change)} → {formatPeso(current)}
        </span>
    );
}
/**
 * A product's View Details on Sales: each size or color at each
 * price it sold for (with Set cost when a Cost is missing), and what Head
 * Office charged on each eStore order of it (its Unit Price, up or down).
 */
function SoldDetailsDialog({
    open,
    details,
    onClose,
}: {
    open: boolean;
    /** Undefined while it loads. */
    details: SoldDetails | null | undefined;
    onClose: () => void;
}) {
    const sectionTitle =
        'text-sm font-black tracking-wide text-slate-700 uppercase';

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-5xl">
                {!details ? (
                    <div className="flex flex-col items-center gap-3 px-6 py-16 text-sm font-bold text-slate-500">
                        <DialogTitle className="sr-only">
                            Product details
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            Loading
                        </DialogDescription>
                        {details === null ? (
                            'Nothing of this product was sold in this period.'
                        ) : (
                            <>
                                <LoaderCircle
                                    size={28}
                                    className="animate-spin text-blue-600"
                                />
                                Loading…
                            </>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="border-b border-slate-100 px-6 py-5">
                            <DialogTitle className="text-lg font-black text-slate-900">
                                {details.product_name}
                            </DialogTitle>
                            <DialogDescription className="text-sm text-slate-500">
                                {details.estore?.item_code ?? 'No Item Code'} ·{' '}
                                {formatUnits(
                                    details.variants.reduce(
                                        (sum, variant) =>
                                            sum +
                                            variant.quantity *
                                                variant.pieces_per_unit,
                                        0,
                                    ),
                                    'Piece',
                                )}{' '}
                                sold ·{' '}
                                {formatPeso(
                                    details.variants.reduce(
                                        (sum, variant) =>
                                            sum + variant.price_total_centavos,
                                        0,
                                    ),
                                )}
                            </DialogDescription>
                        </div>
                        <div className="space-y-6 overflow-y-auto px-6 py-5">
                            <section className="space-y-2">
                                <h3 className={sectionTitle}>Variants Sold</h3>
                                <TableScroll>
                                    <table className="w-full min-w-240">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <TableHeading>
                                                    Variant
                                                </TableHeading>
                                                <TableHeading align="right">
                                                    Unit Cost
                                                </TableHeading>
                                                <TableHeading align="right">
                                                    Selling Price
                                                </TableHeading>
                                                <TableHeading align="right">
                                                    Qty Sold
                                                </TableHeading>
                                                <TableHeading align="right">
                                                    Total Sales
                                                </TableHeading>
                                                <TableHeading align="right">
                                                    Total Cost
                                                </TableHeading>
                                                <TableHeading align="right">
                                                    Gross Profit
                                                </TableHeading>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {details.variants.map((row) => (
                                                <SoldTableRow
                                                    key={row.key}
                                                    row={row}
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                </TableScroll>
                            </section>

                            <section className="space-y-2">
                                <h3 className={sectionTitle}>
                                    eStore Cost History (newest first)
                                </h3>
                                {!details.estore ||
                                details.estore.orders.length === 0 ? (
                                    <p className="rounded-2xl bg-slate-50 py-8 text-center text-sm font-bold text-slate-500">
                                        Not on an eStore order yet.
                                    </p>
                                ) : (
                                    <EstoreOrders history={details.estore} />
                                )}
                            </section>
                        </div>
                        <footer className="flex justify-end border-t border-slate-200 bg-slate-50/60 px-6 py-3">
                            <DialogClose className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50">
                                Close
                            </DialogClose>
                        </footer>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

/**
 * A product's eStore orders, newest first: the Unit Price on each, the
 * Cost per piece, and how much it went up or down from the order before.
 */
function EstoreOrders({ history }: { history: PriceHistory }) {
    return (
        <TableScroll>
            <table className="w-full min-w-180 text-sm">
                <thead className="bg-slate-50">
                    <tr>
                        <TableHeading>PO</TableHeading>
                        <TableHeading align="right">Qty ordered</TableHeading>
                        <TableHeading align="right">Unit Price</TableHeading>
                        <TableHeading align="right">
                            Cost per piece
                        </TableHeading>
                        <TableHeading align="right">Change</TableHeading>
                    </tr>
                </thead>
                <tbody>
                    {history.orders.map((order) => (
                        <tr
                            key={order.purchase_order_id}
                            className="border-t border-slate-100"
                        >
                            <td className="px-5 py-3">
                                <p className="font-mono font-black text-blue-700">
                                    #{order.order_number ?? '—'}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {formatDateOrdered(order.date_ordered)}
                                </p>
                            </td>
                            <td className="px-5 py-3 text-right text-slate-700">
                                {formatUnits(
                                    order.quantity_ordered,
                                    history.unit_name,
                                )}
                            </td>
                            <td className="px-5 py-3 text-right font-black text-slate-900">
                                {formatPeso(order.unit_price_centavos)}
                            </td>
                            <td className="px-5 py-3 text-right text-slate-700">
                                {formatPeso(order.cost_per_piece_centavos)}
                            </td>
                            <td className="px-5 py-3 text-right whitespace-nowrap">
                                <PriceChange
                                    current={order.unit_price_centavos}
                                    change={order.change_centavos}
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </TableScroll>
    );
}
