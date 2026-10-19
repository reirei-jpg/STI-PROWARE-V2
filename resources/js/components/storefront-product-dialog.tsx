import { useHttp } from '@inertiajs/react';
import {
    CalendarClock,
    ImageIcon,
    LoaderCircle,
    ShoppingCart,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import StorefrontController from '@/actions/App/Http/Controllers/StorefrontController';
import { useAddToCart } from '@/components/add-to-cart-dialog';
import { usePreorder } from '@/components/preorder-dialog';
import { PriceLines, saleEndsText } from '@/components/storefront-tile';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDateOrdered } from '@/lib/format';
import { choiceIsOpen } from '@/lib/option-picker';
import { cn } from '@/lib/utils';
import type { StorefrontProductDetails, StorefrontTileProduct } from '@/types';

/**
 * The view of one product, opened from its tile: all photos, the price per
 * piece and per pack, and each option's choices (crossed out when none are
 * left; those can be preordered). Add to Cart and Preorder open their
 * pickers (a signed-out visitor is asked to sign in). A product sold out in
 * every size offers Preorder while it can be preordered.
 */
export default function StorefrontProductDialog({
    product,
    onClose,
}: {
    product: StorefrontTileProduct | null;
    onClose: () => void;
}) {
    const addToCart = useAddToCart();
    const preorder = usePreorder();
    const http = useHttp<Record<string, never>, StorefrontProductDetails>({});
    const [details, setDetails] = useState<StorefrontProductDetails | null>(
        null,
    );
    const [failed, setFailed] = useState(false);
    const [photoIndex, setPhotoIndex] = useState(0);

    useEffect(() => {
        if (product === null) {
            return;
        }

        setDetails(null);
        setFailed(false);
        setPhotoIndex(0);

        void http
            .get(StorefrontController.show(product.id).url, {
                onSuccess: (response) => setDetails(response),
                onHttpException: () => {
                    setFailed(true);

                    return false;
                },
                onNetworkError: () => {
                    setFailed(true);

                    return false;
                },
            })
            .catch(() => setFailed(true));
        // Load once per opened product; `http` changes on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [product?.id]);

    const shown = details ?? product;
    const photo = details?.photos[photoIndex]?.url ?? product?.photo_url;
    const comingSoon = shown?.status === 'preorder';
    // Coming Soon, or out of stock in every size with sizes to preorder.
    const takesPreorders =
        shown !== undefined &&
        shown !== null &&
        (comingSoon || shown.sold_out) &&
        shown.accepts_preorders;
    const hasOptions =
        details !== null &&
        (details.variants.length > 1 || details.options.length > 0);

    return (
        <Dialog
            open={product !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-3xl [&>button:last-child]:hidden">
                {shown && (
                    <>
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
                            <div>
                                <DialogTitle className="text-xl font-black text-slate-900">
                                    {shown.name}
                                </DialogTitle>
                                <DialogDescription className="text-sm text-slate-500">
                                    {comingSoon
                                        ? 'Coming soon · preorder it now'
                                        : shown.sold_out
                                          ? shown.accepts_preorders
                                              ? 'Out of stock · preorder it to be notified when it is back'
                                              : 'Out of stock for now'
                                          : shown.sale_ends_at
                                            ? `On sale · ${saleEndsText(shown.sale_ends_at).toLowerCase()}`
                                            : 'Official STI merchandise'}
                                </DialogDescription>
                            </div>
                            <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                                <X size={20} />
                                <span className="sr-only">Close</span>
                            </DialogClose>
                        </div>

                        <div className="grid gap-6 overflow-y-auto p-6 md:grid-cols-2">
                            <div className="space-y-3">
                                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-slate-300">
                                    {photo ? (
                                        <img
                                            src={photo}
                                            alt={
                                                details?.photos[photoIndex]
                                                    ?.label ?? shown.name
                                            }
                                            className={cn(
                                                'h-full w-full object-cover',
                                                shown.sold_out && 'grayscale',
                                            )}
                                        />
                                    ) : (
                                        <ImageIcon size={48} />
                                    )}
                                </div>
                                {details && details.photos.length > 1 && (
                                    <div className="flex gap-2 overflow-x-auto">
                                        {details.photos.map((item, index) => (
                                            <button
                                                key={item.url}
                                                type="button"
                                                onClick={() =>
                                                    setPhotoIndex(index)
                                                }
                                                className={cn(
                                                    'h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2',
                                                    index === photoIndex
                                                        ? 'border-[#0D6EFD]'
                                                        : 'border-transparent',
                                                )}
                                                aria-label={
                                                    item.label ??
                                                    `Photo ${index + 1}`
                                                }
                                            >
                                                <img
                                                    src={item.url}
                                                    alt=""
                                                    className="h-full w-full object-cover"
                                                />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-5">
                                <PriceLines price={shown.price} large />

                                {shown.almost_sold_out &&
                                    shown.pieces_left !== null && (
                                        <p className="inline-flex rounded-lg bg-orange-100 px-3 py-1.5 text-sm font-black text-orange-800">
                                            Almost sold out · Only{' '}
                                            {shown.pieces_left} left
                                        </p>
                                    )}

                                {failed ? (
                                    <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                                        The sizes and colors could not be
                                        loaded. Close this and try again.
                                    </p>
                                ) : !details ? (
                                    <p className="flex items-center gap-2 text-sm text-slate-500">
                                        <LoaderCircle
                                            size={16}
                                            className="animate-spin"
                                        />
                                        Loading...
                                    </p>
                                ) : (
                                    hasOptions && (
                                        <div className="space-y-3">
                                            {details.options.map((option) => (
                                                <div key={option.name}>
                                                    <p className="text-sm font-black text-slate-700">
                                                        {option.name}
                                                    </p>
                                                    <div className="mt-1.5 flex flex-wrap gap-2">
                                                        {option.choices.map(
                                                            (choice) => {
                                                                const inStock =
                                                                    choiceIsOpen(
                                                                        details.variants,
                                                                        {},
                                                                        option.name,
                                                                        choice,
                                                                        (
                                                                            variant,
                                                                        ) =>
                                                                            variant.availability !==
                                                                            'sold_out',
                                                                    );

                                                                return (
                                                                    <span
                                                                        key={
                                                                            choice
                                                                        }
                                                                        className={cn(
                                                                            'rounded-lg border px-3 py-1.5 text-sm font-semibold',
                                                                            inStock
                                                                                ? 'border-slate-200 bg-white text-slate-700'
                                                                                : 'border-dashed border-slate-200 bg-slate-50 text-slate-400 line-through',
                                                                        )}
                                                                    >
                                                                        {choice}
                                                                    </span>
                                                                );
                                                            },
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                            <p className="text-xs text-slate-500">
                                                {takesPreorders
                                                    ? 'Choose yours when you click Preorder.'
                                                    : 'Choose yours when you click Add to Cart. Crossed out means none are left; you can preorder those there.'}
                                            </p>
                                        </div>
                                    )
                                )}

                                {comingSoon && shown.preorders_close_on && (
                                    <p className="text-sm font-bold text-amber-700">
                                        {shown.accepts_preorders
                                            ? `Preorder until ${formatDateOrdered(shown.preorders_close_on)}`
                                            : `Preorders closed on ${formatDateOrdered(shown.preorders_close_on)}`}
                                    </p>
                                )}
                                {comingSoon && shown.expected_arrival && (
                                    <p className="text-sm font-semibold text-slate-700">
                                        Expected to arrive{' '}
                                        {shown.expected_arrival}
                                    </p>
                                )}

                                {shown.sold_out && !shown.accepts_preorders ? (
                                    <p className="rounded-xl bg-slate-100 px-4 py-3 text-center text-sm font-black text-slate-500">
                                        Out of stock for now
                                    </p>
                                ) : comingSoon && !shown.accepts_preorders ? (
                                    <p className="rounded-xl bg-slate-100 px-4 py-3 text-center text-sm font-black text-slate-500">
                                        Preorders closed
                                    </p>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (product === null) {
                                                return;
                                            }

                                            onClose();

                                            if (takesPreorders) {
                                                preorder(product);
                                            } else {
                                                addToCart(product);
                                            }
                                        }}
                                        className={cn(
                                            'inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition',
                                            takesPreorders
                                                ? 'bg-amber-400 text-amber-950 hover:bg-amber-300'
                                                : 'bg-[#0D6EFD] text-white hover:bg-blue-700',
                                        )}
                                    >
                                        {takesPreorders ? (
                                            <CalendarClock size={17} />
                                        ) : (
                                            <ShoppingCart size={17} />
                                        )}
                                        {takesPreorders
                                            ? 'Preorder'
                                            : 'Add to Cart'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
