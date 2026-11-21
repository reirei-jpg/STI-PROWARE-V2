import { Head } from '@inertiajs/react';
import { ArrowLeft, Printer } from 'lucide-react';
import StudentOrderController from '@/actions/App/Http/Controllers/StudentOrderController';
import PaymentReceipt from '@/components/payment-receipt';
import type { PaymentReceipt as PaymentReceiptData } from '@/types';

/**
 * The buyer's own Payment Receipt, issued by the cashier: proof of what
 * they paid. Opened from the order's issuance slip or the preorder slip.
 */
export default function BuyerPaymentReceipt({
    receipt,
}: {
    receipt: PaymentReceiptData;
}) {
    return (
        <>
            <Head
                title={`Payment Receipt ${receipt.row.receipt_number ?? ''}`}
            />

            <div className="space-y-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">
                            Payment Receipt
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            {receipt.row.void
                                ? 'This receipt is VOID: the cashier undid the payment.'
                                : 'Issued by the cashier. Keep it as proof of your payment.'}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => window.history.back()}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
                        >
                            <ArrowLeft size={17} />
                            Back
                        </button>
                        <a
                            href={
                                StudentOrderController.printReceipt(
                                    receipt.row.id,
                                ).url
                            }
                            target="_blank"
                            rel="noopener"
                            className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-blue-700"
                        >
                            <Printer size={17} />
                            Print
                        </a>
                    </div>
                </div>

                <PaymentReceipt
                    receipt={receipt}
                    className="rounded-2xl shadow-sm"
                />
            </div>
        </>
    );
}
