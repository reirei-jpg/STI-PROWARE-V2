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
 * The student's preorders: what they reserved, and a Cancel button while
 * preorders for that item are still open.
 */
export default function MyPreorders({
    preorders,
}: {
    preorders: Paginated<MyPreorder>;
}) {
    const [cancelling, setCancelling] = useState<number | null>(null);
    const [confirming, setConfirming] = useState<number | null>(null);

    const cancel = (preorder: MyPreorder) => {
        setCancelling(preorder.id);
        router.delete(StudentPreorderController.destroy(preorder.id).url, {
            preserveScroll: true,
            onFinish: () => {
                setCancelling(null);
                setConfirming(null);
            },
        });
    };

    return (
        <>
            <Head title="My Preorders" />

            <div className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">
                            My Preorders
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Items you reserved. There is nothing to pay now; the
                            PROWARE office uses preorders to know how many to
                            order.
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

                {preorders.data.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                        <CalendarClock
                            size={40}
                            className="mx-auto text-slate-300"
                        />
                        <h2 className="mt-3 text-lg font-black text-slate-800">
                            No preorders yet
                        </h2>
                        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                            Tap Preorder on an item under Coming Soon to reserve
                            it.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                        <ul className="divide-y divide-slate-100">
                            {preorders.data.map((preorder) => (
                                <li
                                    key={preorder.id}
                                    className={cn(
                                        'flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between',
                                        preorder.status === 'cancelled' &&
                                            'opacity-60',
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-300">
                                            {preorder.photo_url ? (
                                                <img
                                                    src={preorder.photo_url}
                                                    alt=""
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <ImageIcon size={22} />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-900">
                                                {preorder.product_name}
                                            </p>
                                            <p className="text-sm text-slate-600">
                                                {preorder.variant_label &&
                                                    `${preorder.variant_label} · `}
                                                {preorder.quantity}{' '}
                                                {preorder.quantity === 1
                                                    ? 'piece'
                                                    : 'pieces'}
                                            </p>
                                            {preorder.status === 'arrived' ? (
                                                <p className="mt-0.5 text-xs font-bold text-emerald-700">
                                                    Arrived{' '}
                                                    {formatDateOrdered(
                                                        preorder.arrived_at,
                                                    )}{' '}
                                                    · add it to your cart in the
                                                    store. It is not held for
                                                    you.
                                                </p>
                                            ) : (
                                                <p className="mt-0.5 text-xs text-slate-500">
                                                    {preorder.status_label}{' '}
                                                    {formatDateTime(
                                                        preorder.created_at,
                                                    )}
                                                    {preorder.status ===
                                                        'active' &&
                                                        preorder.preorders_close_on &&
                                                        ` · preorders close ${formatDateOrdered(preorder.preorders_close_on)}`}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {preorder.can_cancel &&
                                        (confirming === preorder.id ? (
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="font-bold text-slate-700">
                                                    Cancel this preorder?
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setConfirming(null)
                                                    }
                                                    className="rounded-lg border border-slate-200 px-3 py-1.5 font-black text-slate-700 hover:bg-slate-50"
                                                >
                                                    Keep it
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        cancel(preorder)
                                                    }
                                                    disabled={
                                                        cancelling ===
                                                        preorder.id
                                                    }
                                                    className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 font-black text-white hover:bg-red-700 disabled:opacity-60"
                                                >
                                                    {cancelling ===
                                                        preorder.id && (
                                                        <LoaderCircle
                                                            size={14}
                                                            className="animate-spin"
                                                        />
                                                    )}
                                                    Cancel preorder
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setConfirming(preorder.id)
                                                }
                                                className="self-start rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-red-700 hover:bg-red-50 sm:self-auto"
                                            >
                                                Cancel
                                            </button>
                                        ))}
                                </li>
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
