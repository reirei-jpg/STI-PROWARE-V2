import { Head, Link, router, usePage } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    CircleAlert,
    ExternalLink,
    Eye,
    PackageCheck,
    Plus,
    Search,
    SearchX,
    Truck,
    Unlink,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import DeliveryController from '@/actions/App/Http/Controllers/DeliveryController';
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController';
import DateRangeFilter from '@/components/date-range-filter';
import DeliveryDetailsDialog from '@/components/delivery-details-dialog';
import DeliveryProgress from '@/components/delivery-progress';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import Panel, { TableHeading } from '@/components/panel';
import { formatDateOrdered, formatDateTime } from '@/lib/format';
import { formatUnits } from '@/lib/units';
import { cn } from '@/lib/utils';
import type {
    Auth,
    DeliveriesShow,
    DeliveriesSummary,
    DeliveryDetails,
    DeliveryFilters,
    DeliveryListItem,
    Paginated,
    WaitingOrderRow,
} from '@/types';

const primaryButtonClasses =
    'inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700';

const waitingLists: DeliveriesShow[] = ['waiting', 'follow_up'];

/** Each list's title and what it shows; days is the follow-up setting. */
const titles = (days: number): Record<DeliveriesShow, [string, string]> => ({
    received: [
        'Received',
        'Everything that arrived from Head Office, newest first.',
    ],
    this_month: ['Received this month', 'Deliveries received this month.'],
    not_in_stock: [
        'Not in stock yet',
        'Deliveries with items not linked to a product, so their pieces are not in stock.',
    ],
    waiting: [
        'Waiting to arrive',
        'Purchase orders not fully delivered, the oldest Date Ordered first.',
    ],
    follow_up: [
        `Not complete after ${days} days`,
        `Ordered ${days} or more days ago and not fully delivered. Ask Head Office about the rest. Change the days in Maintenance.`,
    ],
});

/**
 * Deliveries from Head Office, as a back office: four cards (Not complete
 * after N days, Waiting to arrive, Received this month, Not in stock yet)
 * that filter the table; the Received tab (what arrived, its receipt, from
 * which orders, what went into stock, View Details) and the Waiting to
 * arrive tab (purchase orders still to come, with the days since they were
 * ordered). Head Office gives no delivery date, so the Date Ordered is what
 * is known. The School Admin only looks; recording is the Specialist's.
 */
