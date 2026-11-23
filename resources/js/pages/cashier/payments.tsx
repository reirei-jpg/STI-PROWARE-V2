import { Head, Link, router, usePage } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    Banknote,
    Download,
    Eye,
    Printer,
    ReceiptText,
    Search,
    Smartphone,
    X,
    XCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import CashierController from '@/actions/App/Http/Controllers/CashierController';
import CashierRecordsController from '@/actions/App/Http/Controllers/CashierRecordsController';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import Panel from '@/components/panel';
import PaymentListDialog from '@/components/payment-list-dialog';
import type { PaymentListRequest } from '@/components/payment-list-dialog';
import PaymentPeriodFilter, {
    paymentQuery,
} from '@/components/payment-period-filter';
import StaffTag from '@/components/staff-tag';
import SummaryCard from '@/components/summary-card';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDateTime, formatPeso, receiptCount } from '@/lib/format';
import { cn, isSameSearch } from '@/lib/utils';
import type {
    Paginated,
    PaymentFilters,
    PaymentRow,
    PaymentTotals,
} from '@/types';

const selectClasses =
    'h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

/**
 * Payment History: every Payment Receipt, today first by default. Filter by
 * period, payment method, Order or Preorder, Paid or Void, and search by
 * receipt, slip number, buyer name or ID, or GCash reference. The totals
 * are of everything that matches (void payments apart). View opens the
 * details; the cashier reprints receipts and downloads the list for Excel.
 * The School Admin views it read-only.
 */
