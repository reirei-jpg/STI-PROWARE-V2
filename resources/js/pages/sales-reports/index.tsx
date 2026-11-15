import { Head, router, useForm, usePage } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
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
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import SalesReportController from '@/actions/App/Http/Controllers/SalesReportController';
import DateRangeFilter from '@/components/date-range-filter';
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
import { formatDateOrdered, formatDateTime, formatPeso } from '@/lib/format';
import { priceInput } from '@/lib/number-input';
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
    { value: 'all', label: 'All time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This week' },
    { value: 'month', label: 'This month' },
    { value: 'custom', label: 'Pick dates' },
];

const tabs: { value: SalesTab; label: string }[] = [
    { value: 'spent', label: 'What we spent' },
    { value: 'sold', label: 'What we sold' },
    { value: 'best', label: 'Best sellers' },
    { value: 'free', label: 'Given free' },
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
    /** The group opened with View Details on Given free; undefined until loaded. */
    free_group?: FreeUniformGroupDetails | null;
    /** The product opened with View Details on What we sold; undefined until loaded. */
    sold_details?: SoldDetails | null;
    filters: SalesReportFilters;
}) {
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const [search, setSearch] = useState(filters.search ?? '');
    const [pickingDates, setPickingDates] = useState(
        filters.period === 'custom',
    );
    // The dates picked so far: the report loads once both are picked, so
    // the first one must stay in its box while the second is chosen.
    const [pickedFrom, setPickedFrom] = useState<string | null>(
        filters.period === 'custom' ? filters.date_from : null,
    );
    const [pickedTo, setPickedTo] = useState<string | null>(
        filters.period === 'custom' ? filters.date_to : null,
    );
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
                    description="What we spent on eStore orders, what we sold and the profit with our prices beside the eStore prices, our best sellers, what we sold below cost, and what free uniforms were worth."
                />

                <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        {periods.map((period) => {
                            const chosen =
                                period.value === 'custom'
                                    ? pickingDates
                                    : !pickingDates &&
                                      filters.period === period.value;

                            return (
                                <button
                                    key={period.value}
                                    type="button"
                                    onClick={() => {
                                        if (period.value === 'custom') {
                                            setPickingDates(true);

                                            return;
                                        }

                                        setPickingDates(false);
                                        show({ period: period.value });
                                    }}
                                    className={cn(
                                        'rounded-xl px-4 py-2.5 text-sm font-black transition',
                                        chosen
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                                    )}
                                >
                                    {period.label}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-base font-black text-slate-900">
                        {periodText}
                    </p>
                </section>

                {pickingDates && (
                    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <DateRangeFilter
                            label="From / To"
                            dateFrom={pickedFrom}
                            dateTo={pickedTo}
                            serverError={errors.date_from ?? errors.date_to}
                            onChange={(dateFrom, dateTo) => {
                                setPickedFrom(dateFrom);
                                setPickedTo(dateTo);

                                // Clear filters goes back to All time.
                                if (!dateFrom && !dateTo) {
                                    setPickingDates(false);
                                    show({ period: 'all' });

                                    return;
                                }

                                if (dateFrom && dateTo) {
                                    show({
                                        period: 'custom',
                                        date_from: dateFrom,
                                        date_to: dateTo,
                                    });
                                }
                            }}
                        />
                    </section>
                )}

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
                        label="Spent on eStore orders"
                        value={formatPeso(summary.spent_centavos)}
                        detail={`${summary.purchase_orders} eStore ${summary.purchase_orders === 1 ? 'order' : 'orders'} · by Date Ordered${summary.spent_for_preorders_centavos > 0 ? ` · Preorders ${formatPeso(summary.spent_for_preorders_centavos)}` : ''}`}
                        onClick={() => show({ tab: 'spent' })}
                    />
                    <Card
                        icon={
                            summary.profit_centavos < 0
                                ? TrendingDown
                                : TrendingUp
                        }
                        tone={summary.profit_centavos < 0 ? 'red' : 'green'}
                        label="Profit"
                        value={formatPeso(summary.profit_centavos)}
                        detail={`Price ${formatPeso(summary.costed_price_centavos)} − Cost ${formatPeso(summary.cost_centavos)}`}
                        note={
                            summary.missing_cost_lines > 0
                                ? `${summary.missing_cost_lines} ${summary.missing_cost_lines === 1 ? 'sale' : 'sales'} with no Cost yet (${formatPeso(summary.price_centavos - summary.costed_price_centavos)}) not counted`
                                : undefined
                        }
                        onClick={() => show({ tab: 'sold' })}
                    />
                    {/* A price set before a dearer eStore order arrived can still sell below Cost. */}
                    {summary.below_cost_lines > 0 && (
                        <Card
                            icon={Tag}
                            tone="red"
                            label="Lost on sales below cost"
                            value={formatPeso(summary.below_cost_loss_centavos)}
                            detail={`${summary.below_cost_lines} ${summary.below_cost_lines === 1 ? 'sale' : 'sales'} where the Price was lower than the Cost`}
                            onClick={() => show({ tab: 'sold' })}
                        />
                    )}
                    <Card
                        icon={Gift}
                        tone="amber"
                        label="Given free"
                        value={formatPeso(summary.free_cost_centavos)}
                        detail={`${formatUnits(summary.free_pieces, 'Piece')} at Cost · ${formatPeso(summary.free_price_centavos)} at Price`}
                        onClick={() => show({ tab: 'free' })}
                    />
                </section>

                <Panel>
                    <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.value}
                                    type="button"
                                    onClick={() => show({ tab: tab.value })}
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
                        {filters.tab === 'sold' && (
                            <div className="flex flex-col gap-2 sm:flex-row">
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
                                    Excel (CSV)
                                </a>
                            </div>
                        )}
                    </div>

                    {spent && <SpentTable rows={spent} />}
                    {sold && (
                        <>
                            <div className="border-b border-slate-100 px-6 py-3">
                                <p className="text-xs text-slate-500">
                                    One row per product, all its sizes and
                                    colors. eStore price: its latest eStore
                                    order.
                                </p>
                            </div>
                            <SoldTable rows={sold} details={sold_details} />
                        </>
                    )}
                    {best && <BestSellersTable rows={best} />}
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
 * 1. The uploaded eStore orders of the period: what was bought, whether it
 * arrived, how much was for buyers' preorders and what it cost. A click
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
                            <TableHeading align="right">Preorders</TableHeading>
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
                                <td className="px-5 py-4 text-right whitespace-nowrap">
                                    {row.preorder_quantity === null ? (
                                        <span
                                            className="font-black text-slate-300"
                                            title="Ordered before preorders were counted"
                                        >
                                            —
                                        </span>
                                    ) : (
                                        <span
                                            className={cn(
                                                'font-black',
                                                row.preorder_quantity > 0
                                                    ? 'text-blue-700'
                                                    : 'text-slate-400',
                                            )}
                                        >
                                            {row.preorder_quantity.toLocaleString(
                                                'en-PH',
                                            )}
                                            <span className="font-semibold text-slate-500">
                                                {' '}
                                                of{' '}
                                                {row.quantity_ordered.toLocaleString(
                                                    'en-PH',
                                                )}
                                            </span>
                                        </span>
                                    )}
                                </td>
                                <td className="px-5 py-4 text-right text-base font-black text-slate-900">
                                    {formatPeso(row.total_centavos)}
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
            {rows.data.some((row) => row.preorder_quantity === null) && (
                <p className="border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
                    Preorders "—": ordered before preorders were counted.
                </p>
            )}
            <Pagination pagination={rows} itemName="orders" />
        </>
    );
}

/**
 * The best sellers: products ranked by pieces sold in the period (all sizes,
 * colors and prices together), with their sales, profit and top size.
 */
function BestSellersTable({ rows }: { rows: Paginated<BestSellerRow> }) {
    if (rows.data.length === 0) {
        return <Empty icon={Trophy} text="Nothing sold in this period" />;
    }

    return (
        <>
            <TableScroll>
                <table className="w-full min-w-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <TableHeading>Rank</TableHeading>
                            <TableHeading>Item</TableHeading>
                            <TableHeading align="right">
                                Pieces Sold
                            </TableHeading>
                            <TableHeading>Sold the Most</TableHeading>
                            <TableHeading align="right">
                                Total Price
                            </TableHeading>
                            <TableHeading align="right">Profit</TableHeading>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.data.map((row) => (
                            <tr
                                key={row.product_id}
                                className="border-t border-slate-100 text-sm"
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
                                        ? '—'
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
                                        ? 'No Cost yet'
                                        : formatPeso(row.profit_centavos)}
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
 * 2. What we sold: one row per product, all its sizes, colors and prices
 * together, with its eStore price now. View Details shows each size or
 * color, and what Head Office charged on each eStore order of it.
 */
function SoldTable({
    rows,
    details,
}: {
    rows: Paginated<SoldProduct>;
    details: SoldDetails | null | undefined;
}) {
    const [viewingId, setViewingId] = useState<number | null>(null);

    if (rows.data.length === 0) {
        return <Empty icon={TrendingUp} text="Nothing sold in this period" />;
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
                onReload={() => viewingId !== null && view(viewingId)}
                onClose={() => setViewingId(null)}
            />
            <TableScroll>
                <table className="w-full min-w-260">
                    <thead className="bg-slate-50">
                        <tr>
                            <TableHeading>Product</TableHeading>
                            <TableHeading align="right">
                                eStore price
                            </TableHeading>
                            <TableHeading align="right">
                                Selling price
                            </TableHeading>
                            <TableHeading align="right">Sold</TableHeading>
                            <TableHeading align="right">
                                Total Price
                            </TableHeading>
                            <TableHeading align="right">
                                Total Cost
                            </TableHeading>
                            <TableHeading align="right">Profit</TableHeading>
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
                        ? '1 size or color'
                        : `${row.variants_count} sizes or colors`}
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
                        Sold below cost · lost {formatPeso(row.loss_centavos)}
                    </p>
                )}
                {row.missing_cost_lines > 0 && (
                    <p className="mt-1 text-[11px] font-black text-amber-700">
                        Cost not set for some · open View Details
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
                        Some {row.lower_price_labels.join(', ').toLowerCase()}
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
function SoldTableRow({
    row,
    onCostSaved,
}: {
    row: SoldRow;
    onCostSaved: () => void;
}) {
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
                        Sold below cost · lost {formatPeso(row.loss_centavos)}
                    </p>
                )}
            </td>
            <td className="px-5 py-4 text-right whitespace-nowrap">
                {row.cost_each_centavos === null ? (
                    <SetCost row={row} onSaved={onCostSaved} />
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

/** A sale whose Cost is not set: enter the Cost per piece right here. */
function SetCost({ row, onSaved }: { row: SoldRow; onSaved: () => void }) {
    const form = useForm({ unit_cost: '' });
    const [open, setOpen] = useState(false);

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800 transition hover:bg-amber-100"
            >
                Not set · Set cost
            </button>
        );
    }

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.post(SalesReportController.setPrice(row.variant_id).url, {
                    preserveScroll: true,
                    preserveState: true,
                    onSuccess: onSaved,
                });
            }}
            className="ml-auto flex max-w-48 flex-col items-end gap-1"
        >
            <span className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500">₱</span>
                <input
                    value={form.data.unit_cost}
                    onChange={(event) =>
                        form.setData(
                            'unit_cost',
                            priceInput(event.target.value),
                        )
                    }
                    inputMode="decimal"
                    placeholder="per piece"
                    autoFocus
                    aria-label={`Cost per piece of ${row.product_name}`}
                    className="h-9 w-24 rounded-lg border border-slate-200 bg-white px-2 text-right text-sm font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                <button
                    type="submit"
                    disabled={
                        form.processing || !(Number(form.data.unit_cost) > 0)
                    }
                    className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#0D6EFD] px-3 text-xs font-black text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                    {form.processing && (
                        <LoaderCircle size={13} className="animate-spin" />
                    )}
                    Save
                </button>
            </span>
            <InputError message={form.errors.unit_cost} />
        </form>
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
            />
            <FreePiecesDialog
                row={viewingDay}
                onClose={() => setViewingDay(null)}
            />
            <TableScroll>
                <table className="w-full min-w-240">
                    <thead className="bg-slate-50">
                        <tr>
                            <TableHeading>Group</TableHeading>
                            <TableHeading>Given to</TableHeading>
                            <TableHeading align="right">Pieces</TableHeading>
                            <TableHeading align="right">
                                Worth at Cost
                            </TableHeading>
                            <TableHeading align="right">
                                Worth at Price
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
                                            {row.still_to_give} still to give
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
                        Given free · not in a group
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
                                    <TableHeading>Given to</TableHeading>
                                    <TableHeading>Item</TableHeading>
                                    <TableHeading align="right">
                                        Qty
                                    </TableHeading>
                                    <TableHeading align="right">
                                        Worth at Cost
                                    </TableHeading>
                                    <TableHeading align="right">
                                        Worth at Price
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
        return <span className="text-xs text-slate-400">First order</span>;
    }

    if (change === 0) {
        return (
            <span className="text-xs font-semibold text-slate-500">
                Same price as before
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
 * A product's View Details on What we sold: each size or color at each
 * price it sold for (with Set cost when a Cost is missing), and what Head
 * Office charged on each eStore order of it (its Unit Price, up or down).
 */
function SoldDetailsDialog({
    open,
    details,
    onReload,
    onClose,
}: {
    open: boolean;
    /** Undefined while it loads. */
    details: SoldDetails | null | undefined;
    onReload: () => void;
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
                                {details.estore?.item_code ??
                                    'No eStore Item Code'}{' '}
                                ·{' '}
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
                                <h3 className={sectionTitle}>
                                    Sizes and colors sold
                                </h3>
                                <TableScroll>
                                    <table className="w-full min-w-240">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <TableHeading>
                                                    Size / Color
                                                </TableHeading>
                                                <TableHeading align="right">
                                                    Cost
                                                </TableHeading>
                                                <TableHeading align="right">
                                                    Price
                                                </TableHeading>
                                                <TableHeading align="right">
                                                    Sold
                                                </TableHeading>
                                                <TableHeading align="right">
                                                    Total Price
                                                </TableHeading>
                                                <TableHeading align="right">
                                                    Total Cost
                                                </TableHeading>
                                                <TableHeading align="right">
                                                    Profit
                                                </TableHeading>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {details.variants.map((row) => (
                                                <SoldTableRow
                                                    key={row.key}
                                                    row={row}
                                                    onCostSaved={onReload}
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                </TableScroll>
                            </section>

                            <section className="space-y-2">
                                <h3 className={sectionTitle}>
                                    What Head Office charged us (eStore) ·
                                    newest first
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
