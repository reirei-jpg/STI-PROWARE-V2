import { CalendarClock, ImageIcon, ShoppingCart } from 'lucide-react';
import { usePreorder } from '@/components/preorder-dialog';
import { useSignInPrompt } from '@/components/sign-in-prompt';
import { formatDateOrdered, formatPeso } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { StorefrontPrice, StorefrontTileProduct } from '@/types';

/**
 * A merchandise tile (TikTok Shop style): square photo, name, price and
 * Add to Cart. Tapping the photo or name opens the product's view.
 *
 * Badges: SALE (original price crossed out before the sale price), COMING
 * SOON with a Preorder button, "Only 3 left" when almost sold out, and
 * OUT OF STOCK (greyed, no button). Add to Cart and Preorder ask a
 * signed-out visitor to sign in first.
 */
export default function StorefrontTile({
    product,
    onView,
    className,
}: {
    product: StorefrontTileProduct;
    onView: (product: StorefrontTileProduct) => void;
    className?: string;
}) {
    const openSignIn = useSignInPrompt();
    const preorder = usePreorder();
    const comingSoon = product.status === 'preorder';
    const onSale = product.status === 'on_sale';

    return (
        <article
            className={cn(
                'flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
                product.sold_out && 'opacity-70',
                className,
            )}
        >
            <button
                type="button"
                onClick={() => onView(product)}
                className="text-left"
                aria-label={`View ${product.name}`}
            >
                <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-slate-100 text-slate-300">
                    {product.photo_url ? (
                        <img
                            src={product.photo_url}
                            alt=""
                            loading="lazy"
                            className={cn(
                                'h-full w-full object-cover',
                                product.sold_out && 'grayscale',
                            )}
                        />
                    ) : (
                        <ImageIcon size={36} />
                    )}

                    {onSale && !product.sold_out && (
                        <span className="absolute top-2 left-2 rounded-lg bg-red-500 px-2 py-1 text-[11px] font-black text-white">
                            SALE
                        </span>
                    )}

                    {onSale &&
                        !product.sold_out &&
                        product.sale_ends_at !== null && (
                            <span className="absolute top-2 right-2 rounded-lg bg-white/95 px-2 py-1 text-[11px] font-black text-red-600 shadow-sm">
                                {saleEndsText(product.sale_ends_at)}
                            </span>
                        )}

                    {comingSoon && (
                        <span className="absolute top-2 left-2 rounded-lg bg-amber-400 px-2 py-1 text-[11px] font-black text-amber-950">
                            COMING SOON
                        </span>
                    )}

                    {product.almost_sold_out &&
                        product.pieces_left !== null && (
                            <span className="absolute bottom-2 left-2 rounded-lg bg-orange-500 px-2 py-1 text-[11px] font-black text-white shadow-sm">
                                Almost sold out · Only {product.pieces_left}{' '}
                                left
                            </span>
                        )}

                    {product.sold_out && (
                        <span className="absolute inset-0 flex items-center justify-center bg-slate-900/40">
                            <span className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-black tracking-wide text-white">
                                OUT OF STOCK
                            </span>
                        </span>
                    )}
                </div>

                <h3 className="line-clamp-2 px-3 pt-3 text-sm font-bold text-slate-900">
                    {product.name}
                </h3>
            </button>

            <div className="flex flex-1 flex-col gap-2 p-3 pt-1.5">
                <PriceLines price={product.price} />

                {comingSoon && product.preorders_close_on && (
                    <p className="text-[11px] font-bold text-amber-700">
                        {product.accepts_preorders
                            ? `Preorder until ${formatDateOrdered(product.preorders_close_on)}`
                            : 'Preorders closed'}
                    </p>
                )}

                {product.sold_out ? (
                    <span className="mt-auto inline-flex items-center justify-center rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-500">
                        Out of stock
                    </span>
                ) : comingSoon && !product.accepts_preorders ? (
                    <span className="mt-auto inline-flex items-center justify-center rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-500">
                        Preorders closed
                    </span>
                ) : (
                    <button
                        type="button"
                        onClick={
                            comingSoon ? () => preorder(product) : openSignIn
                        }
                        className={cn(
                            'mt-auto inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition',
                            comingSoon
                                ? 'bg-amber-400 text-amber-950 hover:bg-amber-300'
                                : 'bg-[#0D6EFD] text-white hover:bg-blue-700',
                        )}
                    >
                        {comingSoon ? (
                            <CalendarClock size={14} />
                        ) : (
                            <ShoppingCart size={14} />
                        )}
                        {comingSoon ? 'Preorder' : 'Add to Cart'}
                    </button>
                )}
            </div>
        </article>
    );
}

/**
 * An empty tile from the approved storefront layout, shown where a section
 * has no products yet so the layout keeps its shape: grey picture, name and
 * price bars, and the button (not clickable). `sale` and `comingSoon` add
 * the SALE or COMING SOON badge and matching look.
 */
