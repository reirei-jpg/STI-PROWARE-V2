import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Printer, ScanLine } from 'lucide-react';
import CashierController from '@/actions/App/Http/Controllers/CashierController';
import CashierRecordsController from '@/actions/App/Http/Controllers/CashierRecordsController';
import PageHeader from '@/components/page-header';
import PaymentReceipt from '@/components/payment-receipt';
import type { PaymentReceipt as PaymentReceiptData } from '@/types';

/**
 * A Payment Receipt on screen: right after Mark as Paid, or opened from
 * Payment History. The cashier prints it (each print after the first is
 * marked REPRINT); the School Admin views it read-only.
 */
export default function CashierReceipt({
    receipt,
    canPrint,
}: {
    receipt: PaymentReceiptData;
    canPrint: boolean;
}) {
    return (
        <>
            <Head
                title={`Payment Receipt ${receipt.row.receipt_number ?? ''}`}
            />

            <div className="space-y-6">
                <PageHeader
                    title="Payment Receipt"
                    description={
                        receipt.row.void
                            ? 'This receipt has been voided. It stays on record but is not counted in the collections.'
                            : canPrint
                              ? 'Print the receipt and give it to the buyer. Each print after the first is marked REPRINT.'
                              : 'View only.'
                    }
                    actions={
                        <div className="flex flex-wrap gap-2">
                            <Link
                                href={CashierRecordsController.history()}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
                            >
                                <ArrowLeft size={17} />
                                Payment History
                            </Link>
                            {canPrint && (
                                <>
                                    <Link
                                        href={CashierController.record()}
                                        className="inline-flex items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 py-2.5 text-sm font-black text-blue-700 shadow-sm hover:bg-blue-100"
                                    >
                                        <ScanLine size={17} />
                                        Record the next payment
                                    </Link>
                                    <a
                                        href={
                                            CashierController.printReceipt(
                                                receipt.row.id,
                                            ).url
                                        }
                                        target="_blank"
                                        rel="noopener"
                                        data-test="print-receipt"
                                        className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-blue-700"
                                    >
                                        <Printer size={17} />
                                        {receipt.prints > 0
                                            ? 'Reprint receipt'
                                            : 'Print receipt'}
                                    </a>
                                </>
                            )}
                        </div>
                    }
                />

                <div className="rounded-3xl bg-slate-200 px-4 py-8">
                    <PaymentReceipt receipt={receipt} className="shadow-2xl" />
                </div>
            </div>
        </>
    );
}
