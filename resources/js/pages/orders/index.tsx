import { Head, router, usePoll } from '@inertiajs/react';
import { Eye, Search, ShoppingBag, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import OrderController from '@/actions/App/Http/Controllers/OrderController';
import OrderDetailsDialog from '@/components/order-details-dialog';
import { OrderStatusBadge } from '@/components/order-items';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import Panel, { TableHeading, TableScroll } from '@/components/panel';
import SlipScanBox from '@/components/slip-scan-box';
import StaffTag from '@/components/staff-tag';
import { formatDateOrdered, formatDateTime, formatPeso } from '@/lib/format';
import { formatUnits } from '@/lib/units';
import { cn, isSameSearch } from '@/lib/utils';
import type { Paginated, SpecialistOrderRow as SpecialistOrder } from '@/types';

type Show = 'placed' | 'picked_up' | 'cancelled' | 'all';

const chips: { value: Show; label: string }[] = [
    { value: 'placed', label: 'Waiting for payment' },
    { value: 'picked_up', label: 'Released' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'all', label: 'All' },
];

const descriptions: Record<Show, string> = {
    placed: 'Waiting for the buyer to pay at the cashier and show the receipt and slip. Whoever pays first gets the items. Oldest first.',
    picked_up: 'Paid and handed over. Newest first.',
    cancelled: 'Cancelled by the buyer or by you. Newest first.',
    all: 'Every order, newest first.',
};

/**
 * The Specialist's Student Orders page. A student shows the order's
 * issuance slip: scan its QR (or type the order number) to open it, check
 * it, and release the items once paid. Below, every order in a table (by
 * status, with a search); View Details opens an order with its items, its
 * history and Release. Orders hold no stock and never expire: whoever pays
 * first gets the items. Only the buyer can cancel an order.
 */
export default function OrdersIndex({
    orders,
    filters,
    counts,
    viewing: viewingAfterStep = null,
}: {
    orders: Paginated<SpecialistOrder>;
    filters: { show: Show; search: string | null };
    counts: Record<Exclude<Show, 'all'>, number>;
    /** The open order asked for again after a step, once it left this tab. */
    viewing?: SpecialistOrder | null;
}) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [viewingId, setViewingId] = useState<number | null>(null);
    const firstRender = useRef(true);
    // The open order follows the list, so it updates after each step. When
    // it moves to another tab (e.g. released), it is asked for again, and
    // the popup stays open on it until closed; meanwhile the last version
    // seen is kept, so the popup does not blink.
    const lastSeen = useRef<SpecialistOrder | null>(null);
    const viewing =
        viewingId === null
            ? null
            : (orders.data.find((order) => order.id === viewingId) ??
              (viewingAfterStep?.id === viewingId ? viewingAfterStep : null) ??
              (lastSeen.current?.id === viewingId ? lastSeen.current : null));
    lastSeen.current = viewing;

    const showOrderAfterStep = (orderId: number) =>
        router.reload({ only: ['viewing'], data: { viewing: orderId } });

    // The list checks every 10 seconds, so an order released, cancelled or
    // expired elsewhere (the phone, another computer, the buyer) changes by
    // itself: its Release button goes away, also in an open popup.
    const watchedId = viewingId;
    usePoll(
        10000,
        () =>
            watchedId === null
                ? { only: ['orders', 'counts'] }
                : {
                      only: ['orders', 'counts', 'viewing'],
                      data: { viewing: watchedId },
                  },
        { mode: 'rest' },
    );

    const showList = (show: Show, term: string) =>
        router.get(
            OrderController.index().url,
            {
                ...(show === 'placed' ? {} : { show }),
                ...(term.trim() === '' ? {} : { search: term.trim() }),
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );

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
            () => showList(filters.show, search),
            400,
        );

        return () => window.clearTimeout(timer);
        // Only the typed search starts a new search.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    return (
        <>
            <Head title="Orders" />

            <div className="space-y-6">
                <PageHeader
                    title="Orders"
                    description="Orders placed on the storefront by students and STI staff. Scan the buyer's issuance slip and check the cashier's receipt to release the items, or open any order below. Whoever pays first gets the items."
                />

                <SlipScanBox />

                <Panel>
                    <div className="space-y-4 border-b border-slate-100 px-6 py-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <h2 className="font-black text-slate-900">
                                    {chips.find(
                                        (chip) => chip.value === filters.show,
                                    )?.label ?? 'Orders'}
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    {descriptions[filters.show]}
                                </p>
                            </div>
                            <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 lg:max-w-sm">
                                <Search size={18} className="shrink-0" />
                                <input
                                    type="search"
                                    maxLength={120}
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Search by order no. (PW-0042) or name"
                                    className="w-full min-w-0 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                                    aria-label="Search by order number or buyer name"
                                />
                            </label>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {chips.map((chip) => (
                                <button
                                    key={chip.value}
                                    type="button"
                                    onClick={() => showList(chip.value, search)}
                                    className={cn(
                                        'inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition',
                                        filters.show === chip.value
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                                    )}
                                >
                                    {chip.label}
                                    {chip.value !== 'all' && (
                                        <span
                                            className={cn(
                                                'rounded-full px-1.5 text-[11px] font-black',
                                                filters.show === chip.value
                                                    ? 'bg-white/25'
                                                    : 'bg-white',
                                            )}
                                        >
                                            {counts[chip.value].toLocaleString(
                                                'en-PH',
                                            )}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {orders.data.length === 0 ? (
                        <div className="px-6 py-16 text-center">
                            <ShoppingBag
                                size={44}
                                className="mx-auto text-slate-300"
                            />
                            <h3 className="mt-4 text-lg font-black text-slate-800">
                                {filters.search
                                    ? 'No order matches your search'
                                    : 'No orders here'}
                            </h3>
                            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                                {filters.search
                                    ? `Nothing matches "${filters.search}"${filters.show === 'all' ? '' : ' in this tab'}. Check the order number (e.g. PW-0042) or the buyer's name${filters.show === 'all' ? '' : ', or search all orders'}.`
                                    : 'Orders appear here when buyers place them from their cart. You are also notified in the bell.'}
                            </p>
                            {filters.search && (
                                <div className="mt-6 flex flex-wrap justify-center gap-2">
                                    {filters.show !== 'all' && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                showList('all', search)
                                            }
                                            className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700"
                                        >
                                            <Search size={17} />
                                            Search all orders
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearch('');
                                            showList(filters.show, '');
                                        }}
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                                    >
                                        <X size={17} />
                                        Clear search
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <TableScroll stickyActions>
                                <table className="w-full min-w-225">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <TableHeading>Order #</TableHeading>
                                            <TableHeading>Buyer</TableHeading>
                                            <TableHeading>Items</TableHeading>
                                            <TableHeading align="right">
                                                Total
                                            </TableHeading>
                                            <TableHeading>
                                                {filters.show === 'picked_up'
                                                    ? 'Released'
                                                    : filters.show ===
                                                        'cancelled'
                                                      ? 'Cancelled'
                                                      : filters.show ===
                                                          'placed'
                                                        ? 'Waiting'
                                                        : 'Date'}
                                            </TableHeading>
                                            <TableHeading>Status</TableHeading>
                                            <TableHeading align="right">
                                                Actions
                                            </TableHeading>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orders.data.map((order) => (
                                            <OrderTableRow
                                                key={order.id}
                                                order={order}
                                                onView={() =>
                                                    setViewingId(order.id)
                                                }
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </TableScroll>

                            <Pagination pagination={orders} itemName="orders" />
                        </>
                    )}
                </Panel>
            </div>

            <OrderDetailsDialog
                order={viewing}
                onClose={() => setViewingId(null)}
                onActed={showOrderAfterStep}
            />
        </>
    );
}

/** One order: number, student, first item, total, its date, status, View Details. */
function OrderTableRow({
    order,
    onView,
}: {
    order: SpecialistOrder;
    onView: () => void;
}) {
    const [first, ...rest] = order.items;

    return (
        <tr className="border-t border-slate-100 transition hover:bg-slate-50/70">
            <td className="px-5 py-4">
                <p className="font-mono text-sm font-black text-blue-700">
                    {order.number}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                    {formatDateTime(order.placed_at)}
                </p>
            </td>
            <td className="px-5 py-4">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-slate-800">
                    {order.student_name}
                    {order.is_staff && <StaffTag />}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                    {order.student_section ?? '—'}
                </p>
            </td>
            <td className="px-5 py-4">
                {first && (
                    <p className="max-w-64 truncate text-sm text-slate-800">
                        {first.product_name}
                        {first.variant_label && (
                            <span className="text-slate-500">
                                {' '}
                                · {first.variant_label}
                            </span>
                        )}
                    </p>
                )}
                <p className="mt-1 text-xs text-slate-500">
                    {rest.length > 0
                        ? `+ ${rest.length} more ${rest.length === 1 ? 'item' : 'items'}`
                        : first && formatUnits(first.quantity, first.unit_name)}
                </p>
            </td>
            <td className="px-5 py-4 text-right text-base font-black text-slate-900">
                {formatPeso(order.total_centavos)}
            </td>
            <td className="px-5 py-4">
                <OrderDate order={order} />
            </td>
            <td className="px-5 py-4">
                <OrderStatusBadge order={order} />
            </td>
            <td className="px-5 py-4 text-right">
                <button
                    type="button"
                    onClick={onView}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 text-sm font-black whitespace-nowrap text-blue-700 transition hover:bg-blue-100"
                >
                    <Eye size={15} />
                    View Details
                </button>
            </td>
        </tr>
    );
}

/**
 * Orders waiting for payment: how long they have waited, in V1's waiting
 * amber. Others: when they were released or cancelled.
 */
function OrderDate({ order }: { order: SpecialistOrder }) {
    if (order.status === 'placed') {
        const placed = new Date(order.placed_at ?? Date.now());
        const days = Math.max(
            0,
            Math.floor((Date.now() - placed.getTime()) / 86_400_000),
        );

        return (
            <p className="text-sm font-black whitespace-nowrap text-amber-600">
                {days === 0
                    ? 'Today'
                    : `${days} ${days === 1 ? 'day' : 'days'}`}
            </p>
        );
    }
    if (order.status === 'picked_up') {
        return (
            <p className="text-sm whitespace-nowrap text-slate-700">
                {formatDateOrdered(order.picked_up_at)}
                {order.handled_by && (
                    <span className="block text-xs text-slate-500">
                        by {order.handled_by}
                    </span>
                )}
            </p>
        );
    }

    return (
        <p className="text-sm whitespace-nowrap text-slate-700">
            {formatDateOrdered(order.cancelled_at)}
            <span className="block text-xs text-slate-500">
                {order.expired ? 'Expired' : (order.handled_by ?? '')}
            </span>
        </p>
    );
}
