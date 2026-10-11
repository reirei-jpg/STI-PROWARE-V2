import { Head, Link } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    CalendarClock,
    CheckCircle2,
    Clock3,
    History,
    PackageCheck,
    QrCode,
    ShoppingBag,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
import StudentOrderController from '@/actions/App/Http/Controllers/StudentOrderController';
import { OrderStatusBadge } from '@/components/order-items';
import Pagination from '@/components/pagination';
import { formatDateOrdered, formatDateTime, formatPeso } from '@/lib/format';
import { cn } from '@/lib/utils';
import { home } from '@/routes';
import type { OrderRow, Paginated } from '@/types';

type MyOrder = OrderRow & {
    can_cancel: boolean;
    /** The first item's product photo, for the preview. */
    preview_photo_url: string | null;
};

type Show = 'waiting' | 'past';

type StatusCounts = {
    placed: number;
    ready: number;
    picked_up: number;
    cancelled: number;
};

/** Narrows the list on a tab: one status, or all of the tab's orders. */
type Filter = 'all' | MyOrder['status'];

/**
 * The student's orders, laid out like V1's My Orders: four status cards
 * (Placed, Ready for pickup, Released, Cancelled) that open their list,
 * Active Orders / Order History, and a card per order with what happens
 * next, a preview of what is in it, the total and its issuance slip.
 */
export default function MyOrders({
    show,
    counts,
    statusCounts,
    orders,
}: {
    show: Show;
    counts: { waiting: number; past: number };
    statusCounts: StatusCounts;
    orders: Paginated<MyOrder>;
}) {
    const [filter, setFilter] = useState<Filter>('all');
    const shown =
        filter === 'all'
            ? orders.data
            : orders.data.filter((order) => order.status === filter);

    const tabHref = (tab: Show) =>
        StudentOrderController.index({
            query: tab === 'waiting' ? {} : { show: tab },
        });

    const filters: { value: Filter; label: string }[] =
        show === 'waiting'
            ? [
                  { value: 'all', label: 'All active' },
                  { value: 'placed', label: 'Placed' },
                  { value: 'ready', label: 'Ready for pickup' },
              ]
            : [
                  { value: 'all', label: 'All history' },
                  { value: 'picked_up', label: 'Released' },
                  { value: 'cancelled', label: 'Cancelled' },
              ];

    return (
        <>
            <Head title="My Orders" />

            <div className="space-y-6">
                <div>
                    <p className="text-sm font-bold tracking-wide text-blue-600 uppercase">
                        STI PROWARE
                    </p>
                    <h1 className="mt-1 text-3xl font-black text-slate-900">
                        My Orders
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                        Track your orders. Show the issuance slip at the PROWARE
                        office by the pick-up date, pay there, and get your
                        items.
                    </p>
                </div>

                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard
                        title="Placed"
                        value={statusCounts.placed}
                        description="Set aside for you, waiting for you to pay"
                        icon={Clock3}
                        tone="amber"
                        href={tabHref('waiting')}
                        onClick={() => setFilter('placed')}
                    />
                    <SummaryCard
                        title="Ready for Pickup"
                        value={statusCounts.ready}
                        description="Prepared by PROWARE, ready to claim"
                        icon={PackageCheck}
                        tone="green"
                        href={tabHref('waiting')}
                        onClick={() => setFilter('ready')}
                    />
                    <SummaryCard
                        title="Released"
                        value={statusCounts.picked_up}
                        description="Paid and handed over to you"
                        icon={CheckCircle2}
                        tone="slate"
                        href={tabHref('past')}
                        onClick={() => setFilter('picked_up')}
                    />
                    <SummaryCard
                        title="Cancelled"
                        value={statusCounts.cancelled}
                        description="Cancelled, or not picked up in time"
                        icon={XCircle}
                        tone="red"
                        href={tabHref('past')}
                        onClick={() => setFilter('cancelled')}
                    />
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
                    <div className="grid gap-2 sm:grid-cols-2">
                        <TabLink
                            active={show === 'waiting'}
                            href={tabHref('waiting')}
                            icon={PackageCheck}
                            count={counts.waiting}
                            onClick={() => setFilter('all')}
                        >
                            Active Orders
                        </TabLink>
                        <TabLink
                            active={show === 'past'}
                            href={tabHref('past')}
                            icon={History}
                            count={counts.past}
                            onClick={() => setFilter('all')}
                        >
                            Order History
                        </TabLink>
                    </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h2 className="text-xl font-black text-slate-900">
                                {show === 'waiting'
                                    ? 'Active Orders'
                                    : 'Order History'}
                            </h2>
                            <p className="mt-1 text-sm text-slate-500">
                                {shown.length}{' '}
                                {shown.length === 1 ? 'order' : 'orders'} shown
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {filters.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setFilter(option.value)}
                                    className={cn(
                                        'rounded-full border px-4 py-2 text-sm font-bold transition',
                                        filter === option.value
                                            ? 'border-blue-600 bg-blue-600 text-white'
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700',
                                    )}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                {shown.length > 0 ? (
                    <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                        {shown.map((order) => (
                            <OrderCard key={order.id} order={order} />
                        ))}
                    </section>
                ) : (
                    <section className="rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
                        <ShoppingBag
                            size={46}
                            className="mx-auto text-slate-300"
                        />
                        <h2 className="mt-5 text-xl font-black text-slate-800">
                            {orders.data.length === 0
                                ? show === 'waiting'
                                    ? 'No active orders'
                                    : 'No order history yet'
                                : 'No orders in this status'}
                        </h2>
                        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                            {orders.data.length === 0
                                ? show === 'waiting'
                                    ? 'Orders you place from your cart appear here.'
                                    : 'Released and cancelled orders appear here.'
                                : 'Try another filter.'}
                        </p>
                        {orders.data.length === 0 ? (
                            <Link
                                href={home()}
                                className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                            >
                                Shop Merchandise
                            </Link>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setFilter('all')}
                                className="mt-6 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                            >
                                Show All
                            </button>
                        )}
                    </section>
                )}

                {orders.last_page > 1 && (
                    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                        <Pagination pagination={orders} itemName="orders" />
                    </div>
                )}
            </div>
        </>
    );
}