export function PlaceholderTile({
    sale = false,
    comingSoon = false,
    className,
}: {
    sale?: boolean;
    comingSoon?: boolean;
    className?: string;
}) {
    return (
        <article
            aria-hidden="true"
            className={cn(
                'flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm',
                className,
            )}
        >
            <div className="relative flex aspect-square items-center justify-center bg-slate-100 text-slate-300">
                <ImageIcon size={36} />

                {sale && (
                    <span className="absolute top-2 left-2 rounded-lg bg-red-500 px-2 py-1 text-[11px] font-black text-white">
                        SALE
                    </span>
                )}

                {comingSoon && (
                    <span className="absolute top-2 left-2 rounded-lg bg-amber-400 px-2 py-1 text-[11px] font-black text-amber-950">
                        COMING SOON
                    </span>
                )}
            </div>

            <div className="flex flex-1 flex-col gap-2 p-3">
                <div className="space-y-1.5">
                    <div className="h-3 w-11/12 rounded-full bg-slate-100" />
                    <div className="h-3 w-2/3 rounded-full bg-slate-100" />
                </div>

                <div className="mt-auto flex items-center gap-2 pt-1">
                    {sale && (
                        <div className="relative h-3 w-10 rounded-full bg-slate-200">
                            <span className="absolute top-1/2 -right-0.5 -left-0.5 h-px bg-slate-500" />
                        </div>
                    )}
                    <div
                        className={cn(
                            'h-5 w-16 rounded-full',
                            sale ? 'bg-red-200' : 'bg-blue-100',
                        )}
                    />
                </div>

                <span
                    className={cn(
                        'mt-1 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black opacity-60',
                        comingSoon
                            ? 'bg-amber-400 text-amber-950'
                            : 'bg-[#0D6EFD] text-white',
                    )}
                >
                    {comingSoon ? (
                        <CalendarClock size={14} />
                    ) : (
                        <ShoppingCart size={14} />
                    )}
                    {comingSoon ? 'Preorder' : 'Add to Cart'}
                </span>
            </div>
        </article>
    );
}

/**
 * The price per piece ("₱350", "From ₱350", or ~~₱350~~ ₱300 On Sale),
 * then each pack students can buy ("₱900 / Pack of 50").
 */
export function PriceLines({
    price,
    large = false,
}: {
    price: StorefrontPrice;
    large?: boolean;
}) {
    const mainSize = large ? 'text-2xl' : 'text-base';

    return (
        <div className="space-y-0.5">
            {price.piece_centavos !== null &&
                (price.sale_centavos !== null ? (
                    <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-xs text-slate-400 line-through">
                            {formatPeso(price.piece_centavos)}
                        </span>
                        <span
                            className={cn('font-black text-red-600', mainSize)}
                        >
                            {formatPeso(price.sale_centavos)}
                        </span>
                        <span className="text-xs text-slate-500">/ pc</span>
                    </p>
                ) : (
                    <p className="flex flex-wrap items-baseline gap-x-1">
                        {price.piece_from && (
                            <span className="text-xs text-slate-500">From</span>
                        )}
                        <span
                            className={cn('font-black text-blue-700', mainSize)}
                        >
                            {formatPeso(price.piece_centavos)}
                        </span>
                        <span className="text-xs text-slate-500">/ pc</span>
                    </p>
                ))}
            {price.packs.map((pack) => (
                <p
                    key={pack.name}
                    className="flex flex-wrap items-baseline gap-x-1"
                >
                    {pack.sale_price_centavos !== null && (
                        <span className="text-xs text-slate-400 line-through">
                            {formatPeso(pack.price_centavos)}
                        </span>
                    )}
                    <span
                        className={cn(
                            'font-black',
                            pack.sale_price_centavos !== null
                                ? 'text-red-600'
                                : 'text-blue-700',
                            price.piece_centavos === null
                                ? mainSize
                                : 'text-sm',
                        )}
                    >
                        {formatPeso(
                            pack.sale_price_centavos ?? pack.price_centavos,
                        )}
                    </span>
                    <span className="text-xs text-slate-500">
                        / {pack.name} of {pack.pieces}
                    </span>
                </p>
            ))}
        </div>
    );
}

/**
 * "Ends today", "Ends tomorrow" or "Ends in 3 days", by calendar day.
 */
export function saleEndsText(endsAt: string): string {
    const end = new Date(endsAt);
    const today = new Date();
    const days = Math.round(
        (new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() -
            new Date(
                today.getFullYear(),
                today.getMonth(),
                today.getDate(),
            ).getTime()) /
            86_400_000,
    );

    if (days <= 0) {
        return 'Ends today';
    }

    return days === 1 ? 'Ends tomorrow' : `Ends in ${days} days`;
}
