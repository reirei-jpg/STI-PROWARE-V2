import { ChevronLeft, ChevronRight, ImageIcon, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PriceLines, saleEndsText } from '@/components/storefront-tile';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { StorefrontSpotlightItem, StorefrontTileProduct } from '@/types';

/** Remembered for the browser tab, so the pop-up shows once per visit. */
const SEEN_KEY = 'proware.store-spotlight-seen';
/** How long each item shows before the next one slides in. */
const SLIDE_MS = 4000;

function seenThisVisit(): boolean {
    try {
        return window.sessionStorage.getItem(SEEN_KEY) === '1';
    } catch {
        return false;
    }
}

function rememberSeen(): void {
    try {
        window.sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
        // Private windows may block storage; the pop-up then shows again next time.
    }
}

/**
 * The store pop-up, like an ad: on the first page of a visit it shows the
 * products that came back in stock or are on sale, one at a time with a big
 * photo, sliding to the next by itself (the dots and arrows switch too).
 * View opens the product; X or Close hides it for the rest of the visit.
 * Nothing shows when there is nothing back in stock or on sale.
 */
export default function StoreSpotlight({
    items,
    onView,
}: {
    items: StorefrontSpotlightItem[];
    onView: (product: StorefrontTileProduct) => void;
}) {
    const [open, setOpen] = useState(false);
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        if (items.length > 0 && !seenThisVisit()) {
            rememberSeen();
            setOpen(true);
        }
        // Only on the first page of the visit, not after each reload of its data.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!open || paused || items.length < 2) {
            return;
        }

        const timer = window.setInterval(
            () => setIndex((current) => (current + 1) % items.length),
            SLIDE_MS,
        );

        return () => window.clearInterval(timer);
    }, [open, paused, items.length]);

    const item = items[Math.min(index, items.length - 1)];

    if (!item) {
        return null;
    }

    const { product } = item;
    const backInStock = item.reason === 'back_in_stock';
    const view = () => {
        setOpen(false);
        onView(product);
    };
    const go = (step: number) =>
        setIndex((current) => (current + step + items.length) % items.length);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent
                className="gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-md [&>button:last-child]:hidden"
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
            >
                <div className="flex items-center justify-between gap-4 px-5 pt-4 pb-3">
                    <div>
                        <DialogTitle className="text-lg font-black text-slate-900">
                            New in the store
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Back in stock and on sale at the PROWARE office.
                        </DialogDescription>
                    </div>
                    <DialogClose className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                        <X size={18} />
                        <span className="sr-only">Close</span>
                    </DialogClose>
                </div>

                <button
                    type="button"
                    onClick={view}
                    className="relative block aspect-[4/3] w-full overflow-hidden bg-slate-100 text-slate-300"
                    aria-label={`View ${product.name}`}
                >
                    {product.photo_url ? (
                        <img
                            key={product.id}
                            src={product.photo_url}
                            alt={product.name}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <span className="flex h-full items-center justify-center">
                            <ImageIcon size={48} />
                        </span>
                    )}
                    <span
                        className={cn(
                            'absolute top-3 left-3 rounded-lg px-2.5 py-1 text-xs font-black tracking-wide',
                            backInStock
                                ? 'bg-emerald-600 text-white'
                                : 'bg-red-500 text-white',
                        )}
                    >
                        {backInStock ? 'BACK IN STOCK' : 'SALE'}
                    </span>
                    {!backInStock && product.sale_ends_at && (
                        <span className="absolute top-3 right-3 rounded-lg bg-white/95 px-2.5 py-1 text-xs font-bold text-red-600">
                            {saleEndsText(product.sale_ends_at)}
                        </span>
                    )}
                </button>

                <div className="space-y-3 px-5 pt-4 pb-5">
                    <div className="space-y-1">
                        <p className="text-base font-black text-slate-900">
                            {product.name}
                        </p>
                        {backInStock && item.back_in_stock.length > 0 && (
                            <p className="text-sm font-semibold text-emerald-700">
                                Back in stock: {item.back_in_stock.join(', ')}
                            </p>
                        )}
                        <PriceLines price={product.price} />
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        {items.length > 1 ? (
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => go(-1)}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                                    aria-label="Previous item"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <div className="flex items-center gap-1.5 px-1">
                                    {items.map((entry, dot) => (
                                        <button
                                            key={entry.product.id}
                                            type="button"
                                            onClick={() => setIndex(dot)}
                                            className={cn(
                                                'h-2 rounded-full transition-all',
                                                dot === index
                                                    ? 'w-5 bg-[#0D6EFD]'
                                                    : 'w-2 bg-slate-300 hover:bg-slate-400',
                                            )}
                                            aria-label={`Show ${entry.product.name}`}
                                        />
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => go(1)}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                                    aria-label="Next item"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        ) : (
                            <span />
                        )}
                        <button
                            type="button"
                            onClick={view}
                            className="rounded-xl bg-[#0D6EFD] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
                        >
                            View
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