const tones = {
    amber: {
        card: 'border-amber-200 bg-amber-50/60',
        icon: 'bg-amber-100 text-amber-700',
        value: 'text-amber-700',
    },
    green: {
        card: 'border-emerald-200 bg-emerald-50/60',
        icon: 'bg-emerald-100 text-emerald-700',
        value: 'text-emerald-700',
    },
    slate: {
        card: 'border-slate-200 bg-slate-50',
        icon: 'bg-slate-200 text-slate-700',
        value: 'text-slate-700',
    },
    red: {
        card: 'border-red-200 bg-red-50/60',
        icon: 'bg-red-100 text-red-700',
        value: 'text-red-700',
    },
} as const;

/** One status count, as on V1; clicking it shows those orders. */
function SummaryCard({
    title,
    value,
    description,
    icon: Icon,
    tone,
    href,
    onClick,
}: {
    title: string;
    value: number;
    description: string;
    icon: LucideIcon;
    tone: keyof typeof tones;
    href: ReturnType<typeof StudentOrderController.index>;
    onClick: () => void;
}) {
    const style = tones[tone];

    return (
        <Link
            href={href}
            preserveScroll
            // Keeps the status chosen on the card after the list loads.
            preserveState
            onClick={onClick}
            className={cn(
                'w-full rounded-2xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
                style.card,
            )}
        >
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-sm font-bold text-slate-700">{title}</p>
                    <p className={cn('mt-2 text-3xl font-black', style.value)}>
                        {value}
                    </p>
                </div>
                <div
                    className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                        style.icon,
                    )}
                >
                    <Icon size={20} />
                </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
                {description}
            </p>
        </Link>
    );
}

function TabLink({
    active,
    href,
    icon: Icon,
    count,
    onClick,
    children,
}: {
    active: boolean;
    href: ReturnType<typeof StudentOrderController.index>;
    icon: LucideIcon;
    count: number;
    onClick: () => void;
    children: string;
}) {
    return (
        <Link
            href={href}
            preserveScroll
            // Keeps the status chosen on the card after the list loads.
            preserveState
            onClick={onClick}
            className={cn(
                'flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition',
                active
                    ? 'bg-[#0D6EFD] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50',
            )}
        >
            <Icon size={18} />
            {children}
            <span
                className={cn(
                    'rounded-full px-2 py-0.5 text-xs',
                    active ? 'bg-white/25' : 'bg-slate-100 text-slate-600',
                )}
            >
                {count}
            </span>
        </Link>
    );
}