export default function DeliveriesIndex({
    deliveries,
    waitingOrders,
    summary,
    details,
    filters,
}: {
    deliveries: Paginated<DeliveryListItem> | null;
    waitingOrders: Paginated<WaitingOrderRow> | null;
    summary: DeliveriesSummary;
    details?: DeliveryDetails | null;
    filters: DeliveryFilters;
}) {
    const { errors, auth } = usePage<{
        errors: Record<string, string>;
        auth: Auth;
    }>().props;
    const canRecord = auth.user.role === 'specialist';
    const [search, setSearch] = useState(filters.search ?? '');
    const [viewingId, setViewingId] = useState<number | null>(null);
    const firstRender = useRef(true);
    const showingWaiting = waitingLists.includes(filters.show);
    const isFiltered = Boolean(
        filters.search || filters.date_from || filters.date_to,
    );

    const showList = (next: Partial<DeliveryFilters>) => {
        const merged = { ...filters, ...next };
        const query: Record<string, string> = {};

        if (merged.show !== 'received') {
            query.show = merged.show;
        }

        for (const key of ['search', 'date_from', 'date_to'] as const) {
            if (merged[key]) {
                query[key] = merged[key];
            }
        }

        router.get(DeliveryController.index().url, query, {
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

    const openDetails = (delivery: DeliveryListItem) => {
        setViewingId(delivery.id);
        router.reload({ data: { details: delivery.id }, only: ['details'] });
    };

    const [title, description] = titles(summary.follow_up_days)[filters.show];

    return (
        <>
            <Head title="Deliveries" />

            <div className="space-y-6">
                <PageHeader
                    title="Deliveries"
                    description="What arrived from Head Office and what is still to come. Recording a delivery adds its items to stock and updates their purchase orders."
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

                <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <SummaryCard
                        active={filters.show === 'follow_up'}
                        icon={CircleAlert}
                        tone="red"
                        label={`Not complete after ${summary.follow_up_days} days`}
                        value={summary.follow_up}
                        detail={
                            summary.follow_up === 1
                                ? 'order to ask Head Office about'
                                : 'orders to ask Head Office about'
                        }
                        onClick={() => showList({ show: 'follow_up' })}
                    />
                    <SummaryCard
                        active={filters.show === 'waiting'}
                        icon={Truck}
                        tone="blue"
                        label="Waiting to arrive"
                        value={summary.waiting}
                        detail={
                            summary.waiting === 1
                                ? 'order not fully delivered'
                                : 'orders not fully delivered'
                        }
                        onClick={() => showList({ show: 'waiting' })}
                    />
                    <SummaryCard
                        active={filters.show === 'this_month'}
                        icon={PackageCheck}
                        tone="green"
                        label="Received this month"
                        value={summary.this_month.deliveries}
                        detail={`${summary.this_month.deliveries === 1 ? 'delivery' : 'deliveries'} · +${formatUnits(summary.this_month.pieces, 'Piece')}`}
                        onClick={() => showList({ show: 'this_month' })}
                    />
                    <SummaryCard
                        active={filters.show === 'not_in_stock'}
                        icon={Unlink}
                        tone="amber"
                        label="Not in stock yet"
                        value={summary.not_in_stock}
                        detail={
                            summary.not_in_stock === 1
                                ? 'item to link to a product'
                                : 'items to link to a product'
                        }
                        onClick={() => showList({ show: 'not_in_stock' })}
                    />
                </section>

                <Panel>
                    <div className="space-y-4 border-b border-slate-100 px-6 py-5">
                        <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                            <TabButton
                                active={!showingWaiting}
                                onClick={() =>
                                    showList({
                                        show: 'received',
                                        date_from: null,
                                        date_to: null,
                                    })
                                }
                            >
                                Received
                            </TabButton>
                            <TabButton
                                active={showingWaiting}
                                count={summary.waiting}
                                onClick={() =>
                                    showList({
                                        show: 'waiting',
                                        date_from: null,
                                        date_to: null,
                                    })
                                }
                            >
                                Waiting to arrive
                            </TabButton>
                        </div>

                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <h2 className="font-black text-slate-900">
                                    {title}
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    {description}
                                </p>
                            </div>
                            <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 lg:max-w-sm">
                                <Search size={18} className="shrink-0" />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder={
                                        showingWaiting
                                            ? 'Search by Order #'
                                            : 'Search by SI #, DR # or Order #'
                                    }
                                    className="w-full min-w-0 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                                    aria-label="Search"
                                />
                            </label>
                        </div>

                        {!showingWaiting && (
                            <DateRangeFilter
                                label="Date Received"
                                dateFrom={filters.date_from}
                                dateTo={filters.date_to}
                                serverError={errors.date_from ?? errors.date_to}
                                onChange={(dateFrom, dateTo) =>
                                    showList({
                                        date_from: dateFrom,
                                        date_to: dateTo,
                                    })
                                }
                            />
                        )}

                        {isFiltered && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                            >
                                <X size={15} />
                                Clear search and dates
                            </button>
                        )}
                    </div>

                    {deliveries && (
                        <ReceivedTable
                            deliveries={deliveries}
                            isFiltered={
                                isFiltered || filters.show !== 'received'
                            }
                            canRecord={canRecord}
                            onClear={clearFilters}
                            onView={openDetails}
                        />
                    )}
                    {waitingOrders && (
                        <WaitingTable
                            orders={waitingOrders}
                            followUpDays={summary.follow_up_days}
                            canRecord={canRecord}
                        />
                    )}
                </Panel>
            </div>

            <DeliveryDetailsDialog
                open={viewingId !== null}
                // Another delivery's details (from before) count as loading.
                details={
                    details === null || details?.id === viewingId
                        ? details
                        : undefined
                }
                canLink={canRecord}
                onClose={() => setViewingId(null)}
            />
        </>
    );
}

const toneClasses = {
    red: { icon: 'bg-red-50 text-red-600', ring: 'ring-red-400' },
    blue: { icon: 'bg-blue-50 text-blue-600', ring: 'ring-blue-400' },
    green: { icon: 'bg-emerald-50 text-emerald-600', ring: 'ring-emerald-400' },
    amber: { icon: 'bg-amber-50 text-amber-600', ring: 'ring-amber-400' },
} as const;

/** One number at the top; clicking it shows that list. */
function SummaryCard({
    active,
    icon: Icon,
    tone,
    label,
    value,
    detail,
    onClick,
}: {
    active: boolean;
    icon: LucideIcon;
    tone: keyof typeof toneClasses;
    label: string;
    value: number;
    detail: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                'flex flex-col rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
                active && `ring-2 ${toneClasses[tone].ring}`,
            )}
        >
            <span
                className={cn(
                    'flex size-11 items-center justify-center rounded-2xl',
                    toneClasses[tone].icon,
                )}
            >
                <Icon size={21} />
            </span>
            <span className="mt-4 text-xs font-black tracking-wide text-slate-500 uppercase">
                {label}
            </span>
            <span className="mt-0.5 text-3xl font-black tracking-tight text-slate-900">
                {value.toLocaleString('en-PH')}
            </span>
            <span className="text-sm text-slate-500">{detail}</span>
        </button>
    );
}

