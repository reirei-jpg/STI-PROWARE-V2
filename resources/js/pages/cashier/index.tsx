import { Head, router } from '@inertiajs/react';
import {
    Banknote,
    CheckCircle2,
    LoaderCircle,
    ReceiptText,
    SearchX,
    ShieldAlert,
} from 'lucide-react';
import { useState } from 'react';
import CashierController from '@/actions/App/Http/Controllers/CashierController';
import ConfirmDialog from '@/components/confirm-dialog';
import IssuanceSlip from '@/components/issuance-slip';
import PageHeader from '@/components/page-header';
import SlipScanBox from '@/components/slip-scan-box';
import StaffTag from '@/components/staff-tag';
import { formatDateTime, formatPeso } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    IssuanceSlipData,
    PreorderSlipData,
    SpecialistOrderRow,
} from '@/types';

type CashierResult =
    | {
          kind: 'order';
          order: SpecialistOrderRow;
          slip: IssuanceSlipData;
          can_mark_paid: boolean;
          refusal: string | null;
          /** What to collect now: only what is still left. */
          to_collect_centavos: number | null;
          /** What is no longer left, so not charged. */
          short: string[];
      }
    | {
          kind: 'preorder';
          slip: PreorderSlipData;
          can_mark_paid: boolean;
          refusal: string | null;
          to_collect_centavos: number | null;
          short: string[];
      };

type PaidToday = {
    rows: {
        kind: 'order' | 'preorder';
        number: string | null;
        buyer: string;
        amount_centavos: number;
        paid_at: string | null;
    }[];
    total_centavos: number;
};

/**
 * The cashier's Payments page (panel revision, 20 Nov 2026): scan the QR on
 * the buyer's issuance slip or preorder slip (or type its number), collect
 * the amount shown, and Mark as paid. For an order, only what is still left
 * is charged (first to pay, first served) and set aside for the buyer; the
 * Specialist then releases it. Below: what this cashier collected today.
 */
export default function CashierPayments({
    code,
    result,
    paidToday,
}: {
    code: string;
    result: CashierResult | null;
    paidToday: PaidToday;
}) {
    return (
        <>
            <Head title="Payments" />

            <div className="space-y-6">
                <PageHeader
                    title="Payments"
                    description="Scan the buyer's slip, collect the amount due, and record the payment. The PROWARE office releases the items afterward."
                />

                <SlipScanBox
                    key={code}
                    openUrl={CashierController.index().url}
                    placeholder="Enter the slip number, e.g. PW-0042 or PR-0003"
                    title="Scan a slip"
                    description="Scan the QR code on the buyer's issuance slip or preorder slip, or enter the slip number."
                />

                {result === null ? (
                    code !== '' && <NotFound code={code} />
                ) : (
                    <Payment result={result} />
                )}

                <PaidTodayTable paidToday={paidToday} />
            </div>
        </>
    );
}

