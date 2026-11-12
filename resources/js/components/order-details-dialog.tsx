import { Link, router } from '@inertiajs/react';
import {
    Banknote,
    CheckCircle2,
    Circle,
    LoaderCircle,
    QrCode,
    ShoppingBag,
    X,
    XCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import OrderController from '@/actions/App/Http/Controllers/OrderController';
import ConfirmDialog from '@/components/confirm-dialog';
import OrderItems, { OrderStatusBadge } from '@/components/order-items';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import StaffTag from '@/components/staff-tag';
import { formatDateOrdered, formatDateTime, formatPeso } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { SpecialistOrderRow } from '@/types';

/**
 * One student's order on the Specialist's Student Orders page, opened with
 * View Details: the student, every item with its price, the total, what
 * happened so far (placed, released or cancelled, and by whom), and only the
 * steps that apply: Release once the buyer has paid (the items leave the
 * shelf only then, as many as are left; a release is final) and Open slip.
 * Only the buyer can cancel an order.
 */
export default function OrderDetailsDialog({
    order,
    onClose,
    onActed,
}: {
    order: SpecialistOrderRow | null;
    onClose: () => void;
    /** After a step worked, e.g. to keep showing the order once it moved tabs. */
    onActed?: (orderId: number) => void;
}) {
    const [paid, setPaid] = useState(false);
    const [busy, setBusy] = useState(false);
    const [confirmingRelease, setConfirmingRelease] = useState(false);

    // A fresh tick for every order and every change of status.
    useEffect(() => {
        setPaid(false);
    }, [order?.id, order?.status]);

    const act = (url: string, data: Record<string, boolean> = {}) => {
        const orderId = order?.id;
        setBusy(true);
        router.post(url, data, {
            preserveScroll: true,
            onSuccess: () => {
                if (orderId !== undefined) {
                    onActed?.(orderId);
                }
            },
            onFinish: () => {
                setBusy(false);
                setConfirmingRelease(false);
            },
        });
    };

    const isOpen = order?.status === 'placed';

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
                                        {order.is_staff && (
                                            <>
                                                {' '}
                                                <StaffTag />
                                            </>
                                        )}
                                        {order.student_id &&
                                            ` · ID ${order.student_id}`}
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
                                    </HistoryStep>
                                    {order.status === 'cancelled' ? (
                                        <HistoryStep done tone="red">
                                            {order.expired
                                                ? `Expired: not released by ${order.pick_up_by ? formatDateOrdered(order.pick_up_by) : 'its pick-up date'}`
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
                                        I checked the cashier&apos;s receipt for{' '}
                                        {formatPeso(order.total_centavos)}.
                                    </label>
                                    <button
                                        type="button"
                                        disabled={!paid || busy}
                                        onClick={() =>
                                            setConfirmingRelease(true)
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
                                    <p className="text-xs font-semibold text-emerald-900/70">
                                        {!paid &&
                                            'Tick the box above after checking the cashier receipt. '}
                                        The items leave the stock at once. Items
                                        already sold to buyers who paid first
                                        are released short. This cannot be
                                        undone.
                                    </p>
                                </section>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-6 py-4">
                            <div className="flex flex-wrap gap-2">
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
                        </div>

                        <ConfirmReleaseDialog
                            order={confirmingRelease ? order : null}
                            busy={busy}
                            onConfirm={() =>
                                act(OrderController.release(order.id).url, {
                                    paid: true,
                                })
                            }
                            onClose={() => setConfirmingRelease(false)}
                        />
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

/**
 * "Release Order PW-0042 to Juan Dela Cruz?": the items leave the stock and
 * a release is final, so the Specialist answers first (after ticking that
 * the cashier's receipt was checked).
 */
export function ConfirmReleaseDialog({
    order,
    busy,
    onConfirm,
    onClose,
}: {
    order: Pick<SpecialistOrderRow, 'number' | 'student_name' | 'items'> | null;
    busy: boolean;
    onConfirm: () => void;
    onClose: () => void;
}) {
    const items = order?.items ?? [];
    const pieces = items.reduce(
        (sum, item) => sum + item.quantity * item.pieces_per_unit,
        0,
    );
    const piecesText = `${pieces} ${pieces === 1 ? 'pc' : 'pcs'}`;
    const what =
        items.length === 1
            ? `${piecesText} of ${items[0].product_name}${items[0].variant_label ? ` (${items[0].variant_label})` : ''}`
            : `${items.length} items (${piecesText})`;

    return (
        <ConfirmDialog
            open={order !== null}
            title={`Release Order ${order?.number ?? ''} to ${order?.student_name ?? 'the buyer'}?`}
            description={`${what} ${pieces === 1 ? 'leaves' : 'leave'} the stock now. This cannot be undone.`}
            cancelLabel="Check again"
            confirmLabel="Release"
            tone="green"
            busy={busy}
            onConfirm={onConfirm}
            onClose={onClose}
        />
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
