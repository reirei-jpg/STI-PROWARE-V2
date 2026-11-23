import { Head, Link, useForm } from '@inertiajs/react';
import {
    Banknote,
    CheckCircle2,
    LoaderCircle,
    ReceiptText,
    SearchX,
    ShieldAlert,
    Smartphone,
    Undo2,
    X,
} from 'lucide-react';
import { useState } from 'react';
import CashierController from '@/actions/App/Http/Controllers/CashierController';
import ConfirmDialog from '@/components/confirm-dialog';
import InputError from '@/components/input-error';
import PageHeader from '@/components/page-header';
import PaymentTicket from '@/components/payment-ticket';
import SlipScanBox from '@/components/slip-scan-box';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { confirmLeave } from '@/lib/back-guard';
import { formatDateTime, formatPeso } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    IssuanceSlipData,
    PaymentRow,
    PreorderSlipData,
    ReceiptLink,
    SpecialistOrderRow,
} from '@/types';

type CashierResult =
    | {
          kind: 'order';
          order: SpecialistOrderRow;
          slip: IssuanceSlipData;
          /** Its Payment Receipt, once paid. */
          receipt: ReceiptLink | null;
          can_mark_paid: boolean;
          refusal: string | null;
          /** What to collect now: only what is still left. */
          to_collect_centavos: number | null;
          /** What is no longer left, so not charged. */
          short: string[];
          /** Paid today and not released yet: the payment can be undone. */
          can_undo: boolean;
      }
    | {
          kind: 'preorder';
          slip: PreorderSlipData;
          receipt: ReceiptLink | null;
          can_mark_paid: boolean;
          refusal: string | null;
          to_collect_centavos: number | null;
          short: string[];
          /** Paid today and its items have not arrived: the payment can be undone. */
          can_undo: boolean;
      };

type PaidToday = {
    rows: PaymentRow[];
    total_centavos: number;
};

/** Up to ₱100,000.00, as the server allows. */
const MAX_RECEIVED_CENTAVOS = 10_000_000;

/**
 * Record Payment (panel revision, 20 Nov 2026): scan the QR on the buyer's
 * issuance slip or preorder slip (or type its number), see the amount due,
 * choose Cash (amount received, the change is shown) or GCash (its 13-digit
 * reference number), and Mark as Paid: the Payment Receipt opens, ready to
 * print. For an order, only what is still left is charged (first to pay,
 * first served). A payment recorded by mistake can be undone the same day,
 * before release, with a reason. Below: today's payments.
 */
export default function RecordPayment({
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
            <Head title="Record Payment" />

            <div className="space-y-6">
                <PageHeader
                    title="Record Payment"
                    description="Scan the buyer's slip or enter its number, collect the amount due, and record the payment. A Payment Receipt is issued, and the PROWARE office releases the items afterward."
                />

                <SlipScanBox
                    key={code}
                    openUrl={CashierController.record().url}
                    placeholder="Enter the slip number, e.g. PW-0042 or PR-0003"
                    title="Scan a slip"
                    description="Scan the QR code on the buyer's issuance slip or preorder slip, or enter the slip number when there is no QR code."
                />

                {result === null ? (
                    code !== '' && <NotFound code={code} />
                ) : (
                    <Payment key={code} result={result} />
                )}

                <PaidTodayTable paidToday={paidToday} />
            </div>
        </>
    );
}

/** "500", "500.5", "₱1,250.00" → centavos; null when it is not an amount with up to 2 decimals. */
function toCentavos(typed: string): number | null {
    const clean = typed.replace(/[₱,\s]/g, '');

    if (!/^\d+(\.\d{1,2})?$/.test(clean)) {
        return null;
    }

    return Math.round(Number(clean) * 100);
}

