import { CalendarClock, ImageIcon, ShoppingCart } from 'lucide-react';
import { useSignInPrompt } from '@/components/sign-in-prompt';
import { cn } from '@/lib/utils';

/**
 * An empty merchandise tile (TikTok Shop style): square picture, name,
 * price and Add to Cart. It only shows the tile's shape for now; real
 * products will fill it once they exist.
 *
 * `sale` adds the SALE badge and shows the original price crossed out
 * before the sale price (e.g. ~~₱350~~ ₱300). `comingSoon` adds the
 * COMING SOON badge and a Preorder button instead of Add to Cart. Both
 * buttons ask a signed-out visitor to sign in first.
 */
export default function StorefrontTile({
    sale = false,
    comingSoon = false,
    className,
}: {
    sale?: boolean;
    comingSoon?: boolean;
    className?: string;
}) {
    const openSignIn = useSignInPrompt();

    return (
        <article
            className={cn(
                'flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
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
                <div className="space-y-1.5" aria-hidden="true">
                    <div className="h-3 w-11/12 rounded-full bg-slate-100" />
                    <div className="h-3 w-2/3 rounded-full bg-slate-100" />
                </div>

                <div
                    className="mt-auto flex items-center gap-2 pt-1"
                    aria-hidden="true"
                >
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

                <button
                    type="button"
                    onClick={openSignIn}
                    className={cn(
                        'mt-1 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition',
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
            </div>
        </article>
    );
}
