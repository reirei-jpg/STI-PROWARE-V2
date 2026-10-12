import { Head, Link, router } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    CalendarClock,
    CheckCircle2,
    Clock3,
    LoaderCircle,
    PackageOpen,
    ShoppingBag,
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

/** Each status's words, icon and V1 colors. */
const statusLooks: Record<
    MyPreorder['status'],
    { label: string; icon: LucideIcon; badge: string; iconBox: string }
> = {
    active: {
        label: 'Waiting to Arrive',
        icon: Clock3,
        badge: 'border-amber-200 bg-amber-50 text-amber-700',
        iconBox: 'bg-amber-100 text-amber-700',
    },
    arrived: {
        label: 'Arrived',
        icon: CheckCircle2,
        badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        iconBox: 'bg-emerald-100 text-emerald-700',
    },
    cancelled: {
        label: 'Cancelled',
        icon: XCircle,
        badge: 'border-slate-200 bg-slate-50 text-slate-600',
        iconBox: 'bg-slate-200 text-slate-600',
    },
};

/**
 * The student's preorders, laid out like V1's My Preorders: three counts
 * (Waiting to Arrive, Arrived, Cancelled), then a card per preorder with
 * the item on the left and, on the right, what its status means and what
 * to do: wait (Cancel while preorders are open) or buy it once it arrived.
 */
