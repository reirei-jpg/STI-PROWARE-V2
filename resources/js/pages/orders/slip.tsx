import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Banknote,
    CheckCircle2,
    LoaderCircle,
    PackageCheck,
    Printer,
    SearchX,
    TriangleAlert,
    Undo2,
    XCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import OrderController from '@/actions/App/Http/Controllers/OrderController';
import CancelOrderDialog from '@/components/cancel-order-dialog';
import IssuanceSlip from '@/components/issuance-slip';
import { OrderStatusBadge } from '@/components/order-items';
import PageHeader from '@/components/page-header';
import SlipScanBox from '@/components/slip-scan-box';
import { formatDateOrdered, formatDateTime, formatPeso } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { IssuanceSlipData, SpecialistOrderRow } from '@/types';

type SlipResult = {
    order: SpecialistOrderRow;
    slip: IssuanceSlipData;
    other_open_orders: {
        id: number;
        number: string | null;
        status_label: string;
    }[];
};

/**
 * A scanned issuance slip: the order beside its slip, with checks in V1's
 * colors (green fine, red stop), the amount to collect, and the next step:
 * Ready for pickup, Release once the student has paid (the items leave
 * the shelf only then), Undo release the same day, Cancel, or Print the
 * slip for the signatures. Not a PROWARE slip: says so.
 */
export default function OrderSlip({
    code,
    result,
}: {
    code: string;
    result: SlipResult | null;
}) {
    return (
        <>
            <Head
                title={
                    result
                        ? `Slip ${result.order.number ?? ''}`
                        : 'Issuance Slip'
                }
            />

            <div className="space-y-6">
                <PageHeader
                    title="Issuance Slip"
                    description="Check the slip, collect the payment, and release the items."
                    actions={
                        <Link
                            href={OrderController.index()}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
                        >
                            <ArrowLeft size={17} />
                            Back to Student Orders
                        </Link>
                    }
                />

                <SlipScanBox key={code} />

                {result === null ? (
                    code !== '' && <NotFound code={code} />
                ) : (
                    <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
                        <IssuanceSlip
                            slip={result.slip}
                            className="rounded-2xl shadow-sm"
                        />
                        <ReleaseCard result={result} />
                    </div>
                )}
            </div>
        </>
    );
}

function NotFound({ code }: { code: string }) {
    return (
        <section className="rounded-3xl border border-l-4 border-slate-200 border-l-red-500 bg-white px-6 py-10 text-center shadow-sm">
            <SearchX size={40} className="mx-auto text-red-400" />
            <h2 className="mt-3 text-lg font-black text-slate-900">
                Not a PROWARE slip
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                No order has the code{' '}
                <strong className="break-all text-slate-700">{code}</strong>.
                Scan the slip again, or type its order number (PW-0042). The
                student can also open the slip from My Orders.
            </p>
        </section>
    );
}

