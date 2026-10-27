import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
    ChevronLeft,
    ChevronRight,
    ImageIcon,
    Sparkles,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { TouchEvent } from 'react';
import { saleEndsText } from '@/components/storefront-tile';
import { DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { formatPeso } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    StorefrontPrice,
    StorefrontSpotlightItem,
    StorefrontTileProduct,
} from '@/types';

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
 * The store pop-up, like an ad, in a soft card over a lightly blurred page:
 * on the first page of a visit it shows the products that came back in
 * stock or are on sale, one at a time with a big photo, fading to the next
 * by itself. The ‹ › arrows on the photo, the ← → keys, a swipe on the photo
 * (touch screens) and the dots switch too. View item opens the product; X, Maybe
 * later or a click outside hides it for the rest of the visit. Nothing shows
 * when there is nothing back in stock or on sale.
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
    const touchX = useRef<number | null>(null);
    // A swipe ends with a tap on the photo; that tap must not open the item.
    const swiped = useRef(false);

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
        // A new item (by hand or by itself) gets its full 4 seconds.
    }, [open, paused, items.length, index]);

    const item = items[Math.min(index, items.length - 1)];

    if (!item) {
        return null;
    }

    const { product } = item;
    const backInStock = item.reason === 'back_in_stock';
    const several = items.length > 1;
    const view = () => {
        setOpen(false);
        onView(product);
    };
    const go = (step: number) =>
        setIndex((current) => (current + step + items.length) % items.length);
    // A swipe on the photo (phones, tablets) goes to the next or previous item.
    const swipe = {
        onTouchStart: (event: TouchEvent) => {
            touchX.current = event.touches[0]?.clientX ?? null;
        },
        onTouchEnd: (event: TouchEvent) => {
            const start = touchX.current;
            const end = event.changedTouches[0]?.clientX;
            touchX.current = null;

            if (
                start === null ||
                end === undefined ||
                Math.abs(end - start) < 40
            ) {
                return;
            }

            swiped.current = true;
            go(end < start ? 1 : -1);
        },
    };

    return (
        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
            <DialogPortal>
                <DialogOverlay className="bg-slate-900/25 backdrop-blur-[3px]" />
                <DialogPrimitive.Content
                    className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-white p-5 shadow-2xl ring-1 shadow-slate-900/10 ring-slate-100 duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
                    onMouseEnter={() => setPaused(true)}
                    onMouseLeave={() => setPaused(false)}
                    onKeyDown={(event) => {
                        if (several && event.key === 'ArrowRight') {
                            go(1);
                        } else if (several && event.key === 'ArrowLeft') {
                            go(-1);
                        }
                    }}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-[#0D6EFD]">
                                <Sparkles size={17} />
                            </span>
                            <div>
                                <DialogPrimitive.Title className="text-base font-bold text-slate-800">
                                    New in the store
                                </DialogPrimitive.Title>
                                <DialogPrimitive.Description className="text-xs text-slate-400">
                                    Back in stock and on sale
                                </DialogPrimitive.Description>
                            </div>
                        </div>
                        <DialogPrimitive.Close className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700">
                            <X size={16} />
                            <span className="sr-only">Close</span>
                        </DialogPrimitive.Close>
                    </div>

                    <div
                        key={product.id}
                        className="animate-in duration-300 fade-in-0"
                    >
                        <div className="relative mt-4" {...swipe}>
                            <button
                                type="button"
                                onClick={() => {
                                    if (swiped.current) {
                                        swiped.current = false;

                                        return;
                                    }

                                    view();
                                }}
                                className="block aspect-[4/3] w-full overflow-hidden rounded-2xl bg-slate-50 text-slate-300"
                                aria-label={`View ${product.name}`}
                            >
                                {product.photo_url ? (
                                    <img
                                        src={product.photo_url}
                                        alt={product.name}
                                        className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]"
                                    />
                                ) : (
                                    <span className="flex h-full items-center justify-center">
                                        <ImageIcon size={44} />
                                    </span>
                                )}
                            </button>
                            {several && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => go(-1)}
                                        className="absolute top-1/2 left-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-600 shadow-sm backdrop-blur-sm transition hover:bg-white hover:text-slate-800"
                                        aria-label="Previous item"
                                    >
                                        <ChevronLeft size={18} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => go(1)}
                                        className="absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-600 shadow-sm backdrop-blur-sm transition hover:bg-white hover:text-slate-800"
                                        aria-label="Next item"
                                    >
                                        <ChevronRight size={18} />
                                    </button>
                                </>
                            )}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span
                                className={cn(
                                    'rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
                                    backInStock
                                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                                        : 'bg-rose-50 text-rose-600 ring-rose-100',
                                )}
                            >
                                {backInStock ? 'Back in stock' : 'On sale'}
                            </span>
                            <span className="text-xs text-slate-500">
                                {backInStock
                                    ? item.back_in_stock.join(', ')
                                    : product.sale_ends_at &&
                                      saleEndsText(product.sale_ends_at)}
                            </span>
                        </div>

                        <p className="mt-2 text-lg font-bold text-slate-800">
                            {product.name}
                        </p>
                        <SoftPrice price={product.price} />
                    </div>

                    <button
                        type="button"
                        onClick={view}
                        className="mt-5 w-full rounded-2xl bg-[#0D6EFD] py-3 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-600"
                    >
                        View item
                    </button>
                    <DialogPrimitive.Close className="mt-1 w-full rounded-2xl py-2 text-sm font-medium text-slate-400 transition hover:text-slate-600">
                        Maybe later
                    </DialogPrimitive.Close>

                    {items.length > 1 && (
                        <div className="mt-2 flex items-center justify-center gap-1.5">
                            {items.map((entry, dot) => (
                                <button
                                    key={entry.product.id}
                                    type="button"
                                    onClick={() => setIndex(dot)}
                                    className={cn(
                                        'h-1.5 rounded-full transition-all',
                                        dot === index
                                            ? 'w-5 bg-blue-500/80'
                                            : 'w-1.5 bg-slate-200 hover:bg-slate-300',
                                    )}
                                    aria-label={`Show ${entry.product.name}`}
                                />
                            ))}
                        </div>
                    )}
                </DialogPrimitive.Content>
            </DialogPortal>
        </DialogPrimitive.Root>
    );
}

/**
 * The price in the store's blue: the sale price beside the crossed-out
 * normal price, or the pack price for items sold only by the pack.
 */
function SoftPrice({ price }: { price: StorefrontPrice }) {
    const pack = price.packs[0];
    const normal = price.piece_centavos ?? pack?.price_centavos ?? null;
    const sale =
        price.piece_centavos !== null
            ? price.sale_centavos
            : (pack?.sale_price_centavos ?? null);
    const unit =
        price.piece_centavos !== null || !pack
            ? '/ pc'
            : `/ ${pack.name} of ${pack.pieces}`;

    if (normal === null) {
        return null;
    }

    return (
        <p className="mt-1 flex items-baseline gap-2">
            {price.piece_from && (
                <span className="text-xs text-slate-400">From</span>
            )}
            {sale !== null && (
                <span className="text-sm text-slate-400 line-through">
                    {formatPeso(normal)}
                </span>
            )}
            <span className="text-xl font-bold text-[#0D6EFD]">
                {formatPeso(sale ?? normal)}
            </span>
            <span className="text-xs text-slate-400">{unit}</span>
        </p>
    );
}