/** What the order's status means for the student, in a sentence. */
function currentStatus(order: MyOrder): { label: string; description: string } {
    const pickUpBy = formatDateOrdered(order.pick_up_by);

    switch (order.status) {
        case 'placed':
            return {
                label: 'Placed',
                description: `Your items are set aside for you. Show the issuance slip and pay at the PROWARE office by ${pickUpBy}.`,
            };
        case 'ready':
            return {
                label: 'Ready for Pickup',
                description: `PROWARE prepared your items. Show the issuance slip and pay at the office by ${pickUpBy}.`,
            };
        case 'picked_up':
            return {
                label: 'Released',
                description: `You paid and got your items on ${formatDateOrdered(order.picked_up_at)}.`,
            };
        default:
            return order.expired
                ? {
                      label: 'Expired',
                      description: `It was not picked up by ${pickUpBy}, so the items went back on sale.`,
                  }
                : {
                      label: 'Cancelled',
                      description: order.cancel_reason
                          ? `Reason: ${order.cancel_reason}`
                          : 'This order was cancelled.',
                  };
    }
}

/**
 * One order, as on V1: order # and date, its status and what it means, a
 * preview of the first item, items and pieces, when to pick it up, the
 * total, and its issuance slip.
 */
function OrderCard({ order }: { order: MyOrder }) {
    const status = currentStatus(order);
    const [first, ...rest] = order.items;
    const pieces = order.items.reduce(
        (total, item) => total + item.quantity * item.pieces_per_unit,
        0,
    );
    const open = order.status === 'placed' || order.status === 'ready';

    return (
        <article className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:shadow-md">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="font-mono text-xs font-black tracking-wide text-blue-600 uppercase">
                        {order.number}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                        {formatDateTime(order.placed_at)}
                    </p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <ShoppingBag size={20} />
                </div>
            </div>

            <div className="mt-5">
                <OrderStatusBadge order={order} />
            </div>

            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-bold tracking-wide text-slate-400 uppercase">
                    Current Status
                </p>
                <p className="mt-2 font-black text-slate-900">{status.label}</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                    {status.description}
                </p>
            </div>

            {first && (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center gap-4">
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
                            {order.preview_photo_url ? (
                                <img
                                    src={order.preview_photo_url}
                                    alt={first.product_name}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <ShoppingBag
                                    size={28}
                                    className="text-slate-300"
                                />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="truncate text-base font-black text-slate-900">
                                {first.product_name}
                            </h3>
                            {first.variant_label && (
                                <p className="mt-1 text-sm font-medium text-slate-600">
                                    {first.variant_label}
                                </p>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600 shadow-sm">
                                    Qty {first.quantity}
                                </span>
                                {rest.length > 0 && (
                                    <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-black text-blue-700">
                                        + {rest.length} more{' '}
                                        {rest.length === 1 ? 'item' : 'items'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
                <InfoBox label="Items" value={String(order.items.length)} />
                <InfoBox label="Pieces" value={String(pieces)} />
            </div>

            {open && <PickUpBy date={order.pick_up_by} />}

            <div className="mt-5 flex items-end justify-between gap-4 border-t border-slate-100 pt-5">
                <p className="text-xs text-slate-400">Total to pay</p>
                <p className="text-xl font-black text-slate-900">
                    {formatPeso(order.total_centavos)}
                </p>
            </div>

            {order.status !== 'cancelled' && (
                <Link
                    href={StudentOrderController.slip(order.id)}
                    className={cn(
                        'mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition',
                        open
                            ? 'bg-[#0D6EFD] text-white hover:bg-blue-700'
                            : 'border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
                    )}
                >
                    <QrCode size={17} />
                    {open ? 'Show Issuance Slip' : 'View Issuance Slip'}
                </Link>
            )}
        </article>
    );
}

/** The last day to pick it up, in V1's date colors (red passed, amber today, blue later). */
function PickUpBy({ date }: { date: string }) {
    const due = new Date(`${date}T00:00:00`).getTime();
    const now = new Date();
    const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
    ).getTime();
    const tone =
        due < today
            ? 'bg-red-50 text-red-700'
            : due === today
              ? 'bg-amber-50 text-amber-700'
              : 'bg-blue-50 text-blue-700';

    return (
        <div
            className={cn(
                'mt-3 flex items-center gap-3 rounded-2xl px-4 py-3',
                tone,
            )}
        >
            <CalendarClock size={17} className="shrink-0" />
            <div>
                <p className="text-xs font-bold tracking-wide uppercase opacity-80">
                    Pick up by
                </p>
                <p className="text-sm font-black">
                    {due === today
                        ? 'Today (last day)'
                        : formatDateOrdered(date)}
                    {due < today && ' (date passed)'}
                </p>
            </div>
        </div>
    );
}

function InfoBox({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold tracking-wide text-slate-400 uppercase">
                {label}
            </p>
            <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
        </div>
    );
}
