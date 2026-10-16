import { LoaderCircle, X } from 'lucide-react';
import type { ReactNode } from 'react';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * An "Are you sure?" step in PROWARE's own popup (instead of the browser's
 * plain box), e.g. before telling a student the order is ready or lifting
 * a student's pause. The step runs only when confirmed.
 */
export default function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel,
    tone = 'blue',
    busy = false,
    onConfirm,
    onClose,
}: {
    open: boolean;
    title: string;
    description: ReactNode;
    confirmLabel: string;
    cancelLabel: string;
    tone?: 'blue' | 'red';
    busy?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}) {
    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-md [&>button:last-child]:hidden">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                    <div>
                        <DialogTitle className="text-lg font-black text-slate-900">
                            {title}
                        </DialogTitle>
                        <DialogDescription className="mt-1 text-sm leading-6 text-slate-500">
                            {description}
                        </DialogDescription>
                    </div>
                    <DialogClose className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                        <X size={20} />
                        <span className="sr-only">Close</span>
                    </DialogClose>
                </div>
                <div className="flex justify-end gap-3 px-6 py-4">
                    <DialogClose className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                        {cancelLabel}
                    </DialogClose>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={busy}
                        className={cn(
                            'inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white transition disabled:opacity-60',
                            tone === 'red'
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'bg-[#0D6EFD] hover:bg-blue-700',
                        )}
                    >
                        {busy && (
                            <LoaderCircle size={17} className="animate-spin" />
                        )}
                        {confirmLabel}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
