import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    Banknote,
    CheckCircle2,
    Clock,
    Package,
    PackageCheck,
    QrCode,
    ShoppingBag,
    Store,
    XCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';
import StudentOrderController from '@/actions/App/Http/Controllers/StudentOrderController';
import { OrderStatusBadge } from '@/components/order-items';
import Pagination from '@/components/pagination';
import { formatDateOrdered, formatPeso } from '@/lib/format';
import { cn } from '@/lib/utils';
import { home } from '@/routes';
import type { OrderRow, Paginated } from '@/types';

type MyOrder = OrderRow & { can_cancel: boolean };

type Show = 'waiting' | 'past';

/**
 * The student's orders as cards: Waiting (not released yet, the most urgent
 * pick-up date first) by default, or Past. A banner shows the three steps
 * (order, show the slip and pay, pick up). Each card has the order's
 * progress, what is in it, the total, the days left to pick it up, and a
 * button to its issuance slip (which also has Cancel).
 */
export default function MyOrders({
    show,
    counts,
    orders,
}: {
    show: Show;
    counts: { waiting: number; past: number };
    orders: Paginated<MyOrder>;
}) {
    return (
        <>
            <Head title="My Orders" />

            <div className="space-y-6">
                <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-[#0D6EFD] via-blue-600 to-blue-800 px-6 py-7 text-white shadow-xl shadow-blue-500/20 md:px-8">
                    <span
                        aria-hidden="true"
                        className="absolute -top-16 -right-10 h-48 w-48 rounded-full bg-yellow-300/25 blur-2xl"
                    />
                    <div className="relative flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h1 className="flex items-center gap-2 text-2xl font-black md:text-3xl">
                                <Package size={28} />
                                My Orders
                            </h1>
                            <p className="mt-1 text-sm text-blue-50">
                                Pay and pick up at the PROWARE office before the
                                last day.
                            </p>
                        </div>
                        <Link
                            href={home()}
                            className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/15 px-4 text-sm font-black text-white transition hover:bg-white/25"
                        >
                            <ArrowLeft size={17} />
                            Back to the store
                        </Link>
                    </div>

                    <ol className="relative mt-5 grid gap-2 sm:grid-cols-3">
                        <HowStep number={1} icon={<ShoppingBag size={18} />}>
                            Place your order
                        </HowStep>
                        <HowStep number={2} icon={<QrCode size={18} />}>
                            Show your issuance slip and pay
                        </HowStep>
                        <HowStep number={3} icon={<PackageCheck size={18} />}>
                            Get your items
                        </HowStep>
                    </ol>
                </section>

                <div className="flex gap-2">
                    <Tab current={show} value="waiting" count={counts.waiting}>
                        Waiting
                    </Tab>
                    <Tab current={show} value="past" count={counts.past}>
                        Past
                    </Tab>
                </div>

                {orders.data.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                        <Package size={44} className="mx-auto text-slate-300" />
                        <h2 className="mt-3 text-lg font-black text-slate-800">
                            {show === 'waiting'
                                ? 'No orders waiting'
                                : 'No past orders yet'}
                        </h2>
                        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                            {show === 'waiting'
                                ? 'Add items to your cart, then tap Place Order.'
                                : 'Released and cancelled orders show here.'}
                        </p>
                        {show === 'waiting' && (
                            <Link
                                href={home()}
                                className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-[#0D6EFD] px-5 text-sm font-black text-white shadow-md shadow-blue-500/25 transition hover:bg-blue-700"
                            >
                                <Store size={17} />
                                Go shopping
                            </Link>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="grid gap-4 lg:grid-cols-2">
                            {orders.data.map((order) => (
                                <OrderCard key={order.id} order={order} />
                            ))}
                        </div>
                        <div className="overflow-hidden rounded-2xl">
                            <Pagination pagination={orders} itemName="orders" />
                        </div>
                    </>
                )}
            </div>
        </>
    );
}

function HowStep({
    number,
    icon,
    children,
}: {
    number: number;
    icon: ReactNode;
    children: string;
}) {
    return (
        <li className="flex items-center gap-3 rounded-2xl bg-white/12 px-4 py-3 text-sm font-bold">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-300 text-sm font-black text-blue-900">
                {number}
            </span>
            <span className="text-blue-100">{icon}</span>
            {children}
        </li>
    );
}

function Tab({
    current,
    value,
    count,
    children,
}: {
    current: Show;
    value: Show;
    count: number;
    children: string;
}) {
    const chosen = current === value;

    return (
        <Link
            href={StudentOrderController.index({
                query: value === 'waiting' ? {} : { show: value },
            })}
            preserveScroll
            className={cn(
                'inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-black transition',
                chosen
                    ? 'bg-[#0D6EFD] text-white shadow-md shadow-blue-500/25'
                    : 'bg-white text-slate-600 shadow-sm hover:bg-blue-50 hover:text-blue-700',
            )}
        >
            {children}
            <span
                className={cn(
                    'rounded-full px-2 py-0.5 text-xs',
                    chosen ? 'bg-white/25' : 'bg-slate-100 text-slate-600',
                )}
            >
                {count}
            </span>
        </Link>
    );
}

/**
 * Whole days from today to the pick-up date: 0 today, negative when it
 * passed.
 */
function daysLeft(pickUpBy: string): number {
    const due = new Date(`${pickUpBy}T00:00:00`).getTime();
    const now = new Date();
    const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
    ).getTime();

    return Math.round((due - today) / 86_400_000);
}

/**
 * One order: number and status, its progress, what is in it, the total,
 * when to pick it up (or how it ended), and the button to its slip.
 */
function OrderCard({ order }: { order: MyOrder }) {
    const open = order.status === 'placed' || order.status === 'ready';
    const [first, ...rest] = order.items;
    const pieces = order.items.reduce(
        (total, item) => total + item.quantity * item.pieces_per_unit,
        0,
    );

    return (
        <article
            className={cn(
                'flex flex-col overflow-hidden rounded-3xl border bg-white shadow-sm transition hover:shadow-md',
                order.status === 'ready'
                    ? 'border-emerald-300 ring-2 ring-emerald-100'
                    : 'border-slate-200',
                order.status === 'cancelled' && 'opacity-75',
            )}
        >
            <div className="flex items-start justify-between gap-3 px-5 pt-5">
                <div>
                    <p className="text-xs font-bold tracking-wide text-slate-400 uppercase">
                        Order
                    </p>
                    <p className="font-mono text-xl font-black text-slate-900">
                        {order.number}
                    </p>
                </div>
                <OrderStatusBadge order={order} />
            </div>

            <div className="px-5 pt-4">
                <Progress order={order} />
            </div>

            <div className="mx-5 mt-4 rounded-2xl bg-slate-50 px-4 py-3">
                {first && (
                    <p className="truncate text-sm font-bold text-slate-800">
                        {first.product_name}
                        {first.variant_label && (
                            <span className="font-semibold text-slate-500">
                                {' '}
                                ({first.variant_label})
                            </span>
                        )}
                        <span className="font-semibold text-slate-500">
                            {' '}
                            × {first.quantity}
                        </span>
                    </p>
                )}
                <div className="mt-1 flex items-end justify-between gap-3">
                    <p className="text-xs text-slate-500">
                        {rest.length > 0
                            ? `+ ${rest.length} more ${rest.length === 1 ? 'item' : 'items'} · `
                            : ''}
                        {pieces} {pieces === 1 ? 'piece' : 'pieces'}
                    </p>
                    <p className="text-xl font-black text-blue-700">
                        {formatPeso(order.total_centavos)}
                    </p>
                </div>
            </div>

            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <When order={order} />
                {order.status !== 'cancelled' && (
                    <Link
                        href={StudentOrderController.slip(order.id)}
                        className={cn(
                            'inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-black shadow-sm transition',
                            order.status === 'ready'
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : open
                                  ? 'bg-[#0D6EFD] text-white hover:bg-blue-700'
                                  : 'border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
                        )}
                    >
                        <QrCode size={17} />
                        {order.status === 'ready'
                            ? 'Show slip and pay'
                            : 'Issuance slip'}
                    </Link>
                )}
            </div>
        </article>
    );
}

/**
 * Placed → Ready for pickup → Released, the current step highlighted; a
 * cancelled or expired order shows where it stopped, in red.
 */
function Progress({ order }: { order: MyOrder }) {
    const reached =
        order.status === 'picked_up'
            ? 3
            : order.status === 'ready' || order.ready_at !== null
              ? 2
              : 1;
    const cancelled = order.status === 'cancelled';
    const steps = ['Placed', 'Ready for pickup', 'Released'];

    return (
        <ol className="flex items-center">
            {steps.map((label, index) => {
                const done = index < reached;
                const isLast = index === steps.length - 1;
                const stopped = cancelled && index === reached;

                return (
                    <li
                        key={label}
                        className={cn('flex items-center', !isLast && 'flex-1')}
                    >
                        <span className="flex flex-col items-center gap-1">
                            <span
                                className={cn(
                                    'flex h-7 w-7 items-center justify-center rounded-full',
                                    stopped
                                        ? 'bg-red-100 text-red-600'
                                        : done
                                          ? 'bg-emerald-500 text-white'
                                          : 'bg-slate-100 text-slate-400',
                                )}
                            >
                                {stopped ? (
                                    <XCircle size={16} />
                                ) : done ? (
                                    <CheckCircle2 size={16} />
                                ) : (
                                    <span className="text-xs font-black">
                                        {index + 1}
                                    </span>
                                )}
                            </span>
                            <span
                                className={cn(
                                    'text-[11px] font-bold whitespace-nowrap',
                                    stopped
                                        ? 'text-red-600'
                                        : done
                                          ? 'text-slate-800'
                                          : 'text-slate-400',
                                )}
                            >
                                {stopped
                                    ? order.expired
                                        ? 'Expired'
                                        : 'Cancelled'
                                    : label}
                            </span>
                        </span>
                        {!isLast && (
                            <span
                                className={cn(
                                    'mx-2 mb-5 h-1 flex-1 rounded-full',
                                    index + 1 < reached
                                        ? 'bg-emerald-500'
                                        : 'bg-slate-100',
                                )}
                            />
                        )}
                    </li>
                );
            })}
        </ol>
    );
}

/**
 * Days left to pick it up in V1's date colors (blue later, amber today, red
 * passed), or how it ended.
 */
function When({ order }: { order: MyOrder }) {
    if (order.status === 'placed' || order.status === 'ready') {
        const days = daysLeft(order.pick_up_by);
        const tone =
            days < 0
                ? 'bg-red-50 text-red-700'
                : days === 0
                  ? 'bg-amber-50 text-amber-800'
                  : 'bg-blue-50 text-blue-700';

        return (
            <div
                className={cn(
                    'flex items-center gap-2 rounded-xl px-3 py-2',
                    tone,
                )}
            >
                <Clock size={16} className="shrink-0" />
                <div className="leading-tight">
                    <p className="text-sm font-black">
                        {days < 0
                            ? 'Pick-up date passed'
                            : days === 0
                              ? 'Last day today'
                              : days === 1
                                ? '1 day left'
                                : `${days} days left`}
                    </p>
                    <p className="text-[11px] font-semibold opacity-80">
                        Pick up by {formatDateOrdered(order.pick_up_by)}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <p className="flex items-center gap-2 text-sm font-bold text-slate-500">
            {order.status === 'picked_up' ? (
                <>
                    <Banknote size={16} className="text-emerald-600" />
                    Paid and released {formatDateOrdered(order.picked_up_at)}
                </>
            ) : (
                <>
                    <XCircle size={16} className="text-red-500" />
                    {order.expired
                        ? `Expired: not picked up by ${formatDateOrdered(order.pick_up_by)}`
                        : `Cancelled ${formatDateOrdered(order.cancelled_at)}`}
                </>
            )}
        </p>
    );
}