export default function MyPreorders({
    preorders,
}: {
    preorders: Paginated<MyPreorder>;
}) {
    const count = (status: MyPreorder['status']) =>
        preorders.data.filter((preorder) => preorder.status === status).length;

    return (
        <>
            <Head title="My Preorders" />

            <div className="space-y-7">
                <div>
                    <p className="flex items-center gap-2 text-sm font-bold tracking-wide text-[#0D6EFD] uppercase">
                        <ShoppingBag size={17} />
                        STI PROWARE
                    </p>
                    <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                        My Preorders
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                        Items you reserved before they arrive. There is nothing
                        to pay now; you are notified when your item arrives.
                    </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <SummaryCard
                        label="Waiting to Arrive"
                        value={count('active')}
                        icon={Clock3}
                        tone="amber"
                    />
                    <SummaryCard
                        label="Arrived"
                        value={count('arrived')}
                        icon={CheckCircle2}
                        tone="green"
                    />
                    <SummaryCard
                        label="Cancelled"
                        value={count('cancelled')}
                        icon={XCircle}
                        tone="slate"
                    />
                </div>

                <div>
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-black text-slate-900">
                                Your Preorders
                            </h2>
                            <p className="mt-1 text-sm text-slate-500">
                                What you reserved and where it is now.
                            </p>
                        </div>
                        <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-600">
                            {preorders.total}{' '}
                            {preorders.total === 1 ? 'Preorder' : 'Preorders'}
                        </span>
                    </div>

                    {preorders.data.length === 0 ? (
                        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                                <PackageOpen size={28} />
                            </div>
                            <h2 className="mt-5 text-lg font-black text-slate-900">
                                No preorders yet
                            </h2>
                            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                                Tap Preorder on an item under Coming Soon to
                                reserve it. It appears here so you can see when
                                it arrives.
                            </p>
                            <Link
                                href={home()}
                                className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                            >
                                See Coming Soon
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {preorders.data.map((preorder) => (
                                <PreorderCard
                                    key={preorder.id}
                                    preorder={preorder}
                                />
                            ))}
                        </div>
                    )}

                    {preorders.last_page > 1 && (
                        <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                            <Pagination
                                pagination={preorders}
                                itemName="preorders"
                            />
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

const tones = {
    amber: {
        card: 'border-amber-200 bg-amber-50/60',
        icon: 'bg-amber-100 text-amber-700',
        value: 'text-amber-700',
    },
    green: {
        card: 'border-emerald-200 bg-emerald-50/60',
        icon: 'bg-emerald-100 text-emerald-700',
        value: 'text-emerald-700',
    },
    slate: {
        card: 'border-slate-200 bg-white',
        icon: 'bg-slate-100 text-slate-600',
        value: 'text-slate-700',
    },
} as const;

function SummaryCard({
    label,
    value,
    icon: Icon,
    tone,
}: {
    label: string;
    value: number;
    icon: LucideIcon;
    tone: keyof typeof tones;
}) {
    const style = tones[tone];

    return (
        <div
            className={cn(
                'flex items-center justify-between gap-4 rounded-2xl border p-5 shadow-sm',
                style.card,
            )}
        >
            <div>
                <p className="text-sm font-bold text-slate-700">{label}</p>
                <p className={cn('mt-2 text-3xl font-black', style.value)}>
                    {value}
                </p>
            </div>
            <div
                className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                    style.icon,
                )}
            >
                <Icon size={20} />
            </div>
        </div>
    );
}

/**
 * One preorder, as on V1: photo, status badge, item, size and quantity on
 * the left; on the right, what the status means and its action.
 */
function PreorderCard({ preorder }: { preorder: MyPreorder }) {
    const [confirming, setConfirming] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const look = statusLooks[preorder.status];
    const StatusIcon = look.icon;

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
        <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
            <div className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-center">
                <div className="flex min-w-0 flex-1 gap-4">
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                        {preorder.photo_url ? (
                            <img
                                src={preorder.photo_url}
                                alt={preorder.product_name}
                                className={cn(
                                    'h-full w-full object-cover',
                                    preorder.status === 'cancelled' &&
                                        'grayscale',
                                )}
                            />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-300">
                                <PackageOpen size={30} />
                            </div>
                        )}
                    </div>

                    <div className="min-w-0">
                        <span
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black tracking-wide uppercase',
                                look.badge,
                            )}
                        >
                            <StatusIcon size={13} />
                            {look.label}
                        </span>
                        <h3 className="mt-2 truncate text-lg font-black text-slate-900">
                            {preorder.product_name}
                        </h3>
                        <p className="mt-1 text-xs font-medium text-slate-500">
                            Preordered {formatDateTime(preorder.created_at)}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-5 text-sm">
                            <div>
                                <span className="text-slate-400">Size</span>
                                <p className="font-black text-slate-800">
                                    {preorder.variant_label ?? 'Standard'}
                                </p>
                            </div>
                            <div>
                                <span className="text-slate-400">Quantity</span>
                                <p className="font-black text-slate-800">
                                    {preorder.quantity}{' '}
                                    {preorder.quantity === 1 ? 'pc' : 'pcs'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:w-90">
                    <div className={cn('rounded-2xl border p-4', look.badge)}>
                        <div className="flex gap-3">
                            <div
                                className={cn(
                                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                                    look.iconBox,
                                )}
                            >
                                <StatusIcon size={20} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-black">
                                    {look.label}
                                </p>
                                <StatusDetails preorder={preorder} />
                            </div>
                        </div>

                        {preorder.status === 'arrived' && (
                            <Link
                                href={home({
                                    query: { search: preorder.product_name },
                                })}
                                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700"
                            >
                                <Store size={16} />
                                Buy it in the store
                            </Link>
                        )}

                        {preorder.can_cancel &&
                            (confirming ? (
                                <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2">
                                    <span className="text-xs font-black text-slate-800">
                                        Cancel this preorder?
                                    </span>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setConfirming(false)}
                                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
                                        >
                                            Keep it
                                        </button>
                                        <button
                                            type="button"
                                            onClick={cancel}
                                            disabled={cancelling}
                                            className="inline-flex items-center gap-1 rounded-xl bg-red-600 px-3 py-2 text-sm font-black text-white hover:bg-red-700 disabled:opacity-60"
                                        >
                                            {cancelling && (
                                                <LoaderCircle
                                                    size={13}
                                                    className="animate-spin"
                                                />
                                            )}
                                            Cancel preorder
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setConfirming(true)}
                                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-black text-red-700 transition hover:bg-red-50"
                                >
                                    <XCircle size={16} />
                                    Cancel preorder
                                </button>
                            ))}
                    </div>
                </div>
            </div>
        </article>
    );
}

/** What the status means for the student, and the date that matters. */
function StatusDetails({ preorder }: { preorder: MyPreorder }) {
    if (preorder.status === 'arrived') {
        return (
            <p className="mt-1 text-xs leading-5 font-medium">
                It arrived on {formatDateOrdered(preorder.arrived_at)}. It is
                not held for you, so buy it in the store soon.
            </p>
        );
    }

    if (preorder.status === 'cancelled') {
        return (
            <p className="mt-1 text-xs leading-5 font-medium">
                This preorder was cancelled.
            </p>
        );
    }

    return (
        <>
            <p className="mt-1 text-xs leading-5 font-medium">
                No payment is needed yet. You are notified when it arrives.
            </p>
            {preorder.preorders_close_on && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2">
                    <CalendarClock size={15} className="shrink-0" />
                    <div>
                        <p className="text-[10px] font-black tracking-wide uppercase opacity-70">
                            Preorders close
                        </p>
                        <p className="text-xs font-black">
                            {formatDateOrdered(preorder.preorders_close_on)}
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