function TabButton({
    active,
    count,
    onClick,
    children,
}: {
    active: boolean;
    count?: number;
    onClick: () => void;
    children: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-black transition',
                active
                    ? 'bg-[#0D6EFD] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white',
            )}
        >
            {children}
            {count !== undefined && (
                <span
                    className={cn(
                        'rounded-full px-2 py-0.5 text-xs',
                        active ? 'bg-white/25' : 'bg-white text-slate-600',
                    )}
                >
                    {count}
                </span>
            )}
        </button>
    );
}

/** Recorded deliveries: what arrived, its receipt, orders, stock, who. */
function ReceivedTable({
    deliveries,
    isFiltered,
    canRecord,
    onClear,
    onView,
}: {
    deliveries: Paginated<DeliveryListItem>;
    isFiltered: boolean;
    canRecord: boolean;
    onClear: () => void;
    onView: (delivery: DeliveryListItem) => void;
}) {
    if (deliveries.data.length === 0) {
        return (
            <div className="px-6 py-16 text-center">
                {isFiltered ? (
                    <SearchX size={44} className="mx-auto text-slate-300" />
                ) : (
                    <Truck size={44} className="mx-auto text-slate-300" />
                )}
                <h3 className="mt-4 text-lg font-black text-slate-800">
                    {isFiltered
                        ? 'No deliveries here'
                        : 'No deliveries recorded yet'}
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                    {isFiltered
                        ? 'Check the number you typed, or clear the search and dates.'
                        : 'When boxes arrive from Head Office, record them so every order shows what has arrived.'}
                </p>
                {isFiltered ? (
                    <button
                        type="button"
                        onClick={onClear}
                        className={`mt-6 ${primaryButtonClasses}`}
                    >
                        Clear search and dates
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
        );
    }

    return (
        <>
            <div className="overflow-x-auto">
                <table className="w-full min-w-250">
                    <thead className="bg-slate-50">
                        <tr>
                            <TableHeading>Date Received</TableHeading>
                            <TableHeading>Receipt</TableHeading>
                            <TableHeading>What Arrived</TableHeading>
                            <TableHeading>From Order</TableHeading>
                            <TableHeading align="right">
                                Added to Stock
                            </TableHeading>
                            <TableHeading>Recorded By</TableHeading>
                            <TableHeading align="right">Actions</TableHeading>
                        </tr>
                    </thead>
                    <tbody>
                        {deliveries.data.map((delivery) => (
                            <tr
                                key={delivery.id}
                                className="border-t border-slate-100 align-top text-sm transition hover:bg-slate-50/70"
                            >
                                <td className="px-5 py-4 font-black whitespace-nowrap text-slate-900">
                                    {formatDateOrdered(delivery.received_on)}
                                </td>
                                <td className="px-5 py-4">
                                    {delivery.sales_invoice_number ||
                                    delivery.delivery_receipt_number ? (
                                        <div className="space-y-0.5 font-mono text-xs text-slate-700">
                                            {delivery.sales_invoice_number && (
                                                <p>
                                                    SI{' '}
                                                    {
                                                        delivery.sales_invoice_number
                                                    }
                                                </p>
                                            )}
                                            {delivery.delivery_receipt_number && (
                                                <p>
                                                    DR{' '}
                                                    {
                                                        delivery.delivery_receipt_number
                                                    }
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-xs text-slate-400">
                                            No receipt no.
                                        </span>
                                    )}
                                </td>
                                <td className="px-5 py-4">
                                    {delivery.first_item && (
                                        <p className="max-w-64 truncate font-bold text-slate-800">
                                            {delivery.first_item.product ??
                                                delivery.first_item.description}
                                        </p>
                                    )}
                                    <p className="mt-0.5 text-xs text-slate-500">
                                        {delivery.items_count > 1
                                            ? `+ ${delivery.items_count - 1} more ${delivery.items_count === 2 ? 'item' : 'items'}`
                                            : delivery.first_item &&
                                              `${delivery.first_item.quantity_received.toLocaleString('en-PH')} as ordered`}
                                    </p>
                                </td>
                                <td className="px-5 py-4">
                                    <div className="flex flex-wrap gap-1.5 font-mono text-xs">
                                        {delivery.orders.map((order) => (
                                            <span
                                                key={order.id}
                                                className={
                                                    order.order_number
                                                        ? 'font-black text-slate-800'
                                                        : 'text-slate-400'
                                                }
                                            >
                                                {order.order_number
                                                    ? `#${order.order_number}`
                                                    : 'No order #'}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-5 py-4 text-right">
                                    <p className="text-base font-black whitespace-nowrap text-emerald-700">
                                        {delivery.pieces_added_to_stock > 0
                                            ? `+${formatUnits(delivery.pieces_added_to_stock, 'Piece')}`
                                            : '—'}
                                    </p>
                                    {delivery.items_not_in_stock > 0 && (
                                        <p className="mt-1 text-xs font-bold whitespace-nowrap text-amber-700">
                                            {delivery.items_not_in_stock === 1
                                                ? '1 item not linked'
                                                : `${delivery.items_not_in_stock} items not linked`}
                                        </p>
                                    )}
                                </td>
                                <td className="px-5 py-4">
                                    <p className="font-semibold text-slate-700">
                                        {delivery.recorded_by}
                                    </p>
                                    <p className="mt-0.5 text-xs text-slate-500">
                                        {formatDateTime(delivery.recorded_at)}
                                    </p>
                                </td>
                                <td className="px-5 py-4 text-right">
                                    <button
                                        type="button"
                                        onClick={() => onView(delivery)}
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
            </div>

            <Pagination pagination={deliveries} itemName="deliveries" />
        </>
    );
}

/** Purchase orders still to arrive, the oldest Date Ordered first. */
function WaitingTable({
    orders,
    followUpDays,
    canRecord,
}: {
    orders: Paginated<WaitingOrderRow>;
    followUpDays: number;
    canRecord: boolean;
}) {
    if (orders.data.length === 0) {
        return (
            <div className="px-6 py-16 text-center">
                <PackageCheck size={44} className="mx-auto text-emerald-300" />
                <h3 className="mt-4 text-lg font-black text-slate-800">
                    Nothing waiting here
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                    Every purchase order in this list has arrived.
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="overflow-x-auto">
                <table className="w-full min-w-250">
                    <thead className="bg-slate-50">
                        <tr>
                            <TableHeading>Order #</TableHeading>
                            <TableHeading>Waiting</TableHeading>
                            <TableHeading>Received So Far</TableHeading>
                            <TableHeading align="right">
                                Still to Come
                            </TableHeading>
                            <TableHeading align="right">Actions</TableHeading>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.data.map((order) => (
                            <tr
                                key={order.id}
                                className="border-t border-slate-100 align-top text-sm transition hover:bg-slate-50/70"
                            >
                                <td className="px-5 py-4">
                                    <p
                                        className={cn(
                                            'font-mono font-black',
                                            order.order_number
                                                ? 'text-blue-700'
                                                : 'text-slate-400',
                                        )}
                                    >
                                        {order.order_number
                                            ? `#${order.order_number}`
                                            : 'No order #'}
                                    </p>
                                    <p className="mt-0.5 text-xs text-slate-500">
                                        Ordered{' '}
                                        {formatDateOrdered(order.date_ordered)}{' '}
                                        · {order.items_count}{' '}
                                        {order.items_count === 1
                                            ? 'item'
                                            : 'items'}
                                    </p>
                                </td>
                                <td className="px-5 py-4">
                                    <DaysWaiting
                                        days={order.days_since_ordered}
                                        followUpDays={followUpDays}
                                    />
                                </td>
                                <td className="px-5 py-4">
                                    <DeliveryProgress progress={order} />
                                </td>
                                <td className="px-5 py-4 text-right text-base font-black text-slate-900">
                                    {order.quantity_remaining.toLocaleString(
                                        'en-PH',
                                    )}
                                    <span className="block text-xs font-normal text-slate-500">
                                        as ordered
                                    </span>
                                </td>
                                <td className="px-5 py-4 text-right">
                                    <div className="flex flex-wrap justify-end gap-2">
                                        {canRecord && (
                                            <Link
                                                href={DeliveryController.create()}
                                                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0D6EFD] px-3.5 text-sm font-black whitespace-nowrap text-white transition hover:bg-blue-700"
                                            >
                                                <Truck size={15} />
                                                Record Delivery
                                            </Link>
                                        )}
                                        <Link
                                            href={PurchaseOrderController.index(
                                                { query: { view: order.id } },
                                            )}
                                            className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 text-sm font-black whitespace-nowrap text-blue-700 transition hover:bg-blue-100"
                                        >
                                            <ExternalLink size={15} />
                                            Open order
                                        </Link>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Pagination pagination={orders} itemName="orders" />
        </>
    );
}

/**
 * Days since the order was dated, in V1's colors: red once it is past the
 * follow-up days (ask Head Office), blue while it is still on time.
 */
function DaysWaiting({
    days,
    followUpDays,
}: {
    days: number;
    followUpDays: number;
}) {
    const overdue = days >= followUpDays;

    return (
        <p
            className={cn(
                'text-sm font-black whitespace-nowrap',
                overdue ? 'text-red-600' : 'text-blue-700',
            )}
        >
            {days} {days === 1 ? 'day' : 'days'}
            <span className="block text-xs font-bold text-slate-500">
                {overdue ? 'Ask Head Office' : 'since ordered'}
            </span>
        </p>
    );
}
