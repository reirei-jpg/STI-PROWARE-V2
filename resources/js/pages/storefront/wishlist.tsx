import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarClock,
    Heart,
    ImageIcon,
    ShoppingCart,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import WishlistController from '@/actions/App/Http/Controllers/WishlistController';
import { useAddToCart } from '@/components/add-to-cart-dialog';
import ConfirmDialog from '@/components/confirm-dialog';
import { usePreorder } from '@/components/preorder-dialog';
import { PriceLines } from '@/components/storefront-tile';
import { formatDateOrdered } from '@/lib/format';
import { cn } from '@/lib/utils';
import { home } from '@/routes';
import type { WishlistRow } from '@/types';

const TONES: Record<WishlistRow['status_tone'], string> = {
    green: 'text-emerald-700',
    amber: 'text-amber-700',
    red: 'text-red-600',
    blue: 'text-blue-700',
    slate: 'text-slate-500',
};

/**
 * My Wishlist (panel revision, 20 Nov 2026): items the buyer saved to buy
 * later, newest first, each with today's price and how many are left. Add
 * to Cart opens the item's picker with the saved size chosen; a sold-out or
 * Coming Soon item can be preordered. Nothing is held: anyone can buy them.
 */
export default function Wishlist({ items }: { items: WishlistRow[] }) {
    return (
        <>
            <Head title="My Wishlist" />

            <div className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">
                            My Wishlist
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Items you saved to buy later. They are not held for
                            you, so check how many are left.
                        </p>
                    </div>
                    <Link
                        href={home()}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                        <ArrowLeft size={17} />
                        Back to the store
                    </Link>
                </div>

                {items.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                        <Heart size={40} className="mx-auto text-slate-300" />
                        <h2 className="mt-3 text-lg font-black text-slate-800">
                            Your wishlist is empty
                        </h2>
                        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                            In an item's Add to Cart window, press Add to
                            Wishlist to save it for later.
                        </p>
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                        {items.map((item) => (
                            <WishlistItemRow key={item.id} item={item} />
                        ))}
                    </ul>
                )}
            </div>
        </>
    );
}

function WishlistItemRow({ item }: { item: WishlistRow }) {
    const addToCart = useAddToCart();
    const preorder = usePreorder();
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const name = item.variant_label
        ? `${item.product_name} (${item.variant_label})`
        : item.product_name;

    const remove = () => {
        setBusy(true);
        router.delete(WishlistController.destroy(item.id).url, {
            preserveScroll: true,
            onFinish: () => {
                setBusy(false);
                setConfirming(false);
            },
        });
    };

    return (
        <li
            data-test="wishlist-item"
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
        >
            <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-300">
                    {item.photo_url ? (
                        <img
                            src={item.photo_url}
                            alt=""
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <ImageIcon size={22} />
                    )}
                </div>
                <div className="min-w-0 space-y-0.5">
                    <p className="font-black text-slate-900">
                        {item.product_name}
                    </p>
                    <p className="text-sm text-slate-600">
                        {item.variant_label ?? 'No size or color chosen yet'}
                    </p>
                    <PriceLines price={item.price} />
                    <p
                        className={cn(
                            'text-sm font-bold',
                            TONES[item.status_tone],
                        )}
                    >
                        {item.status_text}
                    </p>
                    {item.added_on && (
                        <p className="text-xs text-slate-400">
                            Saved {formatDateOrdered(item.added_on)}
                        </p>
                    )}
                </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
                {item.can_buy ? (
                    <button
                        type="button"
                        onClick={() =>
                            addToCart(item.product, item.product_variant_id)
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-700"
                    >
                        <ShoppingCart size={16} />
                        Add to Cart
                    </button>
                ) : (
                    item.can_preorder && (
                        <button
                            type="button"
                            onClick={() => preorder(item.product)}
                            className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black text-amber-950 transition hover:bg-amber-300"
                        >
                            <CalendarClock size={16} />
                            Preorder
                        </button>
                    )
                )}
                <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:opacity-40"
                >
                    <Trash2 size={16} />
                    Remove
                </button>
            </div>

            <ConfirmDialog
                open={confirming}
                title={`Remove ${name} from your wishlist?`}
                description="You can add it again from the store."
                cancelLabel="Keep it"
                confirmLabel="Remove"
                tone="red"
                busy={busy}
                onConfirm={remove}
                onClose={() => setConfirming(false)}
            />
        </li>
    );
}
