import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, ChevronRight, Package } from 'lucide-react';
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
 * The student's orders, one clean row each: Waiting (not released yet, the
 * most urgent pick-up date first) by default, or Past. A row opens the
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

            <div className="mx-auto max-w-3xl space-y-5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">
                            My Orders
                        </h1>
                        <p className="mt-0.5 text-sm text-slate-500">
                            Show the slip at the PROWARE office and pay there.
                        </p>
                    </div>
                    <Link
                        href={home()}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                        <ArrowLeft size={16} />
                        Store
                    </Link>
                </div>

                <div className="flex gap-2">
                    <Tab current={show} value="waiting" count={counts.waiting}>
                        Waiting
                    </Tab>
                    <Tab current={show} value="past" count={counts.past}>
                        Past
                    </Tab>
                </div>

                {orders.data.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
                        <Package size={36} className="mx-auto text-slate-300" />
                        <p className="mt-3 font-bold text-slate-700">
                            {show === 'waiting'
                                ? 'No orders waiting'
                                : 'No past orders yet'}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                            {show === 'waiting'
                                ? 'Add items to your cart, then tap Place Order.'
                                : 'Released and cancelled orders show here.'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        <ul className="divide-y divide-slate-100">
                            {orders.data.map((order) => (
                                <OrderLine key={order.id} order={order} />
                            ))}
                        </ul>
                        <Pagination pagination={orders} itemName="orders" />
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
                'inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-bold transition',
                chosen
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
            )}
        >
            {children}
            <span className={cn(chosen ? 'text-white/70' : 'text-slate-400')}>
                {count}
            </span>
        </Link>
    );
}

/** One order: number, status, first item, total, and when to pick it up. */
function OrderLine({ order }: { order: MyOrder }) {
    const [first, ...rest] = order.items;

    return (
        <li>
            <Link
                href={StudentOrderController.slip(order.id)}
                className="flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50"
            >
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-slate-900">
                            {order.number}
                        </span>
                        <OrderStatusBadge order={order} />
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-600">
                        {first?.product_name}
                        {first?.variant_label && ` (${first.variant_label})`}
                        {rest.length > 0 && ` + ${rest.length} more`}
                    </p>
                </div>

                <div className="shrink-0 text-right">
                    <p className="font-black text-slate-900">
                        {formatPeso(order.total_centavos)}
                    </p>
                    <OrderWhen order={order} />
                </div>

                <ChevronRight size={18} className="shrink-0 text-slate-300" />
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

        return (
            <p
                className={cn(
                    'mt-0.5 text-xs font-bold',
                    due < today
                        ? 'text-red-600'
                        : due === today
                          ? 'text-amber-600'
                          : 'text-blue-700',
                )}
            >
                {due < today
                    ? 'Date passed'
                    : due === today
                      ? 'Last day today'
                      : `Pick up by ${formatDateOrdered(order.pick_up_by)}`}
            </p>
        );
    }

    return (
        <p className="mt-0.5 text-xs text-slate-400">
            {order.status === 'picked_up'
                ? `Released ${formatDateOrdered(order.picked_up_at)}`
                : order.expired
                  ? 'Expired'
                  : `Cancelled ${formatDateOrdered(order.cancelled_at)}`}
        </p>
    );
}
