import { Link, useHttp } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    ArrowRight,
    CircleAlert,
    LoaderCircle,
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
import { formatDateTime, formatPeso, receiptCount } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    Paginated,
    PaymentFilters,
    PaymentRow,
    PaymentTotals,
} from '@/types';

/** How many receipts the window lists; the rest are in Payment History. */
const SHOWN = 10;

/** What a summary card opens: its receipts for a period. */
export type PaymentListRequest = {
    title: string;
    icon: LucideIcon;
    /** The Payment History filters, as in the page address. */
    query: Record<string, string>;
    /** Voided receipts show the voided amount; the others the amount collected. */
    voided?: boolean;
    /** Show the Cash / GCash split under the total. */
    split?: boolean;
    /** Shown when there is no receipt, e.g. "No cash payments were recorded today." */
    empty: string;
    /** The button at the bottom: open Payment History (a link) or filter the list on this page. */
    action:
        | { label: string; href: string }
        | { label: string; onClick: () => void };
};

type Answer = {
    payments: Paginated<PaymentRow>;
    totals: PaymentTotals;
    filters: PaymentFilters;
};

/**
 * The pop-up window a cashier summary card opens (like V1's): the total and
 * the latest receipts behind the card, each one opening its Payment
 * Receipt, then a button to see them all. Loaded when the window opens;
 * a list that cannot be loaded says so, with Try again.
 */
