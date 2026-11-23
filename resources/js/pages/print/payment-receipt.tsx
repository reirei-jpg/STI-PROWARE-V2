import { Head } from '@inertiajs/react';
import { Printer, X } from 'lucide-react';
import { useEffect } from 'react';
import PaymentReceipt from '@/components/payment-receipt';
import type { PaymentReceipt as PaymentReceiptData } from '@/types';

/**
 * The Payment Receipt alone on the page, for paper: it opens in its own
 * tab and asks to print at once. The cashier's second print onwards is
 * marked REPRINT; the buyer's own print is marked BUYER'S COPY. The buttons
 * are not printed.
 */
export default function PrintPaymentReceipt({
    receipt,
    buyerCopy = false,
}: {
    receipt: PaymentReceiptData;
    buyerCopy?: boolean;
}) {
    useEffect(() => {
        window.print();
    }, []);

    const close = () => {
        window.close();
        // A tab the browser will not close (opened by hand) goes back instead.
        window.history.back();
    };

    return (
        <>
            <Head
                title={`Payment Receipt ${receipt.row.receipt_number ?? ''}`}
            />

            {/* A till slip: 80 mm wide, as long as the receipt. */}
            <style>{'@page { size: 80mm auto; margin: 4mm; }'}</style>

            <div className="min-h-screen bg-slate-200 px-4 py-6 print:bg-white print:p-0">
                <div className="mx-auto mb-4 flex max-w-[380px] justify-end gap-2 print:hidden">
                    <button
                        type="button"
                        onClick={close}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                        <X size={17} />
                        Close
                    </button>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-blue-700"
                    >
                        <Printer size={17} />
                        Print
                    </button>
                </div>

                <PaymentReceipt
                    receipt={receipt}
                    copyLabel={
                        buyerCopy
                            ? "BUYER'S COPY"
                            : receipt.prints > 1
                              ? 'REPRINT'
                              : null
                    }
                    className="shadow-2xl print:max-w-none print:px-0 print:py-0 print:shadow-none"
                />
            </div>
        </>
    );
}