function Payment({ result }: { result: CashierResult }) {
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const slip: IssuanceSlipData =
        result.kind === 'order'
            ? result.slip
            : {
                  ...result.slip,
                  order_id: result.slip.slip_id,
                  status:
                      result.slip.status === 'released'
                          ? 'picked_up'
                          : 'placed',
                  pick_up_by: null,
                  released_on: null,
                  issued_by: null,
              };
    const number =
        result.kind === 'order' ? result.order.number : result.slip.number;
    const buyer =
        result.kind === 'order'
            ? result.order.student_name
            : result.slip.student_name;
    const isStaff =
        result.kind === 'order' ? result.order.is_staff : result.slip.is_staff;
    const alreadyPaid =
        result.kind === 'order'
            ? result.order.status === 'paid' ||
              result.order.status === 'picked_up'
            : result.slip.status !== 'waiting_payment';
    const amount = result.to_collect_centavos ?? 0;

    const markPaid = () => {
        setBusy(true);
        router.post(
            result.kind === 'order'
                ? CashierController.payOrder(result.order.id).url
                : CashierController.payPreorderSlip(result.slip.slip_id).url,
            {},
            {
                preserveScroll: true,
                onFinish: () => {
                    setBusy(false);
                    setConfirming(false);
                },
            },
        );
    };

    return (
        <>
            <section
                data-test="cashier-verdict"
                className={cn(
                    'flex items-center gap-4 rounded-3xl px-6 py-5 text-white shadow-sm',
                    result.can_mark_paid
                        ? 'bg-amber-500'
                        : alreadyPaid
                          ? 'bg-emerald-600'
                          : 'bg-red-600',
                )}
            >
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                    {result.can_mark_paid ? (
                        <Banknote size={30} />
                    ) : alreadyPaid ? (
                        <CheckCircle2 size={30} />
                    ) : (
                        <ShieldAlert size={30} />
                    )}
                </span>
                <div>
                    <p className="text-xl font-black tracking-wide uppercase">
                        {result.can_mark_paid
                            ? `Amount due: ${formatPeso(amount)}`
                            : alreadyPaid
                              ? 'Payment already recorded'
                              : 'Payment cannot be accepted'}
                    </p>
                    <p className="mt-0.5 text-sm text-white/90">
                        {result.can_mark_paid
                            ? `${result.kind === 'order' ? 'Order' : 'Preorder'} ${number} · ${buyer}. Collect this amount, then select Mark as Paid.`
                            : result.refusal}
                    </p>
                </div>
            </section>

            <div className="grid items-start gap-6 lg:grid-cols-[1fr_24rem]">
                <IssuanceSlip
                    slip={slip}
                    title={
                        result.kind === 'preorder' ? 'PREORDER SLIP' : undefined
                    }
                    paid={
                        result.kind === 'preorder' &&
                        result.slip.status === 'paid'
                    }
                    className="rounded-2xl shadow-sm"
                />

                <aside className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
                    <div>
                        <p className="flex items-center gap-2 font-black text-slate-900">
                            {buyer}
                            {isStaff && <StaffTag />}
                        </p>
                        <p className="text-sm font-bold text-slate-500">
                            {result.kind === 'order' ? 'Order' : 'Preorder'}{' '}
                            {number}
                        </p>
                    </div>

                    {result.can_mark_paid && (
                        <>
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                                <p className="text-xs font-black tracking-wide text-amber-800 uppercase">
                                    Amount due
                                </p>
                                <p
                                    data-test="amount-to-collect"
                                    className="text-3xl font-black tracking-tight text-slate-900"
                                >
                                    {formatPeso(amount)}
                                </p>
                            </div>
                            {result.short.length > 0 && (
                                <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm leading-6 font-semibold text-amber-900">
                                    Not charged (sold out before payment):{' '}
                                    {result.short.join(', ')}.
                                </p>
                            )}
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => setConfirming(true)}
                                data-test="mark-paid"
                                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0D6EFD] px-4 py-3.5 text-base font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {busy ? (
                                    <LoaderCircle
                                        size={18}
                                        className="animate-spin"
                                    />
                                ) : (
                                    <Banknote size={18} />
                                )}
                                Mark as Paid
                            </button>
                            <p className="text-center text-xs font-semibold text-slate-500">
                                {result.kind === 'order'
                                    ? 'The items will be reserved for the buyer. Recorded payments cannot be undone.'
                                    : 'The preorder can no longer be changed or cancelled. Recorded payments cannot be undone.'}
                            </p>
                        </>
                    )}

                    {!result.can_mark_paid && result.refusal && (
                        <p
                            className={cn(
                                'rounded-xl px-3 py-2 text-sm leading-6 font-semibold',
                                alreadyPaid
                                    ? 'bg-emerald-50 text-emerald-900'
                                    : 'bg-red-50 text-red-800',
                            )}
                        >
                            {result.refusal}
                        </p>
                    )}
                </aside>
            </div>

            <ConfirmDialog
                open={confirming}
                title={`Record the payment for ${number ?? ''}?`}
                description={`Confirm that ${buyer} has paid ${formatPeso(amount)}. ${
                    result.kind === 'order'
                        ? 'The items will be reserved for pickup at the PROWARE office.'
                        : 'The slip will be marked PAID, and the preorder can no longer be changed or cancelled.'
                } This action cannot be undone.`}
                cancelLabel="Cancel"
                confirmLabel="Mark as Paid"
                busy={busy}
                onConfirm={markPaid}
                onClose={() => setConfirming(false)}
            />
        </>
    );
}

function NotFound({ code }: { code: string }) {
    return (
        <section className="rounded-3xl border border-l-4 border-slate-200 border-l-red-500 bg-white px-6 py-10 text-center shadow-sm">
            <SearchX size={40} className="mx-auto text-red-400" />
            <h2 className="mt-3 text-lg font-black text-slate-900">
                Slip not found
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                No PROWARE slip matches &ldquo;{code}&rdquo;. Check the number
                or scan the QR code again.
            </p>
        </section>
    );
}

function PaidTodayTable({ paidToday }: { paidToday: PaidToday }) {
    return (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-5 py-4">
                <h2 className="flex items-center gap-2 font-black text-slate-900">
                    <ReceiptText size={19} className="text-blue-600" />
                    Paid today
                </h2>
                <p className="text-sm font-bold text-slate-600">
                    {paidToday.rows.length}{' '}
                    {paidToday.rows.length === 1 ? 'payment' : 'payments'} ·{' '}
                    <span
                        data-test="paid-today-total"
                        className="font-black text-slate-900"
                    >
                        {formatPeso(paidToday.total_centavos)}
                    </span>
                </p>
            </div>
            {paidToday.rows.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-500">
                    No payments have been recorded today.
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-black tracking-wide text-slate-500 uppercase">
                            <tr>
                                <th className="px-5 py-3">Time</th>
                                <th className="px-5 py-3">Slip</th>
                                <th className="px-5 py-3">Buyer</th>
                                <th className="px-5 py-3 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {paidToday.rows.map((row) => (
                                <tr key={`${row.kind}-${row.number}`}>
                                    <td className="px-5 py-3 whitespace-nowrap text-slate-600">
                                        {formatDateTime(row.paid_at)}
                                    </td>
                                    <td className="px-5 py-3 font-bold whitespace-nowrap text-slate-800">
                                        {row.number}
                                        <span className="ml-1.5 text-xs font-semibold text-slate-500">
                                            {row.kind === 'order'
                                                ? 'Order'
                                                : 'Preorder'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-slate-700">
                                        {row.buyer}
                                    </td>
                                    <td className="px-5 py-3 text-right font-black whitespace-nowrap text-slate-900">
                                        {formatPeso(row.amount_centavos)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
