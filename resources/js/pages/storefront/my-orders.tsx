import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, ChevronRight, Package, QrCode } from 'lucide-react';
import StudentOrderController from '@/actions/App/Http/Controllers/StudentOrderController';
import { OrderStatusBadge } from '@/components/order-items';
import Pagination from '@/components/pagination';
import { formatDateOrdered, formatPeso } from '@/lib/format';
import { cn } from '@/lib/utils';
import { home } from '@/routes';
import type { OrderRow, Paginated } from '@/types';

type MyOrder = OrderRow & { can_cancel: boolean };

type Show = 'waiting' | 'past';

/** V1's status colors for the stripe: amber waiting, green good news, red cancelled. */
const stripeClasses: Record<MyOrder['status'], string> = {
    placed: 'border-l-amber-400',
    ready: 'border-l-emerald-500',
    picked_up: 'border-l-emerald-500',
    cancelled: 'border-l-red-400',
};

/**
 * The student's orders, one short row each: Waiting (not released yet,
 * the most urgent pick-up date first) by default, or Past. A row opens the
 * order's issuance slip, which has the items, what to do next, and Cancel.
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
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">
                            My Orders
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Open an order to show its issuance slip at the
                            PROWARE office by its pick-up date, and pay there.
                        </p>
                    </div>
                    <Link
                        href={home()}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                        <ArrowLeft size={17} />
                        Back to the store
                    </Link>
                </div>

                <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                    <Tab current={show} value="waiting" count={counts.waiting}>
                        Waiting
                    </Tab>
                    <Tab current={show} value="past" count={counts.past}>
                        Past
                    </Tab>
                </div>

                {orders.data.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                        <Package size={40} className="mx-auto text-slate-300" />
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
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                        <ul className="divide-y divide-slate-100">
                            {orders.data.map((order) => (
                                <OrderLine key={order.id} order={order} />
                            ))}
                        </ul>
                        <div className="border-t border-slate-100">
                            <Pagination pagination={orders} itemName="orders" />
                        </div>
                    </div>
                )}
            </div>
        </>
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
                'inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-black transition',
                chosen
                    ? 'bg-[#0D6EFD] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50',
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

/** One order: number, status, items and total, and when to pick it up or how it ended. */
function OrderLine({ order }: { order: MyOrder }) {
    const itemCount = order.items.length;

    return (
        <li>
            <Link
                href={StudentOrderController.slip(order.id)}
                className={cn(
                    'flex items-center gap-4 border-l-4 px-5 py-4 transition hover:bg-slate-50',
                    stripeClasses[order.status],
                )}
            >
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-slate-900">
                            {order.number}
                        </span>
                        <OrderStatusBadge order={order} />
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                        {itemCount} {itemCount === 1 ? 'item' : 'items'} ·{' '}
                        <span className="font-black text-slate-900">
                            {formatPeso(order.total_centavos)}
                        </span>
                    </p>
                    <OrderWhen order={order} />
                </div>
                {order.status !== 'cancelled' && (
                    <span className="hidden items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-black text-blue-700 sm:inline-flex">
                        <QrCode size={16} />
                        Issuance Slip
                    </span>
                )}
                <ChevronRight size={18} className="shrink-0 text-slate-400" />
            </Link>
        </li>
    );
}

/**
 * When to pick it up, in V1's date colors (red passed, amber today, blue
 * later), or how it ended.
 */
function OrderWhen({ order }: { order: MyOrder }) {
    if (order.status === 'placed' || order.status === 'ready') {
        const due = new Date(`${order.pick_up_by}T00:00:00`).getTime();
        const now = new Date();
        const today = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
        ).getTime();
        const tone =
            due < today
                ? 'text-red-600'
                : due === today
                  ? 'text-amber-600'
                  : 'text-blue-700';

        return (
            <p className={cn('mt-0.5 text-xs font-bold', tone)}>
                {due === today
                    ? 'Last day to pick up is today'
                    : `Pick up by ${formatDateOrdered(order.pick_up_by)}`}
            </p>
        );
    }

    return (
        <p className="mt-0.5 text-xs text-slate-500">
            {order.status === 'picked_up'
                ? `Released ${formatDateOrdered(order.picked_up_at)}`
                : order.expired
                  ? `Expired: not picked up by ${formatDateOrdered(order.pick_up_by)}`
                  : `Cancelled ${formatDateOrdered(order.cancelled_at)}`}
        </p>
    );
}