function ReleaseCard({ result }: { result: SlipResult }) {
    const { order, other_open_orders: otherOpenOrders } = result;
    const [paid, setPaid] = useState(false);
    const [busy, setBusy] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const isOpen = order.status === 'placed' || order.status === 'ready';

    const act = (url: string, data: Record<string, boolean> = {}) => {
        setBusy(true);
        router.post(url, data, {
            preserveScroll: true,
            onSuccess: () => setPaid(false),
            onFinish: () => setBusy(false),
        });
    };

    return (
        <aside className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-2xl font-black text-slate-900">
                        {order.number}
                    </p>
                    <p className="text-sm font-bold text-slate-700">
                        {order.student_name}
                    </p>
                </div>
                <OrderStatusBadge order={order} />
            </div>

            <ul className="space-y-2 text-sm">
                <OrderStateCheck order={order} />
                {isOpen && (
                    <Check ok>
                        Pick up by{' '}
                        <strong>{formatDateOrdered(order.pick_up_by)}</strong>.
                        Its items are held for it.
                    </Check>
                )}
                {otherOpenOrders.length > 0 && (
                    <Check tone="amber">
                        {order.student_name} has{' '}
                        {otherOpenOrders.length === 1
                            ? 'another order'
                            : `${otherOpenOrders.length} other orders`}{' '}
                        waiting:{' '}
                        {otherOpenOrders.map((other, index) => (
                            <span key={other.id}>
                                {index > 0 && ', '}
                                <Link
                                    href={OrderController.slip({
                                        query: { code: other.number ?? '' },
                                    })}
                                    className="font-black underline"
                                >
                                    {other.number}
                                </Link>{' '}
                                ({other.status_label})
                            </span>
                        ))}
                    </Check>
                )}
            </ul>

            {isOpen && (
                <div className="rounded-2xl bg-emerald-50 px-4 py-3">
                    <p className="text-xs font-black tracking-wide text-emerald-800 uppercase">
                        To collect
                    </p>
                    <p className="text-3xl font-black text-emerald-900">
                        {formatPeso(order.total_centavos)}
                    </p>
                </div>
            )}

            <div className="space-y-2">
                {order.status === 'placed' && (
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => act(OrderController.ready(order.id).url)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-black text-blue-700 transition hover:bg-blue-100 disabled:opacity-60"
                    >
                        <PackageCheck size={16} />
                        Ready for pickup
                    </button>
                )}

                {isOpen && (
                    <>
                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-800 has-checked:border-emerald-400 has-checked:bg-emerald-50">
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
                                act(OrderController.release(order.id).url, {
                                    paid: true,
                                })
                            }
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                    </>
                )}

                {order.can_undo_release && (
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                            act(OrderController.undoRelease(order.id).url)
                        }
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                        title="Released by mistake? Put it back to Ready for pickup (today only)."
                    >
                        <Undo2 size={16} />
                        Undo release
                    </button>
                )}

                {order.status !== 'cancelled' && (
                    <a
                        href={OrderController.printSlip(order.id).url}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                    >
                        <Printer size={16} />
                        Print slip for signatures
                    </a>
                )}

                {isOpen && (
                    <button
                        type="button"
                        onClick={() => setCancelling(true)}
                        className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-black text-red-700 transition hover:bg-red-100"
                    >
                        Cancel order
                    </button>
                )}
            </div>

            <CancelOrderDialog
                order={cancelling ? order : null}
                onClose={() => setCancelling(false)}
            />
        </aside>
    );
}

/**
 * Green while the order can still be released; red when it was released
 * already (so the items are not handed over twice) or cancelled.
 */
function OrderStateCheck({ order }: { order: SpecialistOrderRow }) {
    switch (order.status) {
        case 'placed':
            return (
                <Check ok>Not released yet. The office is preparing it.</Check>
            );
        case 'ready':
            return <Check ok>Not released yet. Ready for pickup.</Check>;
        case 'picked_up':
            return (
                <Check ok={false}>
                    Already released {formatDateTime(order.picked_up_at)}
                    {order.handled_by && ` by ${order.handled_by}`}. Do not hand
                    the items over again.
                </Check>
            );
        default:
            return (
                <Check ok={false}>
                    {order.expired
                        ? `Expired: not released by ${formatDateOrdered(order.pick_up_by)}.`
                        : `Cancelled ${formatDateTime(order.cancelled_at)}.`}{' '}
                    This slip can no longer be used.
                    {!order.expired &&
                        order.cancel_reason &&
                        ` ${order.cancel_reason}`}
                </Check>
            );
    }
}

function Check({
    ok,
    tone,
    children,
}: {
    ok?: boolean;
    tone?: 'amber';
    children: ReactNode;
}) {
    const color = tone ?? (ok ? 'green' : 'red');

    return (
        <li
            className={cn(
                'flex gap-2 rounded-xl px-3 py-2 leading-6',
                color === 'green' && 'bg-emerald-50 text-emerald-900',
                color === 'red' && 'bg-red-50 text-red-900',
                color === 'amber' && 'bg-amber-50 text-amber-900',
            )}
        >
            <span className="mt-1 shrink-0">
                {color === 'green' && <CheckCircle2 size={16} />}
                {color === 'red' && <XCircle size={16} />}
                {color === 'amber' && <TriangleAlert size={16} />}
            </span>
            <span>{children}</span>
        </li>
    );
}
