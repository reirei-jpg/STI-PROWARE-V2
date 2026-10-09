import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Banknote,
    LoaderCircle,
    Package,
    QrCode,
} from 'lucide-react';
import { useState } from 'react';
import StudentOrderController from '@/actions/App/Http/Controllers/StudentOrderController';
import OrderItems, { OrderStatusBadge } from '@/components/order-items';
import Pagination from '@/components/pagination';
import { formatDateOrdered, formatDateTime, formatPeso } from '@/lib/format';
import { cn } from '@/lib/utils';
import { home } from '@/routes';
import type { OrderRow, Paginated } from '@/types';

type MyOrder = OrderRow & { can_cancel: boolean };

/**
 * The student's orders: each one's issuance slip to show at the PROWARE
 * office by its pick-up date, what to pay, and a Cancel button while the
 * office has not prepared the order yet.
 */
export default function MyOrders({ orders }: { orders: Paginated<MyOrder> }) {
    const [confirming, setConfirming] = useState<number | null>(null);
    const [cancelling, setCancelling] = useState<number | null>(null);

    const cancel = (order: MyOrder) => {
        setCancelling(order.id);
        router.post(
            StudentOrderController.cancel(order.id).url,
            {},
            {
                preserveScroll: true,
                onFinish: () => {
                    setCancelling(null);
                    setConfirming(null);
                },
            },
        );
    };

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
                            Show your order's issuance slip at the PROWARE
                            office by its pick-up date and pay there, or the
                            order is cancelled.
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

                {orders.data.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                        <Package size={40} className="mx-auto text-slate-300" />
                        <h2 className="mt-3 text-lg font-black text-slate-800">
                            No orders yet
                        </h2>
                        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                            Add items to your cart, then tap Place Order.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {orders.data.map((order) => (
                            <article
                                key={order.id}
                                className={cn(
                                    'overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm',
                                    !['placed', 'ready'].includes(
                                        order.status,
                                    ) && 'opacity-75',
                                )}
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                                    <div>
                                        <p className="text-lg font-black text-slate-900">
                                            Order {order.number}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            Placed{' '}
                                            {formatDateTime(order.placed_at)}
                                        </p>
                                    </div>
                                    <OrderStatusBadge order={order} />
                                </div>

                                <OrderItems order={order} />

                                <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                    <StudentNextStep order={order} />

                                    <div className="flex flex-wrap items-center gap-2">
                                        {order.status !== 'cancelled' && (
                                            <Link
                                                href={StudentOrderController.slip(
                                                    order.id,
                                                )}
                                                className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-blue-700"
                                            >
                                                <QrCode size={16} />
                                                Issuance Slip
                                            </Link>
                                        )}

                                        {order.can_cancel &&
                                            (confirming === order.id ? (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="font-bold text-slate-700">
                                                        Cancel this order?
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setConfirming(null)
                                                        }
                                                        className="rounded-lg border border-slate-200 px-3 py-1.5 font-black text-slate-700 hover:bg-slate-50"
                                                    >
                                                        Keep it
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            cancel(order)
                                                        }
                                                        disabled={
                                                            cancelling ===
                                                            order.id
                                                        }
                                                        className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 font-black text-white hover:bg-red-700 disabled:opacity-60"
                                                    >
                                                        {cancelling ===
                                                            order.id && (
                                                            <LoaderCircle
                                                                size={14}
                                                                className="animate-spin"
                                                            />
                                                        )}
                                                        Cancel order
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setConfirming(order.id)
                                                    }
                                                    className="self-start rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-red-700 hover:bg-red-50 sm:self-auto"
                                                >
                                                    Cancel
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            </article>
                        ))}

                        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                            <Pagination pagination={orders} itemName="orders" />
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

function StudentNextStep({ order }: { order: MyOrder }) {
    if (order.status === 'placed' || order.status === 'ready') {
        return (
            <p className="flex items-start gap-2 text-sm text-slate-700">
                <Banknote
                    size={18}
                    className="mt-0.5 shrink-0 text-emerald-600"
                />
                <span>
                    {order.status === 'ready'
                        ? 'Ready at the PROWARE office. '
                        : 'The PROWARE office is preparing it. '}
                    Show its issuance slip there by{' '}
                    <strong>{formatDateOrdered(order.pick_up_by)}</strong> and
                    pay <strong>{formatPeso(order.total_centavos)}</strong>.
                </span>
            </p>
        );
    }

    if (order.status === 'picked_up') {
        return (
            <p className="text-sm text-slate-600">
                Released {formatDateTime(order.picked_up_at)}.
            </p>
        );
    }

    return (
        <p className="text-sm text-slate-600">
            {order.expired
                ? `Not picked up by ${formatDateOrdered(order.pick_up_by)}, so it was cancelled`
                : `Cancelled ${formatDateTime(order.cancelled_at)}`}
            {!order.expired &&
                order.cancel_reason &&
                ` · ${order.cancel_reason}`}
        </p>
    );
}
