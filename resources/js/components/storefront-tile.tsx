import { ImageIcon, ShoppingCart } from 'lucide-react';
import { useSignInPrompt } from '@/components/sign-in-prompt';
import { cn } from '@/lib/utils';

/**
 * An empty merchandise tile (TikTok Shop style): square picture, name,
 * price and Add to Cart. It only shows the tile's shape for now; real
 * products will fill it once they exist.
 *
 * `sale` adds the SALE badge and a second (original) price, `comingSoon`
 * the COMING SOON badge and no Add to Cart button.
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
                    className="mt-auto flex items-end gap-2 pt-1"
                    aria-hidden="true"
                >
                    <div
                        className={cn(
                            'h-5 w-16 rounded-full',
                            sale ? 'bg-red-100' : 'bg-blue-100',
                        )}
                    />
                    {sale && (
                        <div className="h-3 w-10 rounded-full bg-slate-100" />
                    )}
                </div>

                {!comingSoon && (
                    <button
                        type="button"
                        onClick={openSignIn}
                        className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D6EFD] px-3 py-2 text-xs font-black text-white transition hover:bg-blue-700"
                    >
                        <ShoppingCart size={14} />
                        Add to Cart
                    </button>
                )}
            </div>
        </article>
    );
}
