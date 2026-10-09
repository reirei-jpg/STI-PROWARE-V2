import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Ban,
    Banknote,
    CheckCircle2,
    LoaderCircle,
    PackageCheck,
    Printer,
    SearchX,
    ShieldAlert,
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
 * A scanned issuance slip: first a large banner that answers "can I
 * release this?" (green OK, red stop), then the order beside its slip with
 * the student, the checks, and the release as numbered steps: collect the
 * amount, tick that the student has paid, release the items (they leave
 * the shelf only then). Ready for pickup, Undo release (same day), Print
 * and Cancel sit below, smaller. Not a PROWARE slip: says so.
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
                    <>
                        <ReleaseVerdict order={result.order} />
                        <div className="grid items-start gap-6 lg:grid-cols-[1fr_24rem]">
                            <IssuanceSlip
                                slip={result.slip}
                                className="rounded-2xl shadow-sm"
                            />
                            <ReleaseCard result={result} />
                        </div>
                    </>
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

/**
 * The answer first, in V1's colors: green while the items can still be
 * released, red when they were released already (so they are not handed
 * over twice) or the order was cancelled or expired.
 */
function ReleaseVerdict({ order }: { order: SpecialistOrderRow }) {
    const verdict = (() => {
        switch (order.status) {
            case 'placed':
            case 'ready':
                return {
                    tone: 'green' as const,
                    icon: <CheckCircle2 size={30} />,
                    title: 'OK to release',
                    text:
                        order.status === 'ready'
                            ? 'Ready for pickup and not released yet.'
                            : 'Not released yet. The office is still preparing it.',
                };
            case 'picked_up':
                return {
                    tone: 'red' as const,
                    icon: <ShieldAlert size={30} />,
                    title: 'Do not release: already released',
                    text: `Released ${formatDateTime(order.picked_up_at)}${order.handled_by ? ` by ${order.handled_by}` : ''}. Do not hand the items over again.`,
                };
            default:
                return {
                    tone: 'red' as const,
                    icon: <Ban size={30} />,
                    title: order.expired
                        ? 'Do not release: expired'
                        : 'Do not release: cancelled',
                    text: `${
                        order.expired
                            ? `Not released by ${formatDateOrdered(order.pick_up_by)}.`
                            : `Cancelled ${formatDateTime(order.cancelled_at)}.`
                    } This slip can no longer be used.${!order.expired && order.cancel_reason ? ` ${order.cancel_reason}` : ''}`,
                };
        }
    })();

    return (
        <section
            className={cn(
                'flex items-center gap-4 rounded-3xl px-6 py-5 shadow-sm',
                verdict.tone === 'green'
                    ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                    : 'bg-red-600 text-white shadow-red-600/20',
            )}
        >
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                {verdict.icon}
            </span>
            <div>
                <p className="text-xl font-black tracking-wide uppercase">
                    {verdict.title}
                </p>
                <p className="mt-0.5 text-sm text-white/90">{verdict.text}</p>
            </div>
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
        <aside className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
            <div className="flex items-center gap-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-base font-black text-blue-700 ring-1 ring-blue-200">
                    {initials(order.student_name)}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate font-black text-slate-900">
                        {order.student_name}
                    </p>
                    <p className="text-sm text-slate-500">
                        <span className="font-bold text-slate-700">
                            {order.number}
                        </span>
                        {order.student_section && ` · ${order.student_section}`}
                    </p>
                </div>
                <OrderStatusBadge order={order} />
            </div>

            {(isOpen || otherOpenOrders.length > 0) && (
                <ul className="space-y-2 text-sm">
                    {isOpen && (
                        <Check tone="green">
                            Pick up by{' '}
                            <strong>
                                {formatDateOrdered(order.pick_up_by)}
                            </strong>
                            . Its items are held for it.
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
            )}

            {isOpen && (
                <ol className="space-y-3">
                    <ReleaseStep number={1} title="Collect the payment">
                        <p className="text-3xl font-black tracking-tight text-emerald-700">
                            {formatPeso(order.total_centavos)}
                        </p>
                    </ReleaseStep>
                    <ReleaseStep number={2} title="Confirm it">
                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-800 transition has-checked:border-emerald-400 has-checked:bg-emerald-50">
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
                    </ReleaseStep>
                    <ReleaseStep number={3} title="Hand over the items">
                        <button
                            type="button"
                            disabled={!paid || busy}
                            onClick={() =>
                                act(OrderController.release(order.id).url, {
                                    paid: true,
                                })
                            }
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3.5 text-base font-black text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                        >
                            {busy ? (
                                <LoaderCircle
                                    size={18}
                                    className="animate-spin"
                                />
                            ) : (
                                <Banknote size={18} />
                            )}
                            Release the items
                        </button>
                    </ReleaseStep>
                </ol>
            )}

            <div className="grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
                {order.status === 'placed' && (
                    <SmallButton
                        tone="blue"
                        disabled={busy}
                        onClick={() => act(OrderController.ready(order.id).url)}
                    >
                        <PackageCheck size={16} />
                        Ready for pickup
                    </SmallButton>
                )}

                {order.can_undo_release && (
                    <SmallButton
                        disabled={busy}
                        onClick={() =>
                            act(OrderController.undoRelease(order.id).url)
                        }
                        title="Released by mistake? Put it back to Ready for pickup (today only)."
                    >
                        <Undo2 size={16} />
                        Undo release
                    </SmallButton>
                )}

                {order.status !== 'cancelled' && (
                    <a
                        href={OrderController.printSlip(order.id).url}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                    >
                        <Printer size={16} />
                        Print slip
                    </a>
                )}

                {isOpen && (
                    <SmallButton tone="red" onClick={() => setCancelling(true)}>
                        <XCircle size={16} />
                        Cancel order
                    </SmallButton>
                )}
            </div>

            <CancelOrderDialog
                order={cancelling ? order : null}
                onClose={() => setCancelling(false)}
            />
        </aside>
    );
}

/** "Juan Dela Cruz" -> "JC". */
function initials(name: string): string {
    const words = name.trim().split(/\s+/);

    return `${words[0]?.[0] ?? ''}${words.length > 1 ? (words[words.length - 1][0] ?? '') : ''}`.toUpperCase();
}

function ReleaseStep({
    number,
    title,
    children,
}: {
    number: number;
    title: string;
    children: ReactNode;
}) {
    return (
        <li className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-black text-emerald-700 ring-1 ring-emerald-200">
                {number}
            </span>
            <div className="min-w-0 flex-1 space-y-1.5">
                <p className="pt-0.5 text-xs font-black tracking-wide text-slate-500 uppercase">
                    {title}
                </p>
                {children}
            </div>
        </li>
    );
}

function SmallButton({
    tone = 'plain',
    disabled = false,
    onClick,
    title,
    children,
}: {
    tone?: 'plain' | 'blue' | 'red';
    disabled?: boolean;
    onClick: () => void;
    title?: string;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            title={title}
            className={cn(
                'inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-black transition disabled:opacity-60',
                tone === 'plain' &&
                    'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                tone === 'blue' &&
                    'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
                tone === 'red' &&
                    'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
            )}
        >
            {children}
        </button>
    );
}

function Check({
    tone,
    children,
}: {
    tone: 'green' | 'amber';
    children: ReactNode;
}) {
    return (
        <li
            className={cn(
                'flex gap-2 rounded-xl px-3 py-2 leading-6',
                tone === 'green' && 'bg-emerald-50 text-emerald-900',
                tone === 'amber' && 'bg-amber-50 text-amber-900',
            )}
        >
            <span className="mt-1 shrink-0">
                {tone === 'green' ? (
                    <CheckCircle2 size={16} />
                ) : (
                    <TriangleAlert size={16} />
                )}
            </span>
            <span>{children}</span>
        </li>
    );
}
