import type { ReactNode } from 'react';
import { formatDateTime, formatPeso } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PaymentReceipt as PaymentReceiptData } from '@/types';

/** Keep the gold band when printed (browsers drop backgrounds otherwise). */
const keepColors = {
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
} as const;

/**
 * A Payment Receipt, in the style of the issuance slip: the school, PAYMENT
 * RECEIPT on a gold band, the receipt number and date, who paid and for
 * which slip, each line paid for, the total, how it was paid (cash with the
 * amount received and the change, or GCash with its reference), and
 * "Received by" the cashier with a signature line. A voided receipt is
 * stamped VOID with the reason; a cashier's second print onwards says
 * REPRINT; the buyer's own print says BUYER'S COPY.
 */
export default function PaymentReceipt({
    receipt,
    className,
    copyLabel,
}: {
    receipt: PaymentReceiptData;
    className?: string;
    /** "REPRINT" or "BUYER'S COPY", shown at the top-right. */
    copyLabel?: string | null;
}) {
    const { row } = receipt;

    return (
        <article
            style={keepColors}
            className={cn(
                'relative mx-auto w-full max-w-2xl overflow-hidden border border-slate-300 bg-white p-6 text-[13px] text-slate-900 sm:p-8',
                className,
            )}
        >
            {copyLabel && (
                <p className="absolute top-4 right-5 rounded-md border border-slate-400 px-2 py-0.5 text-[10px] font-black tracking-widest text-slate-500">
                    {copyLabel}
                </p>
            )}

            <header className="text-center">
                <p className="text-lg font-black tracking-wide">
                    {receipt.school}
                </p>
                {receipt.address_lines.map((line) => (
                    <p key={line} className="text-xs text-slate-600">
                        {line}
                    </p>
                ))}
                <p className="mt-1 text-xs font-bold text-slate-600">
                    PROWARE Merchandise
                </p>
            </header>

            <p className="mt-3 border-y-2 border-[#1E4E9C] bg-[#F7D44C] py-1.5 text-center text-base font-black tracking-[0.3em]">
                PAYMENT RECEIPT
            </p>

            {row.void && (
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center"
                >
                    <span className="-rotate-12 rounded-xl border-[6px] border-red-600/60 px-8 py-2 text-6xl font-black tracking-[0.2em] text-red-600/60">
                        VOID
                    </span>
                </div>
            )}

            <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <Field label="Receipt No.">
                    <span className="text-base font-black text-red-700">
                        {row.receipt_number}
                    </span>
                </Field>
                <Field label="Date">{formatDateTime(row.paid_at)}</Field>
                <Field label="Received from">{row.buyer_name}</Field>
                <Field label={row.is_staff ? 'Employee ID' : 'Student ID'}>
                    {row.buyer_id ?? ''}
                </Field>
                <Field label={row.is_staff ? 'Office/Department' : 'Section'}>
                    {receipt.section ?? ''}
                </Field>
                <Field label="For">{receipt.for_label}</Field>
            </dl>

            <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-112 border-collapse border border-[#1E4E9C] text-left">
                    <thead className="bg-[#F7D44C] text-[11px] font-black">
                        <tr>
                            <Heading className="w-14">QTY</Heading>
                            <Heading>ITEM</Heading>
                            <Heading className="w-28 text-right">
                                UNIT PRICE
                            </Heading>
                            <Heading className="w-28 text-right">
                                AMOUNT
                            </Heading>
                        </tr>
                    </thead>
                    <tbody>
                        {receipt.lines.map((line, index) => (
                            <tr key={`${line.item}-${index}`}>
                                <Cell className="text-center">
                                    {line.quantity}
                                </Cell>
                                <Cell>{line.item}</Cell>
                                <Cell className="text-right">
                                    {formatPeso(line.unit_price_centavos)}
                                </Cell>
                                <Cell className="text-right font-bold">
                                    {formatPeso(line.amount_centavos)}
                                </Cell>
                            </tr>
                        ))}
                        <tr>
                            <Cell
                                colSpan={3}
                                className="text-right font-black tracking-wide uppercase"
                            >
                                Total amount paid
                            </Cell>
                            <Cell className="text-right text-base font-black">
                                {formatPeso(row.amount_centavos)}
                            </Cell>
                        </tr>
                    </tbody>
                </table>
            </div>

            <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                <Field label="Payment method">{row.method_label}</Field>
                {row.method === 'cash' ? (
                    <>
                        <Field label="Amount received">
                            {formatPeso(row.amount_received_centavos)}
                        </Field>
                        <Field label="Change">
                            {formatPeso(row.change_centavos)}
                        </Field>
                    </>
                ) : (
                    <Field label="GCash reference no.">
                        <span className="font-mono">{row.gcash_reference}</span>
                    </Field>
                )}
            </dl>

            {row.void && (
                <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">
                    VOID on {formatDateTime(row.voided_at)}
                    {row.voided_by ? ` by ${row.voided_by}` : ''}:{' '}
                    {row.void_reason}
                </p>
            )}

            <div className="mt-8 grid gap-8 sm:grid-cols-2">
                <Signature
                    name={row.cashier ?? ''}
                    caption="Received by (Signature Over Printed Name)"
                />
                <Signature
                    name={row.buyer_name}
                    caption="Paid by (Signature Over Printed Name)"
                />
            </div>

            <p className="mt-6 border-t border-slate-200 pt-3 text-center text-[11px] text-slate-500">
                {receipt.note}
            </p>
        </article>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-end gap-2">
            <dt className="shrink-0 font-bold">{label}:</dt>
            <dd className="min-w-0 flex-1 border-b border-slate-400 pb-0.5">
                {children}
            </dd>
        </div>
    );
}

function Heading({
    className,
    children,
}: {
    className?: string;
    children: ReactNode;
}) {
    return (
        <th
            className={cn(
                'border border-[#1E4E9C] px-2 py-1.5 text-center',
                className,
            )}
        >
            {children}
        </th>
    );
}

function Cell({
    className,
    colSpan,
    children,
}: {
    className?: string;
    colSpan?: number;
    children: ReactNode;
}) {
    return (
        <td
            colSpan={colSpan}
            className={cn('border border-[#1E4E9C] px-2 py-1.5', className)}
        >
            {children}
        </td>
    );
}

function Signature({ name, caption }: { name: string; caption: string }) {
    return (
        <div className="text-center">
            <p className="border-b border-slate-500 pb-1 font-bold">{name}</p>
            <p className="mt-1 text-[11px] text-slate-500">{caption}</p>
        </div>
    );
}
