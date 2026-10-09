import { Link, router } from '@inertiajs/react';
import {
    Banknote,
    CheckCircle2,
    Circle,
    LoaderCircle,
    PackageCheck,
    QrCode,
    ShoppingBag,
    Undo2,
    X,
    XCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import OrderController from '@/actions/App/Http/Controllers/OrderController';
import OrderItems, { OrderStatusBadge } from '@/components/order-items';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDateOrdered, formatDateTime, formatPeso } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { SpecialistOrderRow } from '@/types';

/**
 * One student's order on the Specialist's Student Orders page, opened with
 * View Details: the student, every item with its price, the total, what
 * happened so far (placed, ready, released or cancelled, and by whom), and
 * only the steps that apply: Ready for pickup, Release once the student
 * has paid (the items leave the shelf only then), Undo release (same day),
 * Open slip, and Cancel (asks for the reason the student will see).
 */
export default function OrderDetailsDialog({
    order,
    onClose,
    onCancel,
}: {
    order: SpecialistOrderRow | null;
    onClose: () => void;
    onCancel: (order: SpecialistOrderRow) => void;
}) {
    const [paid, setPaid] = useState(false);
    const [busy, setBusy] = useState(false);

    // A fresh tick for every order and every change of status.
    useEffect(() => {
        setPaid(false);
    }, [order?.id, order?.status]);

    const act = (url: string, data: Record<string, boolean> = {}) => {
        setBusy(true);
        router.post(url, data, {
            preserveScroll: true,
            onFinish: () => setBusy(false),
        });
    };

    const isOpen = order?.status === 'placed' || order?.status === 'ready';

    return (
        <Dialog
            open={order !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-2xl [&>button:last-child]:hidden">
                {order && (
                    <>
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                            <div className="flex items-start gap-3">
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                                    <ShoppingBag size={22} />
                                </span>
                                <div>
                                    <DialogTitle className="flex flex-wrap items-center gap-2 text-lg font-black text-slate-900">
                                        Order {order.number}
                                        <OrderStatusBadge order={order} />
                                    </DialogTitle>
                                    <DialogDescription className="text-sm text-slate-500">
                                        <span className="font-bold text-slate-700">
                                            {order.student_name}
                                        </span>
                                        {order.student_section &&
                                            ` · ${order.student_section}`}
                                        {' · '}
                                        {order.items.length}{' '}
                                        {order.items.length === 1
                                            ? 'item'
                                            : 'items'}
                                    </DialogDescription>
                                </div>
                            </div>
                            <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                                <X size={20} />
                                <span className="sr-only">Close</span>
                            </DialogClose>
                        </div>

                        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
                            <section>
                                <h3 className="text-xs font-black tracking-wide text-slate-400 uppercase">
                                    Items
                                </h3>
                                <div className="mt-2 rounded-2xl border border-slate-100 bg-slate-50/60">
                                    <OrderItems order={order} />
                                </div>
                            </section>

                            <section>
                                <h3 className="text-xs font-black tracking-wide text-slate-400 uppercase">
                                    History
                                </h3>
                                <ol className="mt-2 space-y-2.5">
                                    <HistoryStep done>
                                        Placed {formatDateTime(order.placed_at)}
                                        <span className="text-slate-500">
                                            {' '}
                                            · pick up by{' '}
                                            {formatDateOrdered(
                                                order.pick_up_by,
                                            )}
                                        </span>
                                    </HistoryStep>
                                    {order.status !== 'cancelled' && (
                                        <HistoryStep
                                            done={order.ready_at !== null}
                                        >
                                            {order.ready_at
                                                ? `Ready for pickup ${formatDateTime(order.ready_at)}`
                                                : 'Ready for pickup: not yet'}
                                        </HistoryStep>
                                    )}
                                    {order.status === 'cancelled' ? (
                                        <HistoryStep done tone="red">
                                            {order.expired
                                                ? `Expired: not released by ${formatDateOrdered(order.pick_up_by)}`
                                                : `Cancelled ${formatDateTime(order.cancelled_at)}`}
                                            {!order.expired &&
                                                order.handled_by &&
                                                ` by ${order.handled_by}`}
                                            {!order.expired &&
                                                order.cancel_reason && (
                                                    <span className="block text-slate-500">
                                                        Reason:{' '}
                                                        {order.cancel_reason}
                                                    </span>
                                                )}
                                        </HistoryStep>
                                    ) : (
                                        <HistoryStep
                                            done={order.status === 'picked_up'}
                                        >
                                            {order.status === 'picked_up'
                                                ? `Released ${formatDateTime(order.picked_up_at)}${order.handled_by ? ` by ${order.handled_by}` : ''}`
                                                : 'Released: not yet'}
                                        </HistoryStep>
                                    )}
                                </ol>
                            </section>

                            {isOpen && (
                                <section className="space-y-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                                    <h3 className="text-xs font-black tracking-wide text-emerald-800 uppercase">
                                        Release
                                    </h3>
                                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 transition has-checked:border-emerald-400 has-checked:bg-emerald-50">
                                        <input
                                            type="checkbox"
                                            checked={paid}
                                            onChange={(event) =>
                                                setPaid(event.target.checked)
                                            }
                                            className="mt-0.5 size-5 accent-emerald-600"
                                        />
                                        The student has paid{' '}
                                        {formatPeso(order.total_centavos)}.
                                    </label>
                                    <button
                                        type="button"
                                        disabled={!paid || busy}
                                        onClick={() =>
                                            act(
                                                OrderController.release(
                                                    order.id,
                                                ).url,
                                                { paid: true },
                                            )
                                        }
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {busy ? (
                                            <LoaderCircle
                                                size={17}
                                                className="animate-spin"
                                            />
                                        ) : (
                                            <Banknote size={17} />
                                        )}
                                        Release the items
                                    </button>
                                </section>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-6 py-4">
                            <div className="flex flex-wrap gap-2">
                                {order.status === 'placed' && (
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                            act(
                                                OrderController.ready(order.id)
                                                    .url,
                                            )
                                        }
                                        className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-60"
                                    >
                                        <PackageCheck size={16} />
                                        Ready for pickup
                                    </button>
                                )}
                                {order.can_undo_release && (
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                            act(
                                                OrderController.undoRelease(
                                                    order.id,
                                                ).url,
                                            )
                                        }
                                        title="Released by mistake? Put it back to Ready for pickup (today only)."
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                                    >
                                        <Undo2 size={16} />
                                        Undo release
                                    </button>
                                )}
                                {order.status !== 'cancelled' && (
                                    <Link
                                        href={OrderController.slip({
                                            query: {
                                                code:
                                                    order.slip_code ??
                                                    order.number ??
                                                    '',
                                            },
                                        })}
                                        className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-black text-blue-700 transition hover:bg-blue-100"
                                    >
                                        <QrCode size={16} />
                                        Open slip
                                    </Link>
                                )}
                            </div>
                            {isOpen && (
                                <button
                                    type="button"
                                    onClick={() => onCancel(order)}
                                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-black text-red-700 transition hover:bg-red-100"
                                >
                                    <XCircle size={16} />
                                    Cancel order
                                </button>
                            )}
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

function HistoryStep({
    done,
    tone = 'green',
    children,
}: {
    done: boolean;
    tone?: 'green' | 'red';
    children: ReactNode;
}) {
    return (
        <li className="flex items-start gap-2.5 text-sm">
            {done ? (
                tone === 'red' ? (
                    <XCircle
                        size={18}
                        className="mt-0.5 shrink-0 text-red-500"
                    />
                ) : (
                    <CheckCircle2
                        size={18}
                        className="mt-0.5 shrink-0 text-emerald-500"
                    />
                )
            ) : (
                <Circle size={18} className="mt-0.5 shrink-0 text-slate-300" />
            )}
            <span
                className={cn(
                    done ? 'font-semibold text-slate-800' : 'text-slate-400',
                )}
            >
                {children}
            </span>
        </li>
    );
}