export default function PaymentHistory({
    payments,
    totals,
    filters,
    readOnly,
}: {
    payments: Paginated<PaymentRow>;
    totals: PaymentTotals;
    filters: PaymentFilters;
    readOnly: boolean;
}) {
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const [search, setSearch] = useState(filters.search);
    const [viewing, setViewing] = useState<PaymentRow | null>(null);
    const firstRender = useRef(true);

    const show = (next: Partial<PaymentFilters>) => {
        router.get(
            CashierRecordsController.history().url,
            paymentQuery({ ...filters, ...next }, 'today'),
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const [popup, setPopup] = useState<PaymentListRequest | null>(null);

    /**
     * A summary card opens its receipts in a pop-up window: those of this
     * list (same period, type and search) that the card counts. Its button
     * shows only them in the list below, or all again when the card is the
     * chosen one. A card the list's own filter rules out (e.g. GCash while
     * the list shows Cash only) counts nothing, so it does not open.
     */
    const cardPopup = (
        method: PaymentFilters['method'],
        status: PaymentFilters['status'],
        title: string,
        icon: LucideIcon,
        empty: string,
        extra: Partial<PaymentListRequest> = {},
    ) => {
        const ruledOut =
            (method !== '' &&
                filters.method !== '' &&
                filters.method !== method) ||
            (filters.status !== '' && filters.status !== status);

        if (ruledOut) {
            return {};
        }

        const card = { method: method || filters.method, status };
        const active = filters.method === method && filters.status === status;

        return {
            active,
            actionLabel: 'View receipts',
            onClick: () =>
                setPopup({
                    title,
                    icon,
                    query: paymentQuery({ ...filters, ...card }, 'today'),
                    empty,
                    action: {
                        label: active
                            ? 'Show all receipts in the list'
                            : 'Show only these in the list',
                        onClick: () => {
                            setPopup(null);
                            show(active ? { method: '', status: '' } : card);
                        },
                    },
                    ...extra,
                }),
        };
    };

    // Search as the cashier types, after a short pause.
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;

            return;
        }

        if (isSameSearch(search, filters.search)) {
            return;
        }

        const timer = window.setTimeout(
            () => show({ search: search.trim() }),
            400,
        );

        return () => window.clearTimeout(timer);
        // Only the typed search starts a new search.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const exportUrl = CashierRecordsController.historyCsv({
        query: paymentQuery(filters, 'today'),
    }).url;

    return (
        <>
            <Head title="Payment History" />

            <div className="space-y-6">
                <PageHeader
                    title="Payment History"
                    description={
                        readOnly
                            ? 'Every Payment Receipt the cashier issued, with its method and amount. View only.'
                            : 'Every Payment Receipt issued, with its method and amount. Filter by period, method, type or status, and search by receipt, slip, buyer or GCash reference.'
                    }
                    actions={
                        !readOnly && (
                            <a
                                href={exportUrl}
                                data-test="download-csv"
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
                            >
                                <Download size={17} />
                                Download CSV (Excel)
                            </a>
                        )
                    }
                />

                <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                    <SummaryCard
                        label="Total Collected"
                        value={formatPeso(totals.total_centavos)}
                        description={`${receiptCount(totals.count)} in this list`}
                        icon={ReceiptText}
                        {...cardPopup(
                            '',
                            'paid',
                            'Total Collected',
                            ReceiptText,
                            'No payments match this list.',
                            { split: true },
                        )}
                        testId="card-total"
                    />
                    <SummaryCard
                        label="Cash Payments"
                        value={formatPeso(totals.cash_centavos)}
                        description={receiptCount(totals.cash_count)}
                        icon={Banknote}
                        {...cardPopup(
                            'cash',
                            'paid',
                            'Cash Payments',
                            Banknote,
                            'No cash payments match this list.',
                        )}
                        testId="card-cash"
                    />
                    <SummaryCard
                        label="GCash Payments"
                        value={formatPeso(totals.gcash_centavos)}
                        description={receiptCount(totals.gcash_count)}
                        icon={Smartphone}
                        {...cardPopup(
                            'gcash',
                            'paid',
                            'GCash Payments',
                            Smartphone,
                            'No GCash payments match this list.',
                        )}
                        testId="card-gcash"
                    />
                    <SummaryCard
                        label="Voided Payments"
                        value={formatPeso(totals.void_centavos)}
                        description={`${receiptCount(totals.void_count)}, not counted in the total`}
                        icon={XCircle}
                        {...cardPopup(
                            '',
                            'void',
                            'Voided Payments',
                            XCircle,
                            'No voided payments match this list.',
                            { voided: true },
                        )}
                        testId="card-void"
                    />
                </section>

                <PaymentListDialog
                    request={popup}
                    onClose={() => setPopup(null)}
                />

                <Panel>
                    <div className="space-y-4 border-b border-slate-100 px-6 py-4">
                        <PaymentPeriodFilter
                            filters={filters}
                            clearTo="today"
                            error={errors.date_from ?? errors.date_to}
                            onChange={show}
                        />
                        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
                            <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                                <Search size={18} className="shrink-0" />
                                <input
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    maxLength={100}
                                    placeholder="Search receipt, slip number, buyer name or ID, GCash reference"
                                    className="w-full min-w-0 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                                    aria-label="Search payments"
                                />
                            </label>
                            <select
                                value={filters.method}
                                onChange={(event) =>
                                    show({
                                        method: event.target
                                            .value as PaymentFilters['method'],
                                    })
                                }
                                className={selectClasses}
                                aria-label="Payment method"
                            >
                                <option value="">All methods</option>
                                <option value="cash">Cash</option>
                                <option value="gcash">GCash</option>
                            </select>
                            <select
                                value={filters.type}
                                onChange={(event) =>
                                    show({
                                        type: event.target
                                            .value as PaymentFilters['type'],
                                    })
                                }
                                className={selectClasses}
                                aria-label="Orders or preorders"
                            >
                                <option value="">Orders and preorders</option>
                                <option value="order">Orders</option>
                                <option value="preorder">Preorders</option>
                            </select>
                            <select
                                value={filters.status}
                                onChange={(event) =>
                                    show({
                                        status: event.target
                                            .value as PaymentFilters['status'],
                                    })
                                }
                                className={selectClasses}
                                aria-label="Status"
                            >
                                <option value="">Paid and voided</option>
                                <option value="paid">Paid</option>
                                <option value="void">Voided</option>
                            </select>
                        </div>
                    </div>

                    {payments.data.length === 0 ? (
                        <p className="px-6 py-12 text-center text-sm text-slate-500">
                            {filters.search !== ''
                                ? `No payment in this period matches "${filters.search}".`
                                : filters.method !== '' ||
                                    filters.type !== '' ||
                                    filters.status !== ''
                                  ? 'No payments in this period match the chosen filters.'
                                  : 'No payments were recorded in this period.'}
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-left text-xs font-black tracking-wide text-slate-500 uppercase">
                                    <tr>
                                        <th className="px-5 py-3">
                                            Receipt No.
                                        </th>
                                        <th className="px-5 py-3">
                                            Date and time
                                        </th>
                                        <th className="px-5 py-3">Slip</th>
                                        <th className="px-5 py-3">Buyer</th>
                                        <th className="px-5 py-3">Method</th>
                                        <th className="px-5 py-3 text-right">
                                            Amount
                                        </th>
                                        <th className="px-5 py-3">Status</th>
                                        <th className="px-5 py-3">
                                            <span className="sr-only">
                                                Actions
                                            </span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {payments.data.map((row) => (
                                        <tr
                                            key={row.id}
                                            className={cn(
                                                row.void && 'bg-red-50/40',
                                            )}
                                        >
                                            <td className="px-5 py-3 font-black whitespace-nowrap text-slate-900">
                                                {row.receipt_number}
                                            </td>
                                            <td className="px-5 py-3 whitespace-nowrap text-slate-600">
                                                {formatDateTime(row.paid_at)}
                                            </td>
                                            <td className="px-5 py-3 font-bold whitespace-nowrap text-slate-800">
                                                {row.number}
                                                <span className="ml-1.5 text-xs font-semibold text-slate-500">
                                                    {row.kind === 'order'
                                                        ? 'Order'
                                                        : 'Preorder'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-slate-700">
                                                <span className="flex items-center gap-1.5">
                                                    {row.buyer_name}
                                                    {row.is_staff && (
                                                        <StaffTag />
                                                    )}
                                                </span>
                                                {row.buyer_id && (
                                                    <span className="block text-xs text-slate-500">
                                                        {row.buyer_id}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3 whitespace-nowrap text-slate-700">
                                                {row.method_label}
                                            </td>
                                            <td
                                                className={cn(
                                                    'px-5 py-3 text-right font-black whitespace-nowrap',
                                                    row.void
                                                        ? 'text-slate-400 line-through'
                                                        : 'text-slate-900',
                                                )}
                                            >
                                                {formatPeso(
                                                    row.amount_centavos,
                                                )}
                                            </td>
                                            <td className="px-5 py-3 whitespace-nowrap">
                                                <StatusPill row={row} />
                                            </td>
                                            <td className="px-5 py-3 text-right whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setViewing(row)
                                                    }
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-black text-blue-700 shadow-sm hover:bg-blue-50"
                                                >
                                                    <Eye size={15} />
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <Pagination pagination={payments} itemName="payments" />
                </Panel>
            </div>

            <PaymentDetails
                row={viewing}
                readOnly={readOnly}
                onClose={() => setViewing(null)}
            />
        </>
    );
}

function StatusPill({ row }: { row: PaymentRow }) {
    const [label, classes] = row.void
        ? ['Voided', 'bg-red-100 text-red-700']
        : row.released
          ? ['Paid · Released', 'bg-emerald-100 text-emerald-700']
          : ['Paid', 'bg-blue-100 text-blue-700'];

    return (
        <span
            className={cn(
                'rounded-full px-2.5 py-1 text-xs font-black',
                classes,
            )}
        >
            {label}
        </span>
    );
}

/** One payment in full: what was paid, how, by whom and when, and whether it is VOID. */
function PaymentDetails({
    row,
    readOnly,
    onClose,
}: {
    row: PaymentRow | null;
    readOnly: boolean;
    onClose: () => void;
}) {
    return (
        <Dialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-lg rounded-3xl border-slate-200 p-0 [&>button:last-child]:hidden">
                {row && (
                    <>
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                            <div>
                                <DialogTitle className="text-lg font-black text-slate-900">
                                    Payment Receipt {row.receipt_number}
                                </DialogTitle>
                                <DialogDescription className="text-sm text-slate-500">
                                    {row.kind === 'order'
                                        ? 'Order'
                                        : 'Preorder slip'}{' '}
                                    {row.number} · {row.buyer_name}
                                </DialogDescription>
                            </div>
                            <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                                <X size={20} />
                                <span className="sr-only">Close</span>
                            </DialogClose>
                        </div>

                        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 px-6 py-5 text-sm">
                            <Detail label="Status">
                                <StatusPill row={row} />
                            </Detail>
                            <Detail label="Date and time">
                                {formatDateTime(row.paid_at)}
                            </Detail>
                            <Detail label="Amount">
                                <span className="font-black">
                                    {formatPeso(row.amount_centavos)}
                                </span>
                            </Detail>
                            <Detail label="Payment method">
                                {row.method_label}
                            </Detail>
                            {row.method === 'cash' ? (
                                <>
                                    <Detail label="Amount received">
                                        {formatPeso(
                                            row.amount_received_centavos,
                                        )}
                                    </Detail>
                                    <Detail label="Change">
                                        {formatPeso(row.change_centavos)}
                                    </Detail>
                                </>
                            ) : (
                                <Detail label="GCash reference">
                                    <span className="font-mono">
                                        {row.gcash_reference}
                                    </span>
                                </Detail>
                            )}
                            <Detail label="Buyer ID">
                                {row.buyer_id ?? 'Not given'}
                            </Detail>
                            <Detail label="Received by">
                                {row.cashier ?? 'Unknown'}
                            </Detail>
                            {row.void && (
                                <>
                                    <Detail label="Voided">
                                        {formatDateTime(row.voided_at)}
                                        {row.voided_by
                                            ? ` by ${row.voided_by}`
                                            : ''}
                                    </Detail>
                                    <Detail label="Reason">
                                        <span className="text-red-700">
                                            {row.void_reason}
                                        </span>
                                    </Detail>
                                </>
                            )}
                        </dl>

                        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 px-6 py-4">
                            <Link
                                href={CashierController.receipt(row.id)}
                                className="inline-flex items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 py-2.5 text-sm font-black text-blue-700 hover:bg-blue-100"
                            >
                                <ReceiptText size={16} />
                                Open receipt
                            </Link>
                            {!readOnly && (
                                <a
                                    href={
                                        CashierController.printReceipt(row.id)
                                            .url
                                    }
                                    target="_blank"
                                    rel="noopener"
                                    className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700"
                                >
                                    <Printer size={16} />
                                    Reprint receipt
                                </a>
                            )}
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
    return (
        <>
            <dt className="font-bold text-slate-500">{label}</dt>
            <dd className="text-slate-900">{children}</dd>
        </>
    );
}
