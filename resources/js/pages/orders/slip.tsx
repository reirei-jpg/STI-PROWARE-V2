import { Head, Link, router, usePoll } from '@inertiajs/react';
import {
    ArrowLeft,
    Ban,
    Banknote,
    CheckCircle2,
    LoaderCircle,
    Printer,
    SearchX,
    ShieldAlert,
    TriangleAlert,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import OrderController from '@/actions/App/Http/Controllers/OrderController';
import PreorderSlipController from '@/actions/App/Http/Controllers/PreorderSlipController';
import ConfirmDialog from '@/components/confirm-dialog';
import IssuanceSlip from '@/components/issuance-slip';
import { ConfirmReleaseDialog } from '@/components/order-details-dialog';
import { OrderStatusBadge } from '@/components/order-items';
import PageHeader from '@/components/page-header';
import SlipScanBox from '@/components/slip-scan-box';
import StaffTag from '@/components/staff-tag';
import { formatDateOrdered, formatDateTime, formatPeso } from '@/lib/format';
import { formatUnits } from '@/lib/units';
import { cn } from '@/lib/utils';
import type {
    IssuanceSlipData,
    PreorderSlipData,
    SpecialistOrderRow,
} from '@/types';

type PreorderSlipResult = {
    slip: PreorderSlipData;
    can_mark_paid: boolean;
    /** Why it cannot be marked paid (already paid, nothing to pay). */
    refusal: string | null;
    /** Paid, and pieces arrived and are set aside: they can be released. */
    can_release: boolean;
    /** Why it cannot be released (nothing arrived yet, already released). */
    release_refusal: string | null;
    /** The pieces set aside, to release. */
    ready: { item: string; pieces: number }[];
};

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
 * the student, what was paid at the cashier, and Release (only once the
 * cashier marked it paid; the paid items leave the shelf; a release is
 * final). Print sits
 * below, smaller. Only the buyer can cancel an order. Not a PROWARE slip: says so.
 */
export default function OrderSlip({
    code,
    result,
    preorderResult,
}: {
    code: string;
    result: SlipResult | null;
    /** A preorder slip (PR-0001) when the code is not an order's. */
    preorderResult: PreorderSlipResult | null;
}) {
    // While the order is open the page checks it every 10 seconds, so when
    // it is released, cancelled or expires elsewhere (the phone, another
    // computer, the buyer) its Release and Cancel buttons are gone by itself.
    // Waiting for payment or paid: it may be paid or released elsewhere.
    const isOpen =
        result?.order.status === 'placed' || result?.order.status === 'paid';
    const { start, stop } = usePoll(
        10000,
        { only: ['result'] },
        { autoStart: false, mode: 'rest' },
    );

    useEffect(() => {
        if (isOpen) {
            start();
        } else {
            stop();
        }

        return stop;
        // start and stop are new on every render; the order's state decides.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

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
                    description="Release the items once the cashier has recorded the payment."
                    actions={
                        <Link
                            href={OrderController.index()}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
                        >
                            <ArrowLeft size={17} />
                            Back to Orders
                        </Link>
                    }
                />

                <SlipScanBox key={code} />

                {result === null && preorderResult !== null ? (
                    <PreorderPayment result={preorderResult} />
                ) : result === null ? (
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

/**
 * A scanned preorder slip (PR-0001): the answer first (not paid yet, or
 * paid), then the slip, and Release for its paid pieces that arrived. The
 * cashier marks slips Paid (panel revision, 20 Nov 2026).
 */
function PreorderPayment({ result }: { result: PreorderSlipResult }) {
    const { slip } = result;
    const released = slip.status === 'released';
    const paid = slip.status === 'paid' || released;
    const [busy, setBusy] = useState(false);
    const [releasing, setReleasing] = useState(false);
    const readyPieces = result.ready.reduce(
        (sum, line) => sum + line.pieces,
        0,
    );
    const asSlip: IssuanceSlipData = {
        ...slip,
        order_id: slip.slip_id,
        status: released ? 'picked_up' : 'placed',
        pick_up_by: null,
        released_on: null,
        issued_by: null,
    };

    const release = () => {
        setBusy(true);
        router.post(
            PreorderSlipController.release(slip.slip_id).url,
            {},
            {
                preserveScroll: true,
                onFinish: () => {
                    setBusy(false);
                    setReleasing(false);
                },
            },
        );
    };

    return (
        <>
            <section
                className={cn(
                    'flex items-start gap-4 rounded-3xl border px-6 py-5 shadow-sm',
                    paid
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : result.can_mark_paid
                          ? 'border-amber-200 bg-amber-50 text-amber-900'
                          : 'border-red-200 bg-red-50 text-red-900',
                )}
            >
                {paid ? (
                    <CheckCircle2 size={30} className="shrink-0" />
                ) : result.can_mark_paid ? (
                    <Banknote size={30} className="shrink-0" />
                ) : (
                    <ShieldAlert size={30} className="shrink-0" />
                )}
                <div>
                    <p className="text-lg font-black">
                        {paid && result.can_release
                            ? `Preorder ${slip.number}: ready for release`
                            : released
                              ? `Preorder ${slip.number} has been released`
                              : paid
                                ? `Preorder ${slip.number} has been paid`
                                : result.can_mark_paid
                                  ? `Preorder ${slip.number}: awaiting payment`
                                  : `Preorder ${slip.number}: payment cannot be accepted`}
                    </p>
                    <p className="text-sm">
                        {paid
                            ? result.can_release
                                ? `${formatUnits(readyPieces, 'Piece')} arrived for ${slip.student_name} and ${readyPieces === 1 ? 'has' : 'have'} been paid. Hand ${readyPieces === 1 ? 'it' : 'them'} over, then select Release.`
                                : result.release_refusal
                            : !result.can_mark_paid
                              ? result.refusal
                              : `${slip.student_name} must pay ${formatPeso(slip.total_centavos)} for ${slip.product_name} at the cashier. The cashier records the payment.`}
                    </p>
                </div>
            </section>

            <div className="grid items-start gap-6 lg:grid-cols-[1fr_24rem]">
                <IssuanceSlip
                    slip={asSlip}
                    title="PREORDER SLIP"
                    paid={slip.status === 'paid'}
                    className="rounded-2xl shadow-sm"
                />

                {result.can_release && (
                    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div>
                            <p className="text-xs font-black tracking-wide text-slate-500 uppercase">
                                Ready to release
                            </p>
                            <ul className="mt-2 space-y-1">
                                {result.ready.map((line) => (
                                    <li
                                        key={line.item}
                                        className="flex justify-between gap-3 text-sm font-bold text-slate-800"
                                    >
                                        <span>{line.item}</span>
                                        <span>
                                            {formatUnits(line.pieces, 'Piece')}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            <p className="mt-2 text-sm text-slate-500">
                                Already paid: nothing to collect.
                            </p>
                        </div>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => setReleasing(true)}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {busy ? (
                                <LoaderCircle
                                    size={16}
                                    className="animate-spin"
                                />
                            ) : (
                                <CheckCircle2 size={16} />
                            )}
                            Release {formatUnits(readyPieces, 'Piece')}
                        </button>
                    </section>
                )}
            </div>

            <ConfirmDialog
                open={releasing}
                title={`Release ${formatUnits(readyPieces, 'Piece')} to ${slip.student_name}?`}
                description={`${result.ready.map((line) => `${formatUnits(line.pieces, 'Piece')} of ${line.item}`).join(', ')}, already paid. They leave the shelf and the slip is used for them. This cannot be undone.`}
                cancelLabel="Not yet"
                confirmLabel="Release"
                busy={busy}
                onConfirm={release}
                onClose={() => setReleasing(false)}
            />
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
                No order or preorder has the code{' '}
                <strong className="break-all text-slate-700">{code}</strong>.
                Scan the slip again, or type its number (PW-0042, or PR-0007 for
                a preorder). The student can also open the slip from My Orders.
            </p>
        </section>
    );
}

/**
 * The answer first, in V1's colors: green once the cashier marked it paid
 * (OK to release), amber while it waits for payment (send the buyer to the
 * cashier), red when it was released already (so it is not handed over
 * twice) or the order was cancelled or expired.
 */
function ReleaseVerdict({ order }: { order: SpecialistOrderRow }) {
    const verdict = (() => {
        switch (order.status) {
            case 'paid':
                return {
                    tone: 'green' as const,
                    icon: <CheckCircle2 size={30} />,
                    title: 'Ready for release',
                    text: `Paid at the cashier on ${formatDateTime(order.paid_at)}. Hand over the items, then select Release.`,
                };
            case 'placed':
                return {
                    tone: 'amber' as const,
                    icon: <Banknote size={30} />,
                    title: 'Awaiting payment',
                    text: 'Direct the buyer to the cashier. The items can be released once the payment is recorded.',
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
                            ? `Not released by ${order.pick_up_by ? formatDateOrdered(order.pick_up_by) : 'its pick-up date'}.`
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
                    : verdict.tone === 'amber'
                      ? 'bg-amber-500 text-white shadow-amber-500/20'
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
    const [busy, setBusy] = useState(false);
    const [confirmingRelease, setConfirmingRelease] = useState(false);
    const waiting = order.status === 'placed';
    const paid = order.status === 'paid';
    const shortLines = order.items.filter((item) => item.quantity_short > 0);

    const release = () => {
        setBusy(true);
        router.post(
            OrderController.release(order.id).url,
            {},
            {
                preserveScroll: true,
                onFinish: () => {
                    setBusy(false);
                    setConfirmingRelease(false);
                },
            },
        );
    };

    return (
        <aside className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
            <div className="flex items-center gap-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-base font-black text-blue-700 ring-1 ring-blue-200">
                    {initials(order.student_name)}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-black text-slate-900">
                        <span className="truncate">{order.student_name}</span>
                        {order.is_staff && <StaffTag />}
                    </p>
                    <p className="text-sm text-slate-500">
                        <span className="font-bold text-slate-700">
                            {order.number}
                        </span>
                        {order.student_id && ` · ID ${order.student_id}`}
                        {order.student_section && ` · ${order.student_section}`}
                    </p>
                </div>
                <OrderStatusBadge order={order} />
            </div>

            {otherOpenOrders.length > 0 && (
                <ul className="space-y-2 text-sm">
                    <Check tone="amber">
                        {order.student_name} has{' '}
                        {otherOpenOrders.length === 1
                            ? 'another order'
                            : `${otherOpenOrders.length} other orders`}{' '}
                        open:{' '}
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
                </ul>
            )}

            {waiting && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                    <p className="font-black">Awaiting payment</p>
                    <p>
                        The buyer must pay {formatPeso(order.total_centavos)} at
                        the cashier. The items can be released once the payment
                        is recorded.
                    </p>
                </div>
            )}

            {paid && (
                <div className="space-y-3">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                        <p className="text-xs font-black tracking-wide text-emerald-800 uppercase">
                            Paid at the cashier
                        </p>
                        <p className="text-3xl font-black tracking-tight text-emerald-700">
                            {formatPeso(order.total_centavos)}
                        </p>
                        <p className="text-xs font-semibold text-emerald-900">
                            {formatDateTime(order.paid_at)}
                        </p>
                    </div>
                    {shortLines.length > 0 && (
                        <Check tone="amber">
                            Not paid for (sold out before payment). Do not hand
                            over:{' '}
                            {shortLines
                                .map(
                                    (item) =>
                                        `${formatUnits(item.quantity_short, item.unit_name)} of ${item.product_name}${item.variant_label ? ` (${item.variant_label})` : ''}`,
                                )
                                .join(', ')}
                        </Check>
                    )}
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirmingRelease(true)}
                        data-test="release-button"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3.5 text-base font-black text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                    >
                        {busy ? (
                            <LoaderCircle size={18} className="animate-spin" />
                        ) : (
                            <CheckCircle2 size={18} />
                        )}
                        Release the items
                    </button>
                    <p className="text-center text-xs font-semibold text-slate-500">
                        The paid items leave the shelf at once. This cannot be
                        undone.
                    </p>
                </div>
            )}

            <div className="grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
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
            </div>

            <ConfirmReleaseDialog
                order={confirmingRelease ? order : null}
                busy={busy}
                onConfirm={release}
                onClose={() => setConfirmingRelease(false)}
            />
        </aside>
    );
}
/** "Juan Dela Cruz" -> "JC". */
function initials(name: string): string {
    const words = name.trim().split(/\s+/);

    return `${words[0]?.[0] ?? ''}${words.length > 1 ? (words[words.length - 1][0] ?? '') : ''}`.toUpperCase();
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
