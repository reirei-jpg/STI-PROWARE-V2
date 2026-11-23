import { Head } from '@inertiajs/react';
import { Printer, X } from 'lucide-react';
import { useEffect } from 'react';
import { formatDateOrdered, formatDateTime, formatPeso } from '@/lib/format';
import type { PaymentRow, PaymentTotals } from '@/types';

/**
 * The daily collection report, for paper: one day's Payment Receipts (the
 * earliest first), the totals by method for the cash count, the void
 * receipts apart (not counted), and Prepared by / Checked by signatures.
 * It opens in its own tab and asks to print at once.
 */
export default function DailyCollectionReport({
    date,
    totals,
    receipts,
    voided,
    preparedBy,
}: {
    date: string;
    totals: PaymentTotals;
    receipts: PaymentRow[];
    voided: PaymentRow[];
    preparedBy: string;
}) {
    useEffect(() => {
        window.print();
    }, []);

    const close = () => {
        window.close();
        window.history.back();
    };

    return (
        <>
            <Head title={`Daily Collection Report ${date}`} />

            <style>{'@page { margin: 12mm; }'}</style>

            <div className="min-h-screen bg-slate-100 px-4 py-6 print:bg-white print:p-0">
                <div className="mx-auto mb-4 flex max-w-4xl justify-end gap-2 print:hidden">
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

                <article className="mx-auto max-w-4xl border border-slate-300 bg-white p-8 text-[13px] text-slate-900 shadow-sm print:max-w-none print:border-0 print:p-0 print:shadow-none">
                    <header className="text-center">
                        <p className="text-lg font-black tracking-wide">
                            STI COLLEGE-ORMOC, INC.
                        </p>
                        <p className="text-xs text-slate-600">
                            PROWARE Merchandise
                        </p>
                        <p className="mt-3 text-base font-black tracking-[0.2em]">
                            DAILY COLLECTION REPORT
                        </p>
                        <p className="text-sm font-bold">
                            {formatDateOrdered(date)}
                        </p>
                    </header>

                    <table className="mt-5 w-full border-collapse text-left">
                        <tbody>
                            <SumRow
                                label="Cash collected"
                                value={formatPeso(totals.cash_centavos)}
                            />
                            <SumRow
                                label="GCash collected"
                                value={formatPeso(totals.gcash_centavos)}
                            />
                            <SumRow
                                label={`Total collected (${totals.count} ${totals.count === 1 ? 'receipt' : 'receipts'})`}
                                value={formatPeso(totals.total_centavos)}
                                strong
                            />
                            <SumRow
                                label={`Voided receipts, not counted (${totals.void_count})`}
                                value={formatPeso(totals.void_centavos)}
                            />
                        </tbody>
                    </table>

                    <h2 className="mt-6 text-sm font-black tracking-wide uppercase">
                        Receipts issued
                    </h2>
                    {receipts.length === 0 ? (
                        <p className="mt-2 text-slate-500">
                            No payments were recorded on this day.
                        </p>
                    ) : (
                        <ReceiptTable rows={receipts} />
                    )}

                    {voided.length > 0 && (
                        <>
                            <h2 className="mt-6 text-sm font-black tracking-wide text-red-700 uppercase">
                                Voided receipts (not counted)
                            </h2>
                            <ReceiptTable rows={voided} showReason />
                        </>
                    )}

                    <div className="mt-12 grid grid-cols-2 gap-12">
                        <div className="text-center">
                            <p className="border-b border-slate-500 pb-1 font-bold">
                                {preparedBy}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-500">
                                Prepared by (Signature Over Printed Name)
                            </p>
                        </div>
                        <div className="text-center">
                            <p className="border-b border-slate-500 pb-1">
                                &nbsp;
                            </p>
                            <p className="mt-1 text-[11px] text-slate-500">
                                Checked by (Signature Over Printed Name)
                            </p>
                        </div>
                    </div>
                </article>
            </div>
        </>
    );
}

function SumRow({
    label,
    value,
    strong = false,
}: {
    label: string;
    value: string;
    strong?: boolean;
}) {
    return (
        <tr className={strong ? 'text-base font-black' : ''}>
            <td className="border border-slate-300 px-3 py-1.5">{label}</td>
            <td className="w-40 border border-slate-300 px-3 py-1.5 text-right font-bold">
                {value}
            </td>
        </tr>
    );
}

function ReceiptTable({
    rows,
    showReason = false,
}: {
    rows: PaymentRow[];
    showReason?: boolean;
}) {
    return (
        <table className="mt-2 w-full border-collapse text-left text-[12px]">
            <thead className="bg-slate-100 font-black">
                <tr>
                    <th className="border border-slate-300 px-2 py-1">
                        Receipt No.
                    </th>
                    <th className="border border-slate-300 px-2 py-1">Time</th>
                    <th className="border border-slate-300 px-2 py-1">Slip</th>
                    <th className="border border-slate-300 px-2 py-1">Buyer</th>
                    <th className="border border-slate-300 px-2 py-1">
                        Method
                    </th>
                    <th className="border border-slate-300 px-2 py-1">
                        {showReason ? 'Reason' : 'Reference'}
                    </th>
                    <th className="border border-slate-300 px-2 py-1 text-right">
                        Amount
                    </th>
                </tr>
            </thead>
            <tbody>
                {rows.map((row) => (
                    <tr key={row.id}>
                        <td className="border border-slate-300 px-2 py-1 font-bold">
                            {row.receipt_number}
                        </td>
                        <td className="border border-slate-300 px-2 py-1">
                            {formatDateTime(row.paid_at).split(', ').pop()}
                        </td>
                        <td className="border border-slate-300 px-2 py-1">
                            {row.number}
                        </td>
                        <td className="border border-slate-300 px-2 py-1">
                            {row.buyer_name}
                        </td>
                        <td className="border border-slate-300 px-2 py-1">
                            {row.method_label}
                        </td>
                        <td className="border border-slate-300 px-2 py-1">
                            {showReason
                                ? row.void_reason
                                : (row.gcash_reference ?? '')}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-right font-bold">
                            {formatPeso(row.amount_centavos)}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