function Payment({ result }: { result: CashierResult }) {
    const [confirming, setConfirming] = useState(false);
    const form = useForm<{
        method: '' | 'cash' | 'gcash';
        amount_received: string;
        gcash_reference: string;
    }>({ method: '', amount_received: '', gcash_reference: '' });
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

    // What the cashier entered, checked as it is typed (the server checks it again).
    const received = toCentavos(form.data.amount_received);
    const reference = form.data.gcash_reference.replace(/[\s-]/g, '');
    const cashProblem =
        form.data.method !== 'cash' || form.data.amount_received.trim() === ''
            ? null
            : received === null
              ? 'Enter the amount received as a number with up to 2 decimal places, e.g. 500 or 500.50.'
              : received === 0
                ? 'The amount received must be more than ₱0.00.'
                : received > MAX_RECEIVED_CENTAVOS
                  ? 'The amount received cannot be more than ₱100,000.00.'
                  : received < amount
                    ? `The amount received (${formatPeso(received)}) is less than the amount due (${formatPeso(amount)}).`
                    : null;
    const gcashProblem =
        form.data.method !== 'gcash' || reference === ''
            ? null
            : /^\d{13}$/.test(reference)
              ? null
              : 'The GCash reference number must be exactly 13 digits.';
    const ready =
        (form.data.method === 'cash' &&
            received !== null &&
            cashProblem === null) ||
        (form.data.method === 'gcash' && /^\d{13}$/.test(reference));
    const change = received === null ? null : received - amount;
    // Typed and not recorded yet: leaving asks first.
    const unsaved = useUnsavedChanges(
        result.can_mark_paid && form.data.method !== '' && !form.processing,
    );

    const markPaid = () => {
        form.transform((data) =>
            data.method === 'cash'
                ? { method: 'cash', amount_received: data.amount_received }
                : { method: 'gcash', gcash_reference: reference },
        );
        form.post(
            result.kind === 'order'
                ? CashierController.payOrder(result.order.id).url
                : CashierController.payPreorderSlip(result.slip.slip_id).url,
            {
                preserveScroll: true,
                onFinish: () => setConfirming(false),
            },
        );
    };

    return (
        <>
            {unsaved.prompt}
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
                            ? `${result.kind === 'order' ? 'Order' : 'Preorder'} ${number} · ${buyer}. Collect this amount, choose the payment method, then select Mark as Paid.`
                            : result.refusal}
                    </p>
                </div>
            </section>

            {/* A small order ticket, like at a fast-food counter: the full issuance slip is not needed to take a payment. */}
            <div className="grid max-w-5xl items-start gap-6 md:grid-cols-2">
                <PaymentTicket
                    kind={result.kind}
                    number={number}
                    date={result.slip.date}
                    buyerName={buyer}
                    buyerId={result.slip.student_id}
                    section={result.slip.section}
                    isStaff={isStaff}
                    items={result.slip.items}
                    totalCentavos={result.slip.total_centavos}
                    amountDueCentavos={result.can_mark_paid ? amount : null}
                    paid={alreadyPaid}
                    className="md:justify-self-end"
                />

                <aside className="w-full max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:sticky md:top-24">
                    <p className="text-xs font-black tracking-[0.2em] text-slate-500 uppercase">
                        Payment
                    </p>

                    {result.can_mark_paid && (
                        <form
                            className="space-y-4"
                            onSubmit={(event) => {
                                event.preventDefault();

                                if (ready) {
                                    setConfirming(true);
                                }
                            }}
                        >
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

                            <fieldset>
                                <legend className="text-sm font-black text-slate-700">
                                    Payment method{' '}
                                    <span className="text-red-600">*</span>
                                </legend>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    {(
                                        [
                                            ['cash', 'Cash', Banknote],
                                            ['gcash', 'GCash', Smartphone],
                                        ] as const
                                    ).map(([value, label, Icon]) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => {
                                                form.setData('method', value);
                                                form.clearErrors();
                                            }}
                                            aria-pressed={
                                                form.data.method === value
                                            }
                                            data-test={`method-${value}`}
                                            className={cn(
                                                'inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-black transition',
                                                form.data.method === value
                                                    ? 'border-blue-600 bg-blue-600 text-white'
                                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                                            )}
                                        >
                                            <Icon size={17} />
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                <InputError
                                    message={form.errors.method}
                                    className="mt-1 font-semibold"
                                />
                            </fieldset>

                            {form.data.method === 'cash' && (
                                <div className="space-y-1.5">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <label
                                            htmlFor="amount-received"
                                            className="text-sm font-black text-slate-700"
                                        >
                                            Amount received{' '}
                                            <span className="text-red-600">
                                                *
                                            </span>
                                        </label>
                                        {/* The buyer handed over exactly the amount due: no typing, no change. */}
                                        <button
                                            type="button"
                                            data-test="exact-amount"
                                            onClick={() => {
                                                form.setData(
                                                    'amount_received',
                                                    (amount / 100).toFixed(2),
                                                );
                                                form.clearErrors(
                                                    'amount_received',
                                                );
                                            }}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-black text-emerald-800 transition hover:bg-emerald-100"
                                        >
                                            <Banknote size={15} />
                                            Exact amount · {formatPeso(amount)}
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                                        <span className="font-black text-slate-500">
                                            ₱
                                        </span>
                                        <input
                                            id="amount-received"
                                            inputMode="decimal"
                                            autoFocus
                                            value={form.data.amount_received}
                                            onChange={(event) => {
                                                form.setData(
                                                    'amount_received',
                                                    event.target.value,
                                                );
                                                // A refusal is about what was typed before.
                                                form.clearErrors(
                                                    'amount_received',
                                                );
                                            }}
                                            maxLength={12}
                                            placeholder={(amount / 100).toFixed(
                                                2,
                                            )}
                                            className="h-11 w-full bg-transparent text-lg font-black text-slate-900 outline-none placeholder:font-semibold placeholder:text-slate-300"
                                        />
                                    </div>
                                    <InputError
                                        message={
                                            cashProblem ??
                                            form.errors.amount_received
                                        }
                                        className="font-semibold"
                                    />
                                    {received !== null &&
                                        cashProblem === null && (
                                            <p className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-800">
                                                Change
                                                <span
                                                    data-test="change"
                                                    className="text-lg"
                                                >
                                                    {formatPeso(change)}
                                                </span>
                                            </p>
                                        )}
                                </div>
                            )}

                            {form.data.method === 'gcash' && (
                                <div className="space-y-1.5">
                                    <label
                                        htmlFor="gcash-reference"
                                        className="text-sm font-black text-slate-700"
                                    >
                                        GCash reference number{' '}
                                        <span className="text-red-600">*</span>
                                    </label>
                                    <input
                                        id="gcash-reference"
                                        inputMode="numeric"
                                        autoFocus
                                        value={form.data.gcash_reference}
                                        onChange={(event) => {
                                            form.setData(
                                                'gcash_reference',
                                                event.target.value,
                                            );
                                            // A refusal is about what was typed before.
                                            form.clearErrors('gcash_reference');
                                        }}
                                        maxLength={17}
                                        placeholder="13 digits, e.g. 1004 123 456789"
                                        className="h-11 w-full rounded-xl border border-slate-200 px-3 font-mono text-base font-bold tracking-wider text-slate-900 shadow-sm outline-none placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                    />
                                    <p className="text-xs text-slate-500">
                                        {reference.replace(/\D/g, '').length} of
                                        13 digits. Copy it from the buyer's
                                        GCash receipt.
                                    </p>
                                    <InputError
                                        message={
                                            gcashProblem ??
                                            form.errors.gcash_reference
                                        }
                                        className="font-semibold"
                                    />
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={!ready || form.processing}
                                data-test="mark-paid"
                                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0D6EFD] px-4 py-3.5 text-base font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {form.processing ? (
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
                                {form.data.method === ''
                                    ? 'Choose the payment method first.'
                                    : `${result.kind === 'order' ? 'The items will be reserved for the buyer.' : 'The preorder can no longer be changed or cancelled.'} A Payment Receipt is issued.`}
                            </p>
                        </form>
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

                    {result.receipt && (
                        <Link
                            href={CashierController.receipt(result.receipt.id)}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-300 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700 shadow-sm transition hover:bg-blue-100"
                        >
                            <ReceiptText size={17} />
                            View Payment Receipt {result.receipt.receipt_number}
                        </Link>
                    )}

                    {result.can_undo && (
                        <UndoPayment
                            url={
                                result.kind === 'order'
                                    ? CashierController.undoOrderPayment(
                                          result.order.id,
                                      ).url
                                    : CashierController.undoPreorderPayment(
                                          result.slip.slip_id,
                                      ).url
                            }
                            number={number}
                            buyer={buyer}
                            isOrder={result.kind === 'order'}
                        />
                    )}
                </aside>
            </div>

            <ConfirmDialog
                open={confirming}
                title={`Record the payment for ${number ?? ''}?`}
                description={`${buyer} pays ${formatPeso(amount)} by ${form.data.method === 'cash' ? `cash: ${formatPeso(received)} received, ${formatPeso(change)} change` : `GCash, reference ${reference}`}. ${
                    result.kind === 'order'
                        ? 'The items will be reserved for pickup at the PROWARE office.'
                        : 'The slip will be marked PAID, and the preorder can no longer be changed or cancelled.'
                } A Payment Receipt is issued. If it is recorded by mistake, it can be undone today with a reason.`}
                cancelLabel="Cancel"
                confirmLabel="Mark as Paid"
                busy={form.processing}
                onConfirm={markPaid}
                onClose={() => setConfirming(false)}
            />
        </>
    );
}

/**
 * Undo a payment recorded by mistake (the wrong slip was scanned, or the
 * buyer did not pay): only today and before release. A reason is required;
 * the buyer and the Specialist are told, and it stays on record.
 */
function UndoPayment({
    url,
    number,
    buyer,
    isOrder,
}: {
    url: string;
    number: string | null;
    buyer: string;
    isOrder: boolean;
}) {
    const [open, setOpen] = useState(false);
    const form = useForm({ reason: '' });
    const ready = form.data.reason.trim().length >= 5;

    const close = () => {
        setOpen(false);
        form.reset();
        form.clearErrors();
    };
    // Closing with a written reason asks first.
    const unsaved = useUnsavedChanges(
        open && form.data.reason.trim() !== '' && !form.processing,
    );

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                data-test="undo-payment"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-black text-red-700 shadow-sm transition hover:bg-red-100"
            >
                <Undo2 size={17} />
                Undo payment
            </button>
            <p className="text-center text-xs font-semibold text-slate-500">
                Recorded by mistake? It can be undone today, before{' '}
                {isOrder ? 'release' : 'the items arrive'}.
            </p>

            <Dialog
                open={open}
                onOpenChange={(isOpen) => !isOpen && confirmLeave(close)}
            >
                <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-md [&>button:last-child]:hidden">
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            form.post(url, {
                                preserveScroll: true,
                                onSuccess: close,
                            });
                        }}
                        className="flex min-h-0 flex-col"
                    >
                        {unsaved.prompt}
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                            <div className="flex items-start gap-3">
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
                                    <Undo2 size={22} />
                                </span>
                                <div>
                                    <DialogTitle className="text-lg font-black text-slate-900">
                                        Undo the payment for {number}?
                                    </DialogTitle>
                                    <DialogDescription className="text-sm text-slate-500">
                                        {isOrder
                                            ? `The Payment Receipt will be voided, the order goes back to waiting for payment, and its reserved items are for sale again. ${buyer} and the Specialist are notified.`
                                            : `The Payment Receipt will be voided and the slip goes back to waiting for payment. ${buyer} and the Specialist are notified.`}
                                    </DialogDescription>
                                </div>
                            </div>
                            <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                                <X size={20} />
                                <span className="sr-only">Close</span>
                            </DialogClose>
                        </div>

                        <div className="space-y-2 px-6 py-5">
                            <label
                                htmlFor="undo-reason"
                                className="text-sm font-black text-slate-700"
                            >
                                Reason
                            </label>
                            <textarea
                                id="undo-reason"
                                value={form.data.reason}
                                onChange={(event) =>
                                    form.setData('reason', event.target.value)
                                }
                                maxLength={200}
                                rows={3}
                                placeholder="e.g. Scanned the wrong slip."
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            />
                            <p className="text-xs text-slate-500">
                                At least 5 characters. Kept on record with the
                                payment.
                            </p>
                            <InputError
                                message={form.errors.reason}
                                className="font-semibold"
                            />
                        </div>

                        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                            <DialogClose className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                                Keep payment
                            </DialogClose>
                            <button
                                type="submit"
                                disabled={form.processing || !ready}
                                data-test="confirm-undo-payment"
                                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {form.processing && (
                                    <LoaderCircle
                                        size={17}
                                        className="animate-spin"
                                    />
                                )}
                                Undo payment
                            </button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
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
    const recorded = paidToday.rows.filter((row) => !row.void).length;
    const voided = paidToday.rows.length - recorded;

    return (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-5 py-4">
                <h2 className="flex items-center gap-2 font-black text-slate-900">
                    <ReceiptText size={19} className="text-blue-600" />
                    Paid today
                </h2>
                <p className="text-sm font-bold text-slate-600">
                    {recorded} {recorded === 1 ? 'payment' : 'payments'}
                    {voided > 0 && ` (${voided} voided)`} ·{' '}
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
                                <th className="px-5 py-3">Receipt No.</th>
                                <th className="px-5 py-3">Time</th>
                                <th className="px-5 py-3">Slip</th>
                                <th className="px-5 py-3">Buyer</th>
                                <th className="px-5 py-3">Method</th>
                                <th className="px-5 py-3 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {paidToday.rows.map((row) => (
                                <tr
                                    key={row.id}
                                    className={cn(row.void && 'bg-red-50/50')}
                                >
                                    <td className="px-5 py-3 font-bold whitespace-nowrap">
                                        <Link
                                            href={CashierController.receipt(
                                                row.id,
                                            )}
                                            className="text-blue-700 hover:underline"
                                        >
                                            {row.receipt_number}
                                        </Link>
                                        {row.void && (
                                            <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-black text-red-700">
                                                Voided
                                            </span>
                                        )}
                                    </td>
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
                                        {row.buyer_name}
                                        {row.void && row.void_reason && (
                                            <span className="block text-xs text-red-700">
                                                {row.void_reason}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3 text-slate-700">
                                        {row.method_label}
                                    </td>
                                    <td
                                        className={cn(
                                            'px-5 py-3 text-right font-black whitespace-nowrap',
                                            row.void
                                                ? 'text-slate-400 line-through'
                                                : 'text-slate-900',
                                        )}
                                    >
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
