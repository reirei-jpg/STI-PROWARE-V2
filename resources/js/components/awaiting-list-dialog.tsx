import { Link, useHttp } from '@inertiajs/react';
import {
    ArrowRight,
    CircleAlert,
    Clock,
    LoaderCircle,
    ReceiptText,
    RotateCw,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import CashierController from '@/actions/App/Http/Controllers/CashierController';
import CashierRecordsController from '@/actions/App/Http/Controllers/CashierRecordsController';
import StaffTag from '@/components/staff-tag';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDateTime, formatPeso } from '@/lib/format';
import type { AwaitingRow, Paginated } from '@/types';

/** How many slips the window lists; the rest are on Awaiting Payment. */
const SHOWN = 10;

type Answer = { orders: Paginated<AwaitingRow>; slips: Paginated<AwaitingRow> };

/**
 * The pop-up window of the Awaiting Payment card (like V1's "Waiting for
 * Payment"): the orders and preorder slips not paid yet, the oldest first,
 * each with Record Payment, then a button to the whole list. Loaded when
 * the window opens; a list that cannot be loaded says so, with Try again.
 */
export default function AwaitingListDialog({
    open,
    onClose,
}: {
    open: boolean;
    onClose: () => void;
}) {
    const http = useHttp<Record<string, never>, Answer>({});
    const [answer, setAnswer] = useState<Answer | null>(null);
    const [problem, setProblem] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (!open) {
            return;
        }

        setAnswer(null);
        setProblem(null);

        void http
            .get(CashierRecordsController.awaitingPreview().url, {
                onSuccess: (response) => setAnswer(response),
                onHttpException: () => {
                    setProblem(
                        'The slips awaiting payment could not be loaded. Try again.',
                    );

                    return false;
                },
                onNetworkError: () => {
                    setProblem(
                        'You are offline, so the slips awaiting payment could not be loaded. Check your internet connection and try again.',
                    );

                    return false;
                },
            })
            .catch(() =>
                setProblem(
                    (current) =>
                        current ??
                        'The slips awaiting payment could not be loaded. Try again.',
                ),
            );
        // Load each time the window opens (and on Try again); `http` changes on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, attempt]);

    const all = answer
        ? [...answer.orders.data, ...answer.slips.data].sort((a, b) =>
              (a.since ?? '').localeCompare(b.since ?? ''),
          )
        : [];
    const waiting = answer ? answer.orders.total + answer.slips.total : 0;
    const rows = all.slice(0, SHOWN);

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-xl [&>button:last-child]:hidden">
                <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                    <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                            <Clock size={21} />
                        </span>
                        <div>
                            <DialogTitle className="text-lg font-black text-slate-900">
                                Awaiting Payment
                            </DialogTitle>
                            <DialogDescription className="text-sm text-slate-500">
                                {answer
                                    ? `${answer.orders.total} ${answer.orders.total === 1 ? 'order' : 'orders'} · ${answer.slips.total} preorder ${answer.slips.total === 1 ? 'slip' : 'slips'}, the oldest first`
                                    : problem === null
                                      ? 'Loading…'
                                      : 'Could not load'}
                            </DialogDescription>
                        </div>
                    </div>
                    <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                        <X size={20} />
                        <span className="sr-only">Close</span>
                    </DialogClose>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto">
                    {problem !== null ? (
                        <div
                            role="alert"
                            className="m-6 flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm font-semibold text-red-800"
                        >
                            <CircleAlert size={22} />
                            {problem}
                            <button
                                type="button"
                                onClick={() => setAttempt((count) => count + 1)}
                                className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-black text-red-700 hover:bg-red-100"
                            >
                                <RotateCw size={15} />
                                Try again
                            </button>
                        </div>
                    ) : answer === null ? (
                        <div className="space-y-3 px-6 py-6" aria-busy>
                            {[0, 1, 2].map((key) => (
                                <div
                                    key={key}
                                    className="h-14 animate-pulse rounded-xl bg-slate-100"
                                />
                            ))}
                            <p className="flex items-center justify-center gap-2 text-sm text-slate-500">
                                <LoaderCircle
                                    size={16}
                                    className="animate-spin"
                                />
                                Loading the slips…
                            </p>
                        </div>
                    ) : rows.length === 0 ? (
                        <p className="px-6 py-10 text-center text-sm text-slate-500">
                            No orders or preorder slips are awaiting payment.
                        </p>
                    ) : (
                        <ul
                            data-test="popup-rows"
                            className="divide-y divide-slate-100"
                        >
                            {rows.map((row) => (
                                <li
                                    key={`${row.kind}-${row.id}`}
                                    className="flex items-center justify-between gap-3 px-6 py-3"
                                >
                                    <span className="min-w-0">
                                        <span className="flex flex-wrap items-center gap-1.5 font-black text-slate-900">
                                            {row.number} · {row.buyer_name}
                                            {row.is_staff && <StaffTag />}
                                        </span>
                                        <span className="block truncate text-xs text-slate-500">
                                            {row.for}
                                        </span>
                                        <span className="block text-xs text-slate-500">
                                            {row.kind === 'order'
                                                ? 'Order'
                                                : 'Preorder slip'}{' '}
                                            · since {formatDateTime(row.since)}
                                        </span>
                                    </span>
                                    <Link
                                        href={CashierController.record({
                                            query: { code: row.number ?? '' },
                                        })}
                                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0D6EFD] px-3 py-1.5 text-sm font-black whitespace-nowrap text-white hover:bg-blue-700"
                                    >
                                        <ReceiptText size={15} />
                                        {formatPeso(row.amount_centavos)}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
                    <p className="text-xs text-slate-500">
                        {waiting > rows.length
                            ? `The ${rows.length} waiting the longest are shown, and ${waiting - rows.length} more.`
                            : ''}
                    </p>
                    <Link
                        href={CashierRecordsController.awaiting()}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700"
                    >
                        View all awaiting
                        <ArrowRight size={16} />
                    </Link>
                </footer>
            </DialogContent>
        </Dialog>
    );
}