export default function PaymentListDialog({
    request,
    onClose,
}: {
    request: PaymentListRequest | null;
    onClose: () => void;
}) {
    const http = useHttp<Record<string, never>, Answer>({});
    const [answer, setAnswer] = useState<Answer | null>(null);
    const [problem, setProblem] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (request === null) {
            return;
        }

        setAnswer(null);
        setProblem(null);

        const fail = (message: string) => {
            setProblem(message);

            return false;
        };

        void http
            .get(
                CashierRecordsController.historyPreview({
                    query: request.query,
                }).url,
                {
                    onSuccess: (response) => setAnswer(response),
                    // A wrong period or filter: the server's reason.
                    onError: (errors) => {
                        fail(
                            Object.values(errors)[0] ??
                                'The receipts could not be loaded. Try again.',
                        );
                    },
                    onHttpException: (response) =>
                        fail(
                            response.status === 403
                                ? 'This account cannot open these receipts.'
                                : 'The receipts could not be loaded. Try again.',
                        ),
                    onNetworkError: () =>
                        fail(
                            'You are offline, so the receipts could not be loaded. Check your internet connection and try again.',
                        ),
                },
            )
            // Keeps the reason a callback above already gave.
            .catch(() =>
                setProblem(
                    (current) =>
                        current ??
                        'The receipts could not be loaded. Try again.',
                ),
            );
        // Load once per opened card (and on Try again); `http` changes on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [request, attempt]);

    const Icon = request?.icon;
    const totals = answer?.totals;
    const rows = answer?.payments.data.slice(0, SHOWN) ?? [];
    const more = answer ? answer.payments.total - rows.length : 0;

    return (
        <Dialog
            open={request !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-xl [&>button:last-child]:hidden">
                <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                    <div className="flex items-start gap-3">
                        {Icon && (
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                <Icon size={21} />
                            </span>
                        )}
                        <div>
                            <DialogTitle className="text-lg font-black text-slate-900">
                                {request?.title}
                            </DialogTitle>
                            <DialogDescription className="text-sm text-slate-500">
                                {answer
                                    ? periodText(answer.filters)
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
                    ) : answer === null || totals === undefined ? (
                        <div className="space-y-3 px-6 py-6" aria-busy>
                            <div className="h-9 w-40 animate-pulse rounded-lg bg-slate-100" />
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
                                Loading the receipts…
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="border-b border-slate-100 px-6 py-4">
                                <p
                                    data-test="popup-figure"
                                    className={cn(
                                        'text-3xl font-black',
                                        request?.voided
                                            ? 'text-red-700'
                                            : 'text-slate-950',
                                    )}
                                >
                                    {formatPeso(
                                        request?.voided
                                            ? totals.void_centavos
                                            : totals.total_centavos,
                                    )}
                                </p>
                                <p className="mt-1 text-sm text-slate-500">
                                    {request?.voided
                                        ? `${receiptCount(totals.void_count)} voided, not counted in the total`
                                        : `${receiptCount(totals.count)} collected`}
                                </p>
                                {request?.split && (
                                    <p className="mt-2 flex flex-wrap gap-2 text-sm">
                                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-bold text-slate-700">
                                            Cash{' '}
                                            {formatPeso(totals.cash_centavos)}
                                        </span>
                                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-bold text-slate-700">
                                            GCash{' '}
                                            {formatPeso(totals.gcash_centavos)}
                                        </span>
                                    </p>
                                )}
                            </div>

                            {rows.length === 0 ? (
                                <p className="px-6 py-10 text-center text-sm text-slate-500">
                                    {request?.empty}
                                </p>
                            ) : (
                                <ul
                                    data-test="popup-rows"
                                    className="divide-y divide-slate-100"
                                >
                                    {rows.map((row) => (
                                        <li key={row.id}>
                                            <Link
                                                href={CashierController.receipt(
                                                    row.id,
                                                )}
                                                className="flex items-start justify-between gap-3 px-6 py-3 hover:bg-slate-50"
                                            >
                                                <span className="min-w-0">
                                                    <span className="flex flex-wrap items-center gap-1.5 font-black text-slate-900">
                                                        {row.receipt_number}
                                                        {row.void && (
                                                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                                                                Voided
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                                                        {row.number} ·{' '}
                                                        {row.buyer_name}
                                                        {row.is_staff && (
                                                            <StaffTag />
                                                        )}{' '}
                                                        · {row.method_label} ·{' '}
                                                        {formatDateTime(
                                                            row.paid_at,
                                                        )}
                                                    </span>
                                                    <span
                                                        className={cn(
                                                            'block text-xs',
                                                            row.void
                                                                ? 'text-red-700'
                                                                : 'text-slate-500',
                                                        )}
                                                    >
                                                        {detailOf(row)}
                                                    </span>
                                                </span>
                                                <span
                                                    className={cn(
                                                        'font-black whitespace-nowrap',
                                                        row.void
                                                            ? 'text-slate-400 line-through'
                                                            : 'text-slate-900',
                                                    )}
                                                >
                                                    {formatPeso(
                                                        row.amount_centavos,
                                                    )}
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </>
                    )}
                </div>

                {request && (
                    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
                        <p className="text-xs text-slate-500">
                            {more > 0
                                ? `The latest ${rows.length} are shown, and ${more} more.`
                                : ''}
                        </p>
                        {'href' in request.action ? (
                            <Link
                                href={request.action.href}
                                className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700"
                            >
                                {request.action.label}
                                <ArrowRight size={16} />
                            </Link>
                        ) : (
                            <button
                                type="button"
                                onClick={request.action.onClick}
                                className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700"
                            >
                                {request.action.label}
                                <ArrowRight size={16} />
                            </button>
                        )}
                    </footer>
                )}
            </DialogContent>
        </Dialog>
    );
}

/** The line under a receipt: the change given, the GCash reference, or why it was voided. */
function detailOf(row: PaymentRow): string {
    if (row.void) {
        return `Voided${row.voided_by ? ` by ${row.voided_by}` : ''}: ${row.void_reason ?? ''}`;
    }

    return row.method === 'cash'
        ? `Received ${formatPeso(row.amount_received_centavos)} · Change ${formatPeso(row.change_centavos)}`
        : `GCash reference ${row.gcash_reference ?? '—'}`;
}

/** "Today", "This week", "This month" or "Nov 1, 2026 to Nov 20, 2026". */
export function periodText(
    filters: Pick<PaymentFilters, 'period' | 'date_from' | 'date_to'>,
): string {
    if (filters.period === 'today') {
        return 'Today';
    }

    if (filters.period === 'week') {
        return 'This week';
    }

    if (filters.period === 'month') {
        return 'This month';
    }

    const day = (value: string) =>
        new Intl.DateTimeFormat('en-PH', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        }).format(new Date(`${value}T00:00:00`));

    return filters.date_from === filters.date_to
        ? day(filters.date_from)
        : `${day(filters.date_from)} to ${day(filters.date_to)}`;
}
