import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    Banknote,
    Clock,
    ReceiptText,
    Smartphone,
    Wallet,
    XCircle,
} from 'lucide-react';
import CashierController from '@/actions/App/Http/Controllers/CashierController';
import CashierRecordsController from '@/actions/App/Http/Controllers/CashierRecordsController';
import PageHeader from '@/components/page-header';
import Panel from '@/components/panel';
import SlipScanBox from '@/components/slip-scan-box';
import StaffTag from '@/components/staff-tag';
import SummaryCard from '@/components/summary-card';
import { formatDateTime, formatPeso, receiptCount } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Auth, AwaitingRow, PaymentRow, PaymentTotals } from '@/types';

/**
 * What the cashier sees on opening the account: today's total, Cash and
 * GCash payments, what is awaiting payment, today's voided payments (only
 * when there are some), the slip scanner, the latest payments and the
 * slips waiting the longest.
 */
export default function CashierDashboard({
    today,
    awaiting,
    latest,
    oldest_awaiting: oldestAwaiting,
}: {
    today: PaymentTotals;
    awaiting: { orders: number; slips: number; total_centavos: number };
    latest: PaymentRow[];
    oldest_awaiting: AwaitingRow[];
}) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const firstName = auth.user.name.split(' ')[0];
    const waiting = awaiting.orders + awaiting.slips;

    return (
        <>
            <Head title="Dashboard" />

            <div className="space-y-6">
                <PageHeader
                    title={`Welcome, ${firstName}`}
                    description={`${new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())} · Today's collections and the slips awaiting payment.`}
                />

                <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                    <SummaryCard
                        label="Total Collected Today"
                        value={formatPeso(today.total_centavos)}
                        description={`${receiptCount(today.count)} issued today`}
                        icon={Wallet}
                        href={
                            CashierRecordsController.history({
                                query: { status: 'paid' },
                            }).url
                        }
                        actionLabel="View receipts"
                        testId="card-total"
                    />
                    <SummaryCard
                        label="Cash Payments"
                        value={formatPeso(today.cash_centavos)}
                        description={`${receiptCount(today.cash_count)} today`}
                        icon={Banknote}
                        href={
                            CashierRecordsController.history({
                                query: { method: 'cash', status: 'paid' },
                            }).url
                        }
                        actionLabel="View Cash payments"
                        testId="card-cash"
                    />
                    <SummaryCard
                        label="GCash Payments"
                        value={formatPeso(today.gcash_centavos)}
                        description={`${receiptCount(today.gcash_count)} today`}
                        icon={Smartphone}
                        href={
                            CashierRecordsController.history({
                                query: { method: 'gcash', status: 'paid' },
                            }).url
                        }
                        actionLabel="View GCash payments"
                        testId="card-gcash"
                    />
                    <SummaryCard
                        label="Awaiting Payment"
                        value={String(waiting)}
                        description={`${awaiting.orders} ${awaiting.orders === 1 ? 'order' : 'orders'} · ${awaiting.slips} preorder ${awaiting.slips === 1 ? 'slip' : 'slips'} · ${formatPeso(awaiting.total_centavos)} in total`}
                        icon={Clock}
                        href={CashierRecordsController.awaiting().url}
                        actionLabel="View awaiting payment"
                        testId="card-awaiting"
                    />
                </section>

                {today.void_count > 0 && (
                    <Link
                        href={
                            CashierRecordsController.history({
                                query: { status: 'void' },
                            }).url
                        }
                        data-test="void-today"
                        className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 transition hover:border-red-300 hover:bg-red-100"
                    >
                        <XCircle size={18} className="shrink-0" />
                        <span className="flex-1">
                            {today.void_count}{' '}
                            {today.void_count === 1
                                ? 'voided payment'
                                : 'voided payments'}{' '}
                            today ({formatPeso(today.void_centavos)}), not
                            counted in the total.
                        </span>
                        <span className="inline-flex items-center gap-1 font-black whitespace-nowrap">
                            View
                            <ArrowRight size={15} />
                        </span>
                    </Link>
                )}

                <SlipScanBox
                    openUrl={CashierController.record().url}
                    placeholder="Enter the slip number, e.g. PW-0042 or PR-0003"
                    title="Record a payment"
                    description="Scan the QR code on the buyer's issuance slip or preorder slip, or enter the slip number when there is no QR code."
                />

                <div className="grid gap-6 xl:grid-cols-2">
                    <Panel
                        title="Latest payments today"
                        description="The most recent Payment Receipts."
                        actions={
                            <Link
                                href={CashierRecordsController.history()}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-blue-700 hover:bg-blue-50"
                            >
                                Payment History
                                <ArrowRight size={15} />
                            </Link>
                        }
                    >
                        {latest.length === 0 ? (
                            <p className="px-6 py-10 text-center text-sm text-slate-500">
                                No payments have been recorded today.
                            </p>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {latest.map((row) => (
                                    <li key={row.id}>
                                        <Link
                                            href={CashierController.receipt(
                                                row.id,
                                            )}
                                            className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-slate-50"
                                        >
                                            <span className="min-w-0">
                                                <span className="block font-black text-slate-900">
                                                    {row.receipt_number}
                                                    {row.void && (
                                                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                                                            Voided
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="block truncate text-xs text-slate-500">
                                                    {row.number} ·{' '}
                                                    {row.buyer_name} ·{' '}
                                                    {row.method_label} ·{' '}
                                                    {formatDateTime(
                                                        row.paid_at,
                                                    )}
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
                    </Panel>

                    <Panel
                        title="Waiting the longest"
                        description="Orders awaiting payment, the oldest first."
                        actions={
                            <Link
                                href={CashierRecordsController.awaiting()}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-blue-700 hover:bg-blue-50"
                            >
                                Awaiting Payment
                                <ArrowRight size={15} />
                            </Link>
                        }
                    >
                        {oldestAwaiting.length === 0 ? (
                            <p className="px-6 py-10 text-center text-sm text-slate-500">
                                No orders are awaiting payment.
                            </p>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {oldestAwaiting.map((row) => (
                                    <li
                                        key={row.id}
                                        className="flex items-center justify-between gap-3 px-6 py-3"
                                    >
                                        <span className="min-w-0">
                                            <span className="flex items-center gap-1.5 font-black text-slate-900">
                                                {row.number} · {row.buyer_name}
                                                {row.is_staff && <StaffTag />}
                                            </span>
                                            <span className="block truncate text-xs text-slate-500">
                                                {row.for} · placed{' '}
                                                {formatDateTime(row.since)}
                                            </span>
                                        </span>
                                        <Link
                                            href={CashierController.record({
                                                query: {
                                                    code: row.number ?? '',
                                                },
                                            })}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D6EFD] px-3 py-1.5 text-sm font-black whitespace-nowrap text-white hover:bg-blue-700"
                                        >
                                            <ReceiptText size={15} />
                                            {formatPeso(row.amount_centavos)}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                </div>
            </div>
        </>
    );
}
