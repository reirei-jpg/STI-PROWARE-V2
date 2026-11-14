import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import StudentPreorderController from '@/actions/App/Http/Controllers/StudentPreorderController';
import IssuanceSlip from '@/components/issuance-slip';
import { formatDateOrdered, formatPeso } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { IssuanceSlipData, PreorderSlipData } from '@/types';

/**
 * A batch's preorder slip, opened from My Preorders: show it at the
 * cashier to pay, then the PROWARE office marks it Paid. Once paid it is
 * stamped PAID and is the buyer's proof of payment. There is no refund
 * after paying.
 */
export default function PreorderSlip({ slip }: { slip: PreorderSlipData }) {
    const released = slip.status === 'released';
    const paid = slip.status === 'paid' || released;
    // Laid out like the issuance slip; stamped RELEASED once all was given.
    const asSlip: IssuanceSlipData = {
        ...slip,
        order_id: slip.slip_id,
        status: released ? 'picked_up' : 'placed',
        pick_up_by: null,
        released_on: null,
        issued_by: null,
    };

    return (
        <>
            <Head title={`Preorder Slip ${slip.number ?? ''}`} />

            <div className="space-y-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">
                            Preorder Slip
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Slip {slip.number} for {slip.product_name}.
                        </p>
                    </div>
                    <Link
                        href={StudentPreorderController.index()}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                        <ArrowLeft size={17} />
                        Back to My Preorders
                    </Link>
                </div>

                <div
                    className={cn(
                        'mx-auto flex max-w-3xl items-start gap-3 rounded-2xl border px-5 py-4',
                        paid
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                            : 'border-amber-200 bg-amber-50 text-amber-900',
                    )}
                >
                    {paid ? (
                        <CheckCircle2 size={22} className="mt-0.5 shrink-0" />
                    ) : (
                        <Clock size={22} className="mt-0.5 shrink-0" />
                    )}
                    <div className="text-sm leading-6">
                        <p className="font-black">
                            {released
                                ? 'Released'
                                : paid
                                  ? `Paid ${formatPeso(slip.total_centavos)}${slip.paid_on ? ` on ${formatDateOrdered(slip.paid_on)}` : ''}`
                                  : `Pay ${formatPeso(slip.total_centavos)} at the cashier`}
                        </p>
                        <p>
                            {released
                                ? 'All the items were given to you. Keep this slip as your receipt.'
                                : paid
                                  ? 'Keep this slip: it is your proof of payment. Show it when you get your items.'
                                  : 'Show this slip at the cashier. Once you have paid, the PROWARE office marks it Paid. There is no refund after paying.'}
                        </p>
                    </div>
                </div>

                <IssuanceSlip
                    slip={asSlip}
                    title="PREORDER SLIP"
                    paid={slip.status === 'paid'}
                    className="rounded-2xl shadow-sm"
                />
            </div>
        </>
    );
}
