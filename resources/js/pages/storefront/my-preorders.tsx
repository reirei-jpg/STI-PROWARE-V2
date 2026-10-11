import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarClock,
    CheckCircle2,
    Clock,
    ImageIcon,
    LoaderCircle,
    Store,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
import StudentPreorderController from '@/actions/App/Http/Controllers/StudentPreorderController';
import Pagination from '@/components/pagination';
import { formatDateOrdered, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { home } from '@/routes';
import type { Paginated } from '@/types';

type MyPreorder = {
    id: number;
    product_name: string;
    photo_url: string | null;
    variant_label: string | null;
    quantity: number;
    status: 'active' | 'arrived' | 'cancelled';
    status_label: string;
    preorders_close_on: string | null;
    can_cancel: boolean;
    created_at: string | null;
    /** When the student was told it arrived. */
    arrived_at: string | null;
};

/**
 * The student's preorders as cards: what they reserved, whether it is still
 * on its way, arrived (go to the store to buy it; it is not held) or was
 * cancelled, and Cancel while preorders for that item are still open.
 */
export default function MyPreorders({
    preorders,
}: {
    preorders: Paginated<MyPreorder>;
}) {
    return (
        <>
            <Head title="My Preorders" />

            <div className="space-y-6">
                <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-amber-400 via-amber-300 to-yellow-200 px-6 py-7 text-amber-950 shadow-xl shadow-amber-500/20 md:px-8">
                    <span
                        aria-hidden="true"
                        className="absolute -top-16 -right-10 h-48 w-48 rounded-full bg-white/40 blur-2xl"
                    />
                    <div className="relative flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h1 className="flex items-center gap-2 text-2xl font-black md:text-3xl">
                                <CalendarClock size={28} />
                                My Preorders
                            </h1>
                            <p className="mt-1 max-w-xl text-sm font-semibold text-amber-900">
                                Items you reserved. Nothing to pay now: the
                                PROWARE office uses preorders to know how many
                                to order. You are told when they arrive.
                            </p>
                        </div>
                        <Link
                            href={home()}
                            className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/60 px-4 text-sm font-black text-amber-950 transition hover:bg-white/80"
                        >
                            <ArrowLeft size={17} />
                            Back to the store
                        </Link>
                    </div>
                </section>

                {preorders.data.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                        <CalendarClock
                            size={44}
                            className="mx-auto text-slate-300"
                        />
                        <h2 className="mt-3 text-lg font-black text-slate-800">
                            No preorders yet
                        </h2>
                        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                            Tap Preorder on an item under Coming Soon to reserve
                            it.
                        </p>
                        <Link
                            href={home()}
                            className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-black text-amber-950 shadow-sm transition hover:bg-amber-300"
                        >
                            <Store size={17} />
                            See Coming Soon
                        </Link>
                    </div>
                ) : (
                    <>
                        <div className="grid gap-4 md:grid-cols-2">
                            {preorders.data.map((preorder) => (
                                <PreorderCard
                                    key={preorder.id}
                                    preorder={preorder}
                                />
                            ))}
                        </div>
                        <div className="overflow-hidden rounded-2xl">
                            <Pagination
                                pagination={preorders}
                                itemName="preorders"
                            />
                        </div>
                    </>
                )}
            </div>
        </>
    );
}

/** Whole days from today to the date: 0 today, negative when it passed. */
function daysUntil(date: string): number {
    const end = new Date(`${date}T00:00:00`).getTime();
    const now = new Date();
    const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
    ).getTime();

    return Math.round((end - today) / 86_400_000);
}

const statusLooks = {
    active: {
        label: 'Waiting to arrive',
        badge: 'bg-amber-100 text-amber-800',
        icon: Clock,
    },
    arrived: {
        label: 'Arrived!',
        badge: 'bg-emerald-100 text-emerald-800',
        icon: CheckCircle2,
    },
    cancelled: {
        label: 'Cancelled',
        badge: 'bg-slate-100 text-slate-600',
        icon: XCircle,
    },
} as const;

/**
 * One preorder: photo, item, size and quantity, its status, and what to do
 * next: wait (with when preorders close), go buy it (arrived), or Cancel.
 */
