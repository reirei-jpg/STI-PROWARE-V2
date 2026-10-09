import { router } from '@inertiajs/react';
import { Camera, QrCode, Search } from 'lucide-react';
import { useState } from 'react';
import OrderController from '@/actions/App/Http/Controllers/OrderController';
import CameraScanDialog from '@/components/camera-scan-dialog';
import { cn } from '@/lib/utils';

/**
 * Open a student's issuance slip: Scan with camera (the computer's webcam
 * reads the QR on the student's phone or paper), a USB scanner (it types
 * the code and presses Enter by itself), or type the order number
 * ("PW-0042") when there is nothing to scan. The box is ready for a USB
 * scanner as soon as the page opens.
 */
export default function SlipScanBox({
    initialCode = '',
    className,
}: {
    initialCode?: string;
    className?: string;
}) {
    const [code, setCode] = useState(initialCode);
    const [scanning, setScanning] = useState(false);

    const open = (value: string) => {
        if (value.trim() !== '') {
            router.get(OrderController.slip().url, { code: value.trim() });
        }
    };

    return (
        <section
            className={cn(
                'rounded-3xl border border-l-4 border-slate-200 border-l-blue-500 bg-white p-5 shadow-sm',
                className,
            )}
        >
            <h2 className="flex items-center gap-2 font-black text-slate-900">
                <QrCode size={20} className="text-blue-600" />
                Scan an issuance slip
            </h2>
            <p className="mt-1 text-sm text-slate-500">
                Use Scan with camera to read the QR on the student's slip (on
                their phone or paper), or type the order number.
            </p>
            <form
                className="mt-3 flex flex-col gap-2 sm:flex-row"
                onSubmit={(event) => {
                    event.preventDefault();
                    open(code);
                }}
            >
                <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                    <Search size={18} className="shrink-0" />
                    <input
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                        // Ready for the scanner without a click.
                        autoFocus
                        maxLength={120}
                        placeholder="Type the order number, e.g. PW-0042"
                        className="w-full min-w-0 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                        aria-label="Slip code or order number"
                    />
                </label>
                <button
                    type="submit"
                    disabled={code.trim() === ''}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-5 text-sm font-black text-blue-700 transition hover:bg-blue-100 disabled:opacity-60"
                >
                    Open slip
                </button>
                <button
                    type="button"
                    onClick={() => setScanning(true)}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0D6EFD] px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700"
                >
                    <Camera size={17} />
                    Scan with camera
                </button>
            </form>

            <CameraScanDialog
                open={scanning}
                onClose={() => setScanning(false)}
                onScanned={(scanned) => {
                    setScanning(false);
                    open(scanned);
                }}
            />
        </section>
    );
}
