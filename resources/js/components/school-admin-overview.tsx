import { Head, router, usePage } from '@inertiajs/react';
import { CircleAlert, Eye, Search, SearchX, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import Panel from '@/components/panel';
import PurchaseOrderDetailsDialog from '@/components/purchase-order-details-dialog';
import RemindSpecialist from '@/components/remind-specialist';
import { formatDateOrdered, formatDateTime, formatPeso } from '@/lib/format';
import { cn, isSameSearch } from '@/lib/utils';
import { dashboard } from '@/routes';
import type { DeliveryStatus, Paginated } from '@/types';

export type AdminDeliveryTab = 'coming' | 'ongoing' | 'completed';

/** One eStore order on the School Admin's Deliveries list. */
export type AdminDeliveryRow = {
    id: number;
    order_number: string | null;
    category: string | null;
    date_ordered: string;
    days_since_ordered: number;
    items_count: number;
    uploaded_at: string | null;
    last_delivery_at: string | null;
    /** When the last pieces arrived, or when it was closed with some missing. */
    completed_at: string | null;
    completed_after_days: number | null;
    status: DeliveryStatus;
    status_label: string;
    percent_received: number;
    quantity_ordered: number;
    quantity_received: number;
    /** Not complete after the days set in Maintenance. */
    is_late: boolean;
    reminded_at: string | null;
    reminded_by: string | null;
    can_remind: boolean;
    remind_again_on: string | null;
};

export type SchoolAdminOverviewData = {
    deliveries: {
        tab: AdminDeliveryTab;
        /** The Order # searched for; the counts follow it too. */
        search: string | null;
        late_days: number;
        counts: Record<
            AdminDeliveryTab | 'coming_late' | 'ongoing_late',
            number
        >;
        orders: Paginated<AdminDeliveryRow>;
    };
    sales: {
        period: SalesPeriod;
        from: string;
        to: string;
        /** The numbers at the top of the Sales box. */
        totals: {
            pieces: number;
            price_centavos: number;
            best: TopSeller | null;
            not_selling_pieces: number;
        };
        /** The Specialist's Best sellers for the period, most pieces first. */
        top_sellers: Paginated<TopSeller>;
        /** No sale in this many days counts as not selling (slow-moving). */
        slow_days: number;
        not_selling: Paginated<{
            product_id: number;
            product_name: string;
            stock_pieces: number;
            first_arrived_at: string | null;
            last_sold_at: string | null;
            days_without_sale: number;
        }>;
    };
};

export type SalesPeriod = 'week' | 'month' | 'year';

type TopSeller = {
    rank: number;
    product_id: number;
    product_name: string;
    pieces: number;
    price_total_centavos: number;
    top_variant_label: string | null;
    top_variant_pieces: number;
};

const periods: { value: SalesPeriod; label: string; words: string }[] = [
    { value: 'week', label: 'This week', words: 'this week' },
    { value: 'month', label: 'This month', words: 'this month' },
    { value: 'year', label: 'This year', words: 'this year' },
];

const tabs: {
    value: AdminDeliveryTab;
    label: string;
    hint: string;
    selectedClasses: string;
    countClasses: string;
}[] = [
    {
        value: 'coming',
        label: 'Coming',
        hint: 'Uploaded, nothing arrived yet',
        selectedClasses: 'border-amber-400 bg-amber-50',
        countClasses: 'bg-amber-100 text-amber-800',
    },
    {
        value: 'ongoing',
        label: 'Ongoing',
        hint: 'Some items arrived, the rest still to come',
        selectedClasses: 'border-[#0D6EFD] bg-blue-50',
        countClasses: 'bg-blue-100 text-blue-800',
    },
    {
        value: 'completed',
        label: 'Completed',
        hint: 'Everything arrived, or closed with some missing',
        selectedClasses: 'border-emerald-500 bg-emerald-50',
        countClasses: 'bg-emerald-100 text-emerald-800',
    },
];

const statusClasses: Record<DeliveryStatus, string> = {
    awaiting: 'bg-amber-100 text-amber-800',
    partially_received: 'bg-blue-100 text-blue-800',
    completed: 'bg-emerald-100 text-emerald-800',
    completed_short: 'bg-red-100 text-red-800',
};

const barClasses: Record<DeliveryStatus, string> = {
    awaiting: 'bg-amber-400',
    partially_received: 'bg-[#0D6EFD]',
    completed: 'bg-emerald-500',
    completed_short: 'bg-red-500',
};

const emptyText: Record<AdminDeliveryTab, string> = {
    coming: 'No order is waiting for its first delivery. An order shows here as soon as the Specialist uploads it, until its first items arrive.',
    ongoing:
        'No order is partly delivered right now. An order shows here once its first items arrive, until the rest arrive.',
    completed:
        'No order is complete yet. An order shows here once everything arrived, or when the Specialist closes it with some missing.',
};

/**
 * The School Admin's dashboard (view only): every eStore order the
 * Specialist uploaded, in three tabs by what has arrived, with its Date
 * Ordered. 5 orders a page; View Details opens the order with the date and
 * time of each step. The
 * search by Order # narrows every tab, and the tab counts show where the
 * order is.
 */
export default function SchoolAdminOverview({
    firstName,
    overview,
}: {
    firstName: string;
    overview: SchoolAdminOverviewData;
}) {
    const [viewing, setViewing] = useState<number | null>(null);
    const {
        tab,
        search,
        counts,
        late_days: lateDays,
        orders,
    } = overview.deliveries;
    const [searchText, setSearchText] = useState(search ?? '');
    const firstRender = useRef(true);
    const today = new Intl.DateTimeFormat('en-PH', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
    }).format(new Date());

    const period = overview.sales.period;
    const showList = (next: {
        tab: AdminDeliveryTab;
        search: string | null;
        period?: SalesPeriod;
    }) =>
        router.get(
            dashboard().url,
            {
                tab: next.tab,
                ...(next.search ? { search: next.search } : {}),
                period: next.period ?? period,
            },
            {
                only: ['overview'],
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    const showTab = (next: AdminDeliveryTab) => showList({ tab: next, search });
    const clearSearch = () => {
        setSearchText('');
        showList({ tab, search: null });
    };

    // Search by Order # as the Admin types, after a short pause.
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;

            return;
        }

        if (isSameSearch(searchText, search)) {
            return;
        }

        const timer = window.setTimeout(
            () =>
                showList({
                    tab,
                    search: searchText.trim() === '' ? null : searchText.trim(),
                }),
            400,
        );

        return () => window.clearTimeout(timer);
        // Only the typed text should trigger a search.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchText]);

    const otherTabsWithMatches = tabs.filter(
        (option) => option.value !== tab && counts[option.value] > 0,
    );
    const currentLabel = tabs.find((option) => option.value === tab)?.label;

    return (
        <>
            <Head title="Dashboard" />

            <div className="space-y-7">
                <PageHeader
                    title={`Welcome, ${firstName}`}
                    description={`${today} · the eStore orders the Specialist uploaded and what has arrived. View only.`}
                />

                <Panel
                    title="Deliveries"
                    description="Every eStore order the Specialist uploaded, by what has arrived. Open one for its items and Delivery History."
                    actions={
                        <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 sm:w-72">
                            <Search size={18} className="shrink-0" />
                            <input
                                type="search"
                                maxLength={40}
                                value={searchText}
                                onChange={(event) =>
                                    setSearchText(event.target.value)
                                }
                                inputMode="numeric"
                                placeholder="Search by Order #"
                                className="w-full min-w-0 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                                aria-label="Search by Order #"
                            />
                        </label>
                    }
                >
                    <div
                        role="tablist"
                        aria-label="Delivery status"
                        className="grid gap-3 px-6 pt-5 pb-5 sm:grid-cols-3"
                    >
                        {tabs.map((option) => {
                            const selected = option.value === tab;
                            const late =
                                option.value === 'completed'
                                    ? 0
                                    : counts[`${option.value}_late`];

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    role="tab"
                                    aria-selected={selected}
                                    onClick={() => showTab(option.value)}
                                    className={cn(
                                        'rounded-2xl border-2 px-4 py-3.5 text-left transition',
                                        selected
                                            ? option.selectedClasses
                                            : 'border-slate-200 bg-white hover:border-slate-300',
                                    )}
                                >
                                    <span className="flex items-center justify-between gap-2">
                                        <span className="font-black text-slate-900">
                                            {option.label}
                                        </span>
                                        <span
                                            className={cn(
                                                'min-w-7 rounded-full px-2 py-0.5 text-center text-sm font-black',
                                                option.countClasses,
                                            )}
                                        >
                                            {counts[
                                                option.value
                                            ].toLocaleString('en-PH')}
                                        </span>
                                    </span>
                                    <span className="mt-1 block text-xs font-semibold text-slate-600">
                                        {option.hint}
                                        {late > 0 && (
                                            <span className="font-black text-red-700">
                                                {' '}
                                                · {late} late
                                            </span>
                                        )}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {orders.data.length === 0 && search !== null ? (
                        <div className="border-t border-slate-100 px-6 py-12 text-center">
                            <SearchX
                                size={36}
                                className="mx-auto text-slate-300"
                            />
                            <p className="mt-3 font-black text-slate-800">
                                No {currentLabel} order matches #{search}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                                {otherTabsWithMatches.length > 0
                                    ? `It is in ${otherTabsWithMatches.map((option) => option.label).join(' and ')}.`
                                    : 'Check the Order #, or clear the search to see every order.'}
                            </p>
                            <div className="mt-4 flex flex-wrap justify-center gap-2">
                                {otherTabsWithMatches.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => showTab(option.value)}
                                        className="inline-flex h-10 items-center rounded-xl bg-[#0D6EFD] px-4 text-sm font-black text-white transition hover:bg-blue-700"
                                    >
                                        Show {option.label}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={clearSearch}
                                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                                >
                                    <X size={15} />
                                    Clear search
                                </button>
                            </div>
                        </div>
                    ) : orders.data.length === 0 ? (
                        <p className="border-t border-slate-100 px-6 py-12 text-center text-sm text-slate-500">
                            {emptyText[tab]}
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-205 text-sm">
                                <thead className="bg-slate-50 text-left text-[11px] font-black tracking-wider text-slate-500 uppercase">
                                    <tr>
                                        <th className="px-6 py-3">Order #</th>
                                        <th className="px-4 py-3">
                                            Date Ordered
                                        </th>
                                        <th className="px-4 py-3">Received</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-6 py-3 text-right">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {orders.data.map((order) => (
                                        <OrderRow
                                            key={order.id}
                                            order={order}
                                            lateDays={lateDays}
                                            onView={() => setViewing(order.id)}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <Pagination pagination={orders} itemName="orders" />
                </Panel>

                <SalesLists
                    sales={overview.sales}
                    onPeriod={(next) => showList({ tab, search, period: next })}
                />
            </div>

            <PurchaseOrderDetailsDialog
                purchaseOrderId={viewing}
                onClose={() => setViewing(null)}
            />
        </>
    );
}

function OrderRow({
    order,
    lateDays,
    onView,
}: {
    order: AdminDeliveryRow;
    lateDays: number;
    onView: () => void;
}) {
    return (
        <tr className={cn('align-top', order.is_late && 'bg-red-50/40')}>
            <td className="px-6 py-4">
                <p className="font-mono font-black text-[#0D6EFD]">
                    {order.order_number
                        ? `#${order.order_number}`
                        : 'No Order #'}
                </p>
                {order.category && (
                    <span className="mt-1.5 inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-black text-blue-700">
                        {order.category}
                    </span>
                )}
            </td>
            <td className="px-4 py-4 font-semibold whitespace-nowrap text-slate-800">
                {formatDateOrdered(order.date_ordered)}
            </td>
            <td className="min-w-48 px-4 py-4">
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                        className={cn(
                            'h-full rounded-full',
                            barClasses[order.status],
                        )}
                        style={{ width: `${order.percent_received}%` }}
                    />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                    {order.percent_received}% ·{' '}
                    {order.quantity_received.toLocaleString('en-PH')} of{' '}
                    {order.quantity_ordered.toLocaleString('en-PH')} pcs
                </p>
            </td>
            <td className="px-4 py-4">
                <span
                    className={cn(
                        'inline-flex rounded-full px-3 py-1 text-xs font-black whitespace-nowrap',
                        statusClasses[order.status],
                    )}
                >
                    {order.status_label}
                </span>
                {order.is_late && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-black text-red-700">
                        <CircleAlert size={14} />
                        Late · not complete after {lateDays} days
                    </p>
                )}
            </td>
            <td className="px-6 py-4 text-right">
                <div className="flex flex-col items-end gap-2">
                    <button
                        type="button"
                        onClick={onView}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 text-sm font-black whitespace-nowrap text-blue-700 transition hover:bg-blue-100"
                    >
                        <Eye size={16} />
                        View Details
                    </button>
                    {order.is_late && (
                        <RemindSpecialist
                            order={{ ...order, late_days: lateDays }}
                        />
                    )}
                </div>
            </td>
        </tr>
    );
}

/**
 * What sells and what does not, in one Sales box: four numbers at a glance
 * (pieces sold, what they sold for, the top seller, what is not selling),
 * then the Top sellers of the week, month or year or the products not
 * selling (slow-moving) in two tabs, 5 a page each.
 */
function SalesLists({
    sales,
    onPeriod,
}: {
    sales: SchoolAdminOverviewData['sales'];
    onPeriod: (period: SalesPeriod) => void;
}) {
    const { url } = usePage();
    // Paging Not selling reloads the page; it stays on that tab.
    const [list, setList] = useState<'top' | 'slow'>(
        url.includes('slow_page=') ? 'slow' : 'top',
    );
    const periodWords =
        periods.find((option) => option.value === sales.period)?.words ?? '';
    const { totals } = sales;
    const listTabs = [
        {
            value: 'top' as const,
            label: 'Top sellers',
            count: sales.top_sellers.total,
            countClasses: 'bg-blue-100 text-blue-800',
        },
        {
            value: 'slow' as const,
            label: 'Not selling',
            count: sales.not_selling.total,
            countClasses: 'bg-amber-100 text-amber-800',
        },
    ];

    return (
        <Panel
            title="Sales"
            description={`What students are buying, and what is sitting in stock · ${formatDateOrdered(sales.from)} to ${formatDateOrdered(sales.to)}.`}
            actions={
                <div
                    role="group"
                    aria-label="Period"
                    className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1"
                >
                    {periods.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            aria-pressed={option.value === sales.period}
                            onClick={() => onPeriod(option.value)}
                            className={cn(
                                'rounded-lg px-3 py-1.5 text-sm font-black whitespace-nowrap transition',
                                option.value === sales.period
                                    ? 'bg-[#0D6EFD] text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-white',
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            }
        >
            <div className="grid gap-3 px-6 pt-5 pb-5 sm:grid-cols-2 xl:grid-cols-4">
                <SalesNumber
                    label="Pieces sold"
                    value={totals.pieces.toLocaleString('en-PH')}
                    note={`released to students ${periodWords}`}
                />
                <SalesNumber
                    label="Sold for"
                    value={formatPeso(totals.price_centavos)}
                    note="paid at the cashier"
                />
                <SalesNumber
                    label="Top seller"
                    value={totals.best?.product_name ?? 'None yet'}
                    note={
                        totals.best
                            ? `${totals.best.pieces.toLocaleString('en-PH')} ${totals.best.pieces === 1 ? 'pc' : 'pcs'}${totals.best.top_variant_label ? ` · most sold: ${totals.best.top_variant_label}` : ''}`
                            : `nothing released ${periodWords}`
                    }
                    tone="green"
                    small
                />
                <SalesNumber
                    label="Not selling"
                    value={`${sales.not_selling.total} ${sales.not_selling.total === 1 ? 'product' : 'products'}`}
                    note={`${totals.not_selling_pieces.toLocaleString('en-PH')} pcs in stock, no sale in ${sales.slow_days} days`}
                    tone="amber"
                />
            </div>

            <div
                role="tablist"
                aria-label="Sales lists"
                className="flex gap-1 border-b border-slate-200 px-6"
            >
                {listTabs.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        role="tab"
                        aria-selected={list === option.value}
                        onClick={() => setList(option.value)}
                        className={cn(
                            '-mb-px inline-flex items-center gap-2 border-b-[3px] px-3.5 py-3 text-sm font-black transition',
                            list === option.value
                                ? 'border-[#0D6EFD] text-[#0D6EFD]'
                                : 'border-transparent text-slate-500 hover:text-slate-800',
                        )}
                    >
                        {option.label}
                        <span
                            className={cn(
                                'rounded-full px-2 py-0.5 text-xs',
                                option.countClasses,
                            )}
                        >
                            {option.count.toLocaleString('en-PH')}
                        </span>
                    </button>
                ))}
            </div>

            {list === 'top' &&
                (sales.top_sellers.data.length === 0 ? (
                    <p className="px-6 py-12 text-center text-sm text-slate-500">
                        Nothing was released to students {periodWords}.
                    </p>
                ) : (
                    <ol className="divide-y divide-slate-100">
                        {sales.top_sellers.data.map((row) => (
                            <li
                                key={row.product_id}
                                className="flex items-center gap-4 px-6 py-3.5"
                            >
                                <span
                                    className={cn(
                                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black',
                                        row.rank === 1
                                            ? 'bg-amber-100 text-amber-800'
                                            : 'bg-slate-100 text-slate-600',
                                    )}
                                >
                                    {row.rank}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-black text-slate-900">
                                        {row.product_name}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {formatPeso(row.price_total_centavos)}{' '}
                                        sold
                                        {row.top_variant_label &&
                                            ` · most sold: ${row.top_variant_label} (${row.top_variant_pieces})`}
                                    </p>
                                </div>
                                <p className="shrink-0 text-right">
                                    <span className="text-lg font-black text-emerald-700">
                                        {row.pieces.toLocaleString('en-PH')}
                                    </span>{' '}
                                    <span className="text-xs font-bold text-slate-500">
                                        {row.pieces === 1 ? 'pc' : 'pcs'}
                                    </span>
                                </p>
                            </li>
                        ))}
                    </ol>
                ))}
            {list === 'top' && (
                <Pagination
                    pagination={sales.top_sellers}
                    itemName="products"
                />
            )}

            {list === 'slow' && (
                <p className="px-6 pt-4 text-xs text-slate-500">
                    In stock, arrived at least {sales.slow_days} days ago, and
                    nothing sold in the last {sales.slow_days} days (the
                    Specialist&apos;s slow-moving items). The longest without a
                    sale first.
                </p>
            )}
            {list === 'slow' &&
                (sales.not_selling.data.length === 0 ? (
                    <p className="px-6 py-12 text-center text-sm font-semibold text-emerald-700">
                        Every product in stock sold something in the last{' '}
                        {sales.slow_days} days.
                    </p>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {sales.not_selling.data.map((row) => (
                            <li
                                key={row.product_id}
                                className="flex items-center gap-4 px-6 py-3.5"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-black text-slate-900">
                                        {row.product_name}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {row.stock_pieces.toLocaleString(
                                            'en-PH',
                                        )}{' '}
                                        {row.stock_pieces === 1 ? 'pc' : 'pcs'}{' '}
                                        in stock ·{' '}
                                        {row.last_sold_at
                                            ? `last sold ${formatDateTime(row.last_sold_at)}`
                                            : `arrived ${formatDateTime(row.first_arrived_at)}`}
                                    </p>
                                </div>
                                <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-black whitespace-nowrap text-amber-800">
                                    {row.last_sold_at
                                        ? `${row.days_without_sale} days, no sale`
                                        : 'Never sold'}
                                </span>
                            </li>
                        ))}
                    </ul>
                ))}
            {list === 'slow' && (
                <Pagination
                    pagination={sales.not_selling}
                    itemName="products"
                />
            )}
        </Panel>
    );
}

/** One of the four numbers at the top of the Sales box. */
function SalesNumber({
    label,
    value,
    note,
    tone = 'plain',
    small = false,
}: {
    label: string;
    value: string;
    note: string;
    tone?: 'plain' | 'green' | 'amber';
    small?: boolean;
}) {
    return (
        <div
            className={cn(
                'min-w-0 rounded-2xl border px-4 py-3.5',
                tone === 'green' && 'border-emerald-200 bg-emerald-50',
                tone === 'amber' && 'border-amber-200 bg-amber-50',
                tone === 'plain' && 'border-slate-200 bg-white',
            )}
        >
            <p
                className={cn(
                    'text-xs font-black',
                    tone === 'green'
                        ? 'text-emerald-700'
                        : tone === 'amber'
                          ? 'text-amber-700'
                          : 'text-slate-500',
                )}
            >
                {label}
            </p>
            <p
                className={cn(
                    'mt-1 truncate font-black',
                    small ? 'text-xl' : 'text-2xl',
                    tone === 'green'
                        ? 'text-emerald-800'
                        : tone === 'amber'
                          ? 'text-amber-900'
                          : 'text-slate-900',
                )}
            >
                {value}
            </p>
            <p
                className={cn(
                    'mt-0.5 truncate text-xs',
                    tone === 'green'
                        ? 'text-emerald-700'
                        : tone === 'amber'
                          ? 'text-amber-700'
                          : 'text-slate-500',
                )}
            >
                {note}
            </p>
        </div>
    );
}
