import StaffTag from '@/components/staff-tag';
import { formatDateOrdered, formatPeso } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { IssuanceSlipData } from '@/types';

/**
 * A small order ticket for the cashier, like a fast-food counter slip: the
 * slip number, the buyer, each item with its amount, and the total. The
 * full issuance slip (QR code, school address, signatures) is not needed to
 * take a payment, so the cashier reads only what is being paid for.
 */
export default function PaymentTicket({
    kind,
    number,
    date,
    buyerName,
    buyerId,
    section,
    isStaff,
    items,
    totalCentavos,
    amountDueCentavos,
    paid,
    className,
}: {
    kind: 'order' | 'preorder';
    number: string | null;
    date: string | null;
    buyerName: string;
    buyerId: string | null;
    section: string | null;
    isStaff: boolean;
    items: IssuanceSlipData['items'];
    totalCentavos: number;
    /** What is collected now; less than the total when some items are no longer left. */
    amountDueCentavos: number | null;
    paid: boolean;
    className?: string;
}) {
    const notCharged =
        amountDueCentavos !== null && amountDueCentavos < totalCentavos
            ? totalCentavos - amountDueCentavos
            : 0;

    return (
        <article
            data-test="payment-ticket"
            className={cn(
                'relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm',
                className,
            )}
        >
            <header className="border-b border-dashed border-slate-300 px-5 pt-5 pb-4">
                <p className="text-xs font-black tracking-[0.2em] text-slate-500 uppercase">
                    {kind === 'order' ? 'Order' : 'Preorder slip'}
                </p>
                <p className="mt-0.5 font-mono text-2xl font-black text-red-700">
                    {number}
                </p>
                <p className="mt-2 flex items-center gap-1.5 font-black text-slate-900">
                    {buyerName}
                    {isStaff && <StaffTag />}
                </p>
                <p className="text-sm text-slate-500">
                    {[buyerId, section].filter(Boolean).join(' · ') || '—'}
                    {date && ` · ${formatDateOrdered(date)}`}
                </p>
            </header>

            <ul className="divide-y divide-dashed divide-slate-200 px-5">
                {items.length === 0 && (
                    <li className="py-3 text-sm text-slate-500">
                        No items to pay for.
                    </li>
                )}
                {items.map((line, index) => (
                    <li
                        key={`${line.item}-${index}`}
                        className="flex items-start justify-between gap-3 py-2.5 text-sm"
                    >
                        <span className="min-w-0">
                            <span className="font-bold text-slate-900">
                                {line.quantity} × {line.item}
                            </span>
                            {line.quantity > 1 && (
                                <span className="block text-xs text-slate-500">
                                    {formatPeso(line.unit_price_centavos)} each
                                </span>
                            )}
                        </span>
                        <span className="font-mono font-bold whitespace-nowrap text-slate-900">
                            {formatPeso(line.amount_centavos)}
                        </span>
                    </li>
                ))}
            </ul>

            <footer className="space-y-1 border-t border-dashed border-slate-300 px-5 py-4">
                {notCharged > 0 && (
                    <>
                        <p className="flex justify-between text-sm text-slate-600">
                            Subtotal
                            <span className="font-mono">
                                {formatPeso(totalCentavos)}
                            </span>
                        </p>
                        <p className="flex justify-between text-sm font-semibold text-amber-800">
                            Not left, not charged
                            <span className="font-mono">
                                −{formatPeso(notCharged)}
                            </span>
                        </p>
                    </>
                )}
                <p className="flex items-baseline justify-between">
                    <span className="text-sm font-black tracking-wide text-slate-700 uppercase">
                        Total
                    </span>
                    <span
                        data-test="ticket-total"
                        className="font-mono text-2xl font-black text-slate-950"
                    >
                        {formatPeso(totalCentavos - notCharged)}
                    </span>
                </p>
            </footer>

            {paid && (
                <span className="pointer-events-none absolute top-5 right-5 -rotate-12 rounded-lg border-4 border-emerald-600/70 px-3 py-0.5 text-xl font-black tracking-[0.2em] text-emerald-700/80">
                    PAID
                </span>
            )}
        </article>
    );
}
