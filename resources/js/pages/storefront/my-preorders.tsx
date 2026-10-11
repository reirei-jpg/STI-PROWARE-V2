import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarClock,
    ImageIcon,
    LoaderCircle,
} from 'lucide-react';
import { useState } from 'react';
import StudentPreorderController from '@/actions/App/Http/Controllers/StudentPreorderController';
import Pagination from '@/components/pagination';
import { formatDateOrdered } from '@/lib/format';
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

const statusText: Record<
    MyPreorder['status'],
    { label: string; tone: string }
> = {
    active: { label: 'Waiting', tone: 'bg-amber-50 text-amber-700' },
    arrived: { label: 'Arrived', tone: 'bg-emerald-50 text-emerald-700' },
    cancelled: { label: 'Cancelled', tone: 'bg-slate-100 text-slate-500' },
};

/**
 * The student's preorders, one clean row each: the item, its status, and
 * Cancel while preorders for it are still open, or Buy once it arrived.
 */
export default function MyPreorders({
    preorders,
}: {
    preorders: Paginated<MyPreorder>;
}) {
    return (
        <>
            <Head title="My Preorders" />

            <div className="mx-auto max-w-3xl space-y-5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">
                            My Preorders
                        </h1>
                        <p className="mt-0.5 text-sm text-slate-500">
                            Nothing to pay now. You are told when they arrive.
                        </p>
                    </div>
                    <Link
                        href={home()}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                        <ArrowLeft size={16} />
                        Store
                    </Link>
                </div>

                {preorders.data.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
                        <CalendarClock
                            size={36}
                            className="mx-auto text-slate-300"
                        />
                        <p className="mt-3 font-bold text-slate-700">
                            No preorders yet
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                            Tap Preorder on an item under Coming Soon to reserve
                            it.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        <ul className="divide-y divide-slate-100">
                            {preorders.data.map((preorder) => (
                                <PreorderLine
                                    key={preorder.id}
                                    preorder={preorder}
                                />
                            ))}
                        </ul>
                        <Pagination
                            pagination={preorders}
                            itemName="preorders"
                        />
                    </div>
                )}
            </div>
        </>
    );
}

/** One preorder: photo, item, size and quantity, status, and its action. */
function PreorderLine({ preorder }: { preorder: MyPreorder }) {
    const [confirming, setConfirming] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const status = statusText[preorder.status];

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
        <li
            className={cn(
                'flex items-center gap-4 px-5 py-4',
                preorder.status === 'cancelled' && 'opacity-60',
            )}
        >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-300">
                {preorder.photo_url ? (
                    <img
                        src={preorder.photo_url}
                        alt=""
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <ImageIcon size={20} />
                )}
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className="truncate font-bold text-slate-900">
                        {preorder.product_name}
                    </p>
                    <span
                        className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-xs font-bold',
                            status.tone,
                        )}
                    >
                        {status.label}
                    </span>
                </div>
                <p className="mt-0.5 text-sm text-slate-500">
                    {preorder.variant_label && `${preorder.variant_label} · `}
                    {preorder.quantity} {preorder.quantity === 1 ? 'pc' : 'pcs'}
                    {preorder.status === 'active' &&
                        preorder.preorders_close_on &&
                        ` · closes ${formatDateOrdered(preorder.preorders_close_on)}`}
                    {preorder.status === 'arrived' &&
                        ' · not held for you, buy it soon'}
                </p>
            </div>

            {preorder.status === 'arrived' ? (
                <Link
                    href={home({ query: { search: preorder.product_name } })}
                    className="inline-flex h-9 shrink-0 items-center rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700"
                >
                    Buy
                </Link>
            ) : (
                preorder.can_cancel &&
                (confirming ? (
                    <div className="flex shrink-0 gap-2">
                        <button
                            type="button"
                            onClick={() => setConfirming(false)}
                            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                        >
                            Keep
                        </button>
                        <button
                            type="button"
                            onClick={cancel}
                            disabled={cancelling}
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-red-600 px-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
                        >
                            {cancelling && (
                                <LoaderCircle
                                    size={14}
                                    className="animate-spin"
                                />
                            )}
                            Cancel it
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setConfirming(true)}
                        className="h-9 shrink-0 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-red-600 hover:bg-red-50"
                    >
                        Cancel
                    </button>
                ))
            )}
        </li>
    );
}