function PreorderCard({ preorder }: { preorder: MyPreorder }) {
    const [confirming, setConfirming] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const look = statusLooks[preorder.status];
    const StatusIcon = look.icon;
    const closesIn =
        preorder.status === 'active' && preorder.preorders_close_on
            ? daysUntil(preorder.preorders_close_on)
            : null;

    const cancel = () => {
        setCancelling(true);
        router.delete(StudentPreorderController.destroy(preorder.id).url, {
            preserveScroll: true,
            onFinish: () => {
                setCancelling(false);
                setConfirming(false);
            },
        });
    };

    return (
        <article
            className={cn(
                'flex flex-col overflow-hidden rounded-3xl border bg-white shadow-sm transition hover:shadow-md',
                preorder.status === 'arrived'
                    ? 'border-emerald-300 ring-2 ring-emerald-100'
                    : 'border-slate-200',
                preorder.status === 'cancelled' && 'opacity-70',
            )}
        >
            <div className="flex gap-4 p-4">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-slate-300">
                    {preorder.photo_url ? (
                        <img
                            src={preorder.photo_url}
                            alt=""
                            className={cn(
                                'h-full w-full object-cover',
                                preorder.status === 'cancelled' && 'grayscale',
                            )}
                        />
                    ) : (
                        <ImageIcon size={28} />
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <span
                        className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black',
                            look.badge,
                        )}
                    >
                        <StatusIcon size={13} />
                        {look.label}
                    </span>
                    <h2 className="mt-1.5 line-clamp-2 text-base font-black text-slate-900">
                        {preorder.product_name}
                    </h2>
                    <p className="text-sm text-slate-600">
                        {preorder.variant_label && (
                            <span className="font-bold text-slate-800">
                                {preorder.variant_label} ·{' '}
                            </span>
                        )}
                        {preorder.quantity}{' '}
                        {preorder.quantity === 1 ? 'piece' : 'pieces'}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                        Preordered {formatDateTime(preorder.created_at)}
                    </p>
                </div>
            </div>

            <div className="mt-auto border-t border-slate-100 px-4 py-3">
                {preorder.status === 'arrived' ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-bold text-emerald-800">
                            Arrived {formatDateOrdered(preorder.arrived_at)}.
                            <span className="block text-xs font-semibold text-emerald-700">
                                It is not held for you. Buy it soon.
                            </span>
                        </p>
                        <Link
                            href={home({
                                query: { search: preorder.product_name },
                            })}
                            className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700"
                        >
                            <Store size={17} />
                            Go to the store
                        </Link>
                    </div>
                ) : preorder.status === 'cancelled' ? (
                    <p className="text-sm font-semibold text-slate-500">
                        This preorder was cancelled.
                    </p>
                ) : confirming ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-black text-slate-800">
                            Cancel this preorder?
                        </span>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setConfirming(false)}
                                className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
                            >
                                Keep it
                            </button>
                            <button
                                type="button"
                                onClick={cancel}
                                disabled={cancelling}
                                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-red-600 px-4 text-sm font-black text-white hover:bg-red-700 disabled:opacity-60"
                            >
                                {cancelling && (
                                    <LoaderCircle
                                        size={15}
                                        className="animate-spin"
                                    />
                                )}
                                Cancel preorder
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        {closesIn !== null ? (
                            <p
                                className={cn(
                                    'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black',
                                    closesIn <= 0
                                        ? 'bg-amber-50 text-amber-800'
                                        : 'bg-blue-50 text-blue-700',
                                )}
                            >
                                <Clock size={15} />
                                {closesIn < 0
                                    ? 'Preorders closed'
                                    : closesIn === 0
                                      ? 'Preorders close today'
                                      : `Preorders close in ${closesIn} ${closesIn === 1 ? 'day' : 'days'}`}
                            </p>
                        ) : (
                            <p className="text-sm font-semibold text-slate-500">
                                Waiting for it to arrive.
                            </p>
                        )}
                        {preorder.can_cancel && (
                            <button
                                type="button"
                                onClick={() => setConfirming(true)}
                                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 text-sm font-black text-red-700 transition hover:bg-red-50"
                            >
                                <XCircle size={15} />
                                Cancel
                            </button>
                        )}
                    </div>
                )}
            </div>
        </article>
    );
}
