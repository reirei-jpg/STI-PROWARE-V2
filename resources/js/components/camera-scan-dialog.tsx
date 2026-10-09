import { Camera, CameraOff, LoaderCircle, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';

type CameraState = 'starting' | 'scanning' | 'failed';

/**
 * Scan an issuance slip's QR with the computer's camera (a laptop webcam
 * or a USB camera): the student holds up their phone or the printed slip,
 * and the first QR read is handed back. The camera stops when the popup
 * closes. The QR reader is loaded only when the popup opens.
 */
export default function CameraScanDialog({
    open,
    onClose,
    onScanned,
}: {
    open: boolean;
    onClose: () => void;
    onScanned: (code: string) => void;
}) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [state, setState] = useState<CameraState>('starting');
    const [problem, setProblem] = useState<string | null>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        let stopped = false;
        let scanner: { destroy: () => void } | null = null;

        setState('starting');
        setProblem(null);

        const start = async () => {
            if (!window.isSecureContext) {
                throw new Error('insecure');
            }

            const { default: QrScanner } = await import('qr-scanner');

            if (stopped || videoRef.current === null) {
                return;
            }

            let handedBack = false;
            const qrScanner = new QrScanner(
                videoRef.current,
                (result) => {
                    // One scan opens one slip; the camera keeps seeing the QR.
                    if (!handedBack && result.data.trim() !== '') {
                        handedBack = true;
                        onScanned(result.data.trim());
                    }
                },
                {
                    returnDetailedScanResult: true,
                    highlightScanRegion: true,
                    highlightCodeOutline: true,
                    preferredCamera: 'environment',
                },
            );
            scanner = qrScanner;

            await qrScanner.start();

            if (!stopped) {
                setState('scanning');
            }
        };

        start().catch((error: unknown) => {
            if (stopped) {
                return;
            }

            const text = String(
                error instanceof Error
                    ? `${error.name} ${error.message}`
                    : error,
            );

            setState('failed');
            setProblem(
                text.includes('insecure')
                    ? 'The browser allows the camera only on a secure address (https, or 127.0.0.1 on this computer). Type the order number instead.'
                    : text.includes('NotAllowed') || text.includes('Permission')
                      ? 'The camera was blocked. Click the camera icon in the address bar, allow it, then try again.'
                      : text.includes('not found') || text.includes('NotFound')
                        ? 'No camera was found on this computer. Type the order number instead.'
                        : 'The camera could not start. Close other apps using it, then try again, or type the order number.',
            );
        });

        return () => {
            stopped = true;
            scanner?.destroy();
        };
        // Starts once per opening; onScanned is read when a QR is found.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-lg [&>button:last-child]:hidden">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                    <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                            <Camera size={22} />
                        </span>
                        <div>
                            <DialogTitle className="text-lg font-black text-slate-900">
                                Scan with camera
                            </DialogTitle>
                            <DialogDescription className="text-sm text-slate-500">
                                Hold the slip's QR (on the student's phone or
                                paper) up to the camera.
                            </DialogDescription>
                        </div>
                    </div>
                    <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                        <X size={20} />
                        <span className="sr-only">Close</span>
                    </DialogClose>
                </div>

                <div className="p-6">
                    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-slate-900">
                        <video
                            ref={videoRef}
                            muted
                            playsInline
                            className="h-full w-full object-cover"
                        />
                        {state === 'starting' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm font-bold text-white">
                                <LoaderCircle
                                    size={28}
                                    className="animate-spin"
                                />
                                Starting the camera…
                            </div>
                        )}
                        {state === 'failed' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
                                <CameraOff size={36} className="text-red-300" />
                                <p className="text-sm leading-6 font-semibold text-white">
                                    {problem}
                                </p>
                            </div>
                        )}
                    </div>
                    <p className="mt-3 text-center text-xs text-slate-500">
                        {state === 'scanning'
                            ? 'Looking for a QR code… The slip opens by itself.'
                            : 'Your browser may ask to use the camera the first time.'}
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
