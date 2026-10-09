import { Head } from '@inertiajs/react';
import { Printer, X } from 'lucide-react';
import { useEffect } from 'react';
import IssuanceSlip from '@/components/issuance-slip';
import type { IssuanceSlipData } from '@/types';

/**
 * The issuance slip alone on the page, for paper: it opens in its own tab
 * (from My Orders or the Specialist's slip screen) and asks to print at
 * once. The buttons are not printed.
 */
export default function PrintIssuanceSlip({
    slip,
}: {
    slip: IssuanceSlipData;
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
            <Head title={`Issuance Slip ${slip.number ?? ''}`} />

            <style>{'@page { margin: 12mm; }'}</style>

            <div className="min-h-screen bg-slate-100 px-4 py-6 print:bg-white print:p-0">
                <div className="mx-auto mb-4 flex max-w-3xl justify-end gap-2 print:hidden">
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

                <IssuanceSlip
                    slip={slip}
                    className="shadow-sm print:max-w-none print:border-0 print:shadow-none"
                />
            </div>
        </>
    );
}
