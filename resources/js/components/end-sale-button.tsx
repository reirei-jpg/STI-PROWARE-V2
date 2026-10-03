import { router } from '@inertiajs/react';
import { LoaderCircle, Undo2, X } from 'lucide-react';
import { useState } from 'react';
import ProductSaleController from '@/actions/App/Http/Controllers/ProductSaleController';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * The way back from a sale: ends it now, after a "Are you sure?" step, and
 * the product goes back to Available at its normal price. Shown wherever a
 * product on sale is seen (Products list, Edit Product).
 */
export default function EndSaleButton({
    productId,
    productName,
    onEnded,
    className,
}: {
    productId: number;
    productName: string;
    /** Called after the sale ended, e.g. to show Available in a form. */
    onEnded?: () => void;
    className?: string;
}) {
    const [confirming, setConfirming] = useState(false);
    const [ending, setEnding] = useState(false);

    const endSale = () => {
        setEnding(true);
        router.delete(ProductSaleController.destroy(productId).url, {
            preserveScroll: true,
            onSuccess: () => {
                setConfirming(false);
                onEnded?.();
            },
            onFinish: () => setEnding(false),
        });
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setConfirming(true)}
                className={cn(
                    'inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-white px-3.5 text-sm font-black text-red-700 transition hover:bg-red-50',
                    className,
                )}
            >
                <Undo2 size={15} />
                End sale
            </button>

            <Dialog open={confirming} onOpenChange={setConfirming}>
                <DialogContent className="gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-md [&>button:last-child]:hidden">
                    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                        <div>
                            <DialogTitle className="text-lg font-black text-slate-900">
                                End the sale now?
                            </DialogTitle>
                            <DialogDescription className="mt-1 text-sm text-slate-500">
                                {productName} goes back to Available at its
                                normal price. You can put it on sale again any
                                time.
                            </DialogDescription>
                        </div>
                        <DialogClose className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                            <X size={20} />
                            <span className="sr-only">Close</span>
                        </DialogClose>
                    </div>
                    <div className="flex justify-end gap-3 px-6 py-4">
                        <DialogClose className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                            Keep the sale
                        </DialogClose>
                        <button
                            type="button"
                            onClick={endSale}
                            disabled={ending}
                            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:opacity-60"
                        >
                            {ending && (
                                <LoaderCircle
                                    size={17}
                                    className="animate-spin"
                                />
                            )}
                            End sale
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
