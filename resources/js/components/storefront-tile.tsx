import { CalendarClock, ImageIcon, ShoppingCart } from 'lucide-react';
import { useSignInPrompt } from '@/components/sign-in-prompt';
import { formatPeso } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { StorefrontPrice, StorefrontTileProduct } from '@/types';

/**
 * A merchandise tile (TikTok Shop style): square photo, name, price and
 * Add to Cart. Tapping the photo or name opens the product's view.
 *
 * Badges: SALE (original price crossed out before the sale price), COMING
 * SOON with a Preorder button, "Only 3 left" when almost sold out, and
 * SOLD OUT (greyed, no button). Add to Cart and Preorder ask a signed-out
 * visitor to sign in first.
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
    const comingSoon = product.status === 'preorder';
    const onSale = product.price.sale_centavos !== null;

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
                                SOLD OUT
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

                {product.sold_out ? (
                    <span className="mt-auto inline-flex items-center justify-center rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-500">
                        Sold out
                    </span>
                ) : (
                    <button
                        type="button"
                        onClick={openSignIn}
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
                    <span
                        className={cn(
                            'font-black text-blue-700',
                            price.piece_centavos === null
                                ? mainSize
                                : 'text-sm',
                        )}
                    >
                        {formatPeso(pack.price_centavos)}
                    </span>
                    <span className="text-xs text-slate-500">
                        / {pack.name} of {pack.pieces}
                    </span>
                </p>
            ))}
        </div>
    );
}
