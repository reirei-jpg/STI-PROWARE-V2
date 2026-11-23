import { CheckCircle2 } from 'lucide-react';
import { formatDateTime, formatPeso } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PaymentReceipt as PaymentReceiptData } from '@/types';

/**
 * A Payment Receipt like V1's: a narrow till slip (80 mm when printed) in a
 * typewriter font with dashed lines. STI PROWARE and the school on top,
 * PAYMENT RECEIPT, the receipt number, slip, date and cashier, who paid,
 * each item with "qty x price", the total between two thick lines, how it
 * was paid (cash with the amount received and the change, or GCash with its
 * reference), PAYMENT CONFIRMED, the signature lines and the note that it is
 * not an official receipt. A voided receipt is stamped VOID with the
 * reason; a cashier's second print onwards says REPRINT; the buyer's own
 * print says BUYER'S COPY.
 */
export default function PaymentReceipt({
    receipt,
    className,
    copyLabel,
}: {
    receipt: PaymentReceiptData;
    className?: string;
    /** "REPRINT" or "BUYER'S COPY", shown at the top. */
    copyLabel?: string | null;
}) {
    const { row } = receipt;
    const pieces = receipt.lines.reduce((sum, line) => sum + line.quantity, 0);

    return (
        <article
            data-test="payment-receipt"
            className={cn(
                'relative mx-auto w-full max-w-[380px] overflow-hidden bg-white px-6 py-8 font-mono text-[12px] leading-5 text-black',
                className,
            )}
        >
            {copyLabel && (
                <p className="mb-3 text-center text-[10px] font-black tracking-[0.3em]">
                    *** {copyLabel} ***
                </p>
            )}

            <header className="text-center">
                <p className="text-xl font-black tracking-tight">STI PROWARE</p>
                <p className="mt-1 text-[10px] font-bold uppercase">
                    {receipt.school}
                </p>
                {receipt.address_lines.map((line) => (
                    <p key={line} className="text-[10px]">
                        {line}
                    </p>
                ))}
                <p className="mt-3 text-[12px] font-black tracking-[0.2em] uppercase">
                    Payment Receipt
                </p>
            </header>

            {row.void && (
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center"
                >
                    <span className="-rotate-12 rounded-xl border-[5px] border-red-600/60 px-6 py-1 text-5xl font-black tracking-[0.2em] text-red-600/60">
                        VOID
                    </span>
                </div>
            )}

            <Divider />

            <section>
                <Row label="RECEIPT NO." value={row.receipt_number ?? '—'} />
                <Row
                    label={row.kind === 'order' ? 'ORDER' : 'PREORDER SLIP'}
                    value={row.number ?? '—'}
                />
                <Row label="DATE PAID" value={formatDateTime(row.paid_at)} />
                <Row label="CASHIER" value={row.cashier ?? '—'} />
            </section>

            <Divider />

            <section>
                <p className="mb-1 font-black uppercase">
                    {row.is_staff ? 'Employee' : 'Student'}
                </p>
                <p className="font-black">{row.buyer_name}</p>
                <p>{row.buyer_id || '—'}</p>
                <p>{receipt.section || '—'}</p>
            </section>

            <Divider />

            <section>
                <p className="grid grid-cols-[1fr_auto] gap-3 font-black uppercase">
                    <span>Item</span>
                    <span>Amount</span>
                </p>
                <ul className="mt-3 space-y-3">
                    {receipt.lines.map((line, index) => {
                        const { name, option } = splitItem(line.item);

                        return (
                            <li
                                key={`${line.item}-${index}`}
                                className="grid grid-cols-[1fr_auto] gap-3"
                            >
                                <div className="min-w-0">
                                    <p className="font-black">{name}</p>
                                    {option && (
                                        <p className="text-[10px]">{option}</p>
                                    )}
                                    <p className="text-[10px]">
                                        {line.quantity} x{' '}
                                        {formatPeso(line.unit_price_centavos)}
                                    </p>
                                </div>
                                <p className="font-black">
                                    {formatPeso(line.amount_centavos)}
                                </p>
                            </li>
                        );
                    })}
                </ul>
            </section>

            <Divider />

            <Row label="TOTAL ITEMS" value={String(pieces)} />

            <div className="my-4 border-y-2 border-black py-3">
                <p className="flex items-end justify-between gap-4">
                    <span className="text-base font-black">TOTAL</span>
                    <span
                        data-test="receipt-total"
                        className={cn(
                            'text-xl font-black',
                            row.void && 'line-through',
                        )}
                    >
                        {formatPeso(row.amount_centavos)}
                    </span>
                </p>
            </div>

            <section>
                <Row label="METHOD" value={row.method_label} />
                {row.method === 'cash' ? (
                    <>
                        <Row
                            label="AMOUNT RECEIVED"
                            value={formatPeso(row.amount_received_centavos)}
                        />
                        <Row
                            label="CHANGE"
                            value={formatPeso(row.change_centavos)}
                        />
                    </>
                ) : (
                    <Row label="REFERENCE" value={row.gcash_reference ?? '—'} />
                )}
            </section>

            {row.void && (
                <p className="mt-4 border border-dashed border-red-700 px-2 py-1.5 text-[11px] font-bold text-red-800">
                    VOIDED {formatDateTime(row.voided_at)}
                    {row.voided_by ? ` by ${row.voided_by}` : ''}:{' '}
                    {row.void_reason}
                </p>
            )}

            <Divider />

            <section className="text-center">
                {!row.void && (
                    <p className="flex items-center justify-center gap-2 font-black">
                        <CheckCircle2 size={16} />
                        PAYMENT CONFIRMED
                    </p>
                )}
                <p className="mx-auto mt-2 max-w-[270px] text-[10px] leading-4">
                    Keep this receipt as proof of your payment.
                </p>
            </section>

            <div className="mt-6 space-y-5">
                <Signature
                    name={row.cashier ?? ''}
                    caption="Received by (signature over printed name)"
                />
                <Signature
                    name={row.buyer_name}
                    caption="Paid by (signature over printed name)"
                />
            </div>

            <p className="mt-6 text-center text-xs font-black uppercase">
                Thank you!
            </p>

            <Divider />

            <p className="text-center text-[9px] leading-4">{receipt.note}</p>
        </article>
    );
}

/** "STI Classic Tee (Black / M)" -> the name, and the size/color below it. */
function splitItem(item: string): { name: string; option: string | null } {
    const match = item.match(/^(.*) \(([^()]*)\)$/);

    return match
        ? { name: match[1], option: match[2] }
        : { name: item, option: null };
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <p className="flex items-start justify-between gap-5">
            <span>{label}</span>
            <span className="max-w-[65%] text-right font-black break-words">
                {value}
            </span>
        </p>
    );
}

function Divider() {
    return <div className="my-4 border-t border-dashed border-black/60" />;
}

function Signature({ name, caption }: { name: string; caption: string }) {
    return (
        <div className="text-center">
            <p className="border-b border-black pb-0.5 font-bold">{name}</p>
            <p className="mt-0.5 text-[9px]">{caption}</p>
        </div>
    );
}
