import { Head, router, usePage } from '@inertiajs/react';
import {
    Banknote,
    Download,
    Printer,
    ReceiptText,
    Smartphone,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
import CashierRecordsController from '@/actions/App/Http/Controllers/CashierRecordsController';
import InputError from '@/components/input-error';
import PageHeader from '@/components/page-header';
import Panel from '@/components/panel';
import PaymentPeriodFilter, {
    paymentQuery,
} from '@/components/payment-period-filter';
import SummaryCard from '@/components/summary-card';
import { todayIso } from '@/lib/dates';
import { formatPeso, receiptCount } from '@/lib/format';
import { openCalendar } from '@/lib/open-calendar';
import { cn } from '@/lib/utils';
import type { PaymentFilters, PaymentTotals } from '@/types';

type CollectionRow = {
    period: string;
    label: string;
    count: number;
    total_centavos: number;
    cash_centavos: number;
    gcash_centavos: number;
    void_count: number;
};

/**
 * Collections: the money the cashier collected in a period (this month by
 * default, or any From / To days, e.g. January to February), by day or by
 * month, split into Cash and GCash; void payments are listed apart and not
 * counted. The cashier downloads it for Excel and prints the daily
 * collection report; the School Admin views it read-only.
 */
export default function Collections({
    totals,
    rows,
    filters,
    readOnly,
}: {
    totals: PaymentTotals;
    rows: CollectionRow[];
    filters: PaymentFilters;
    readOnly: boolean;
}) {
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const [reportDay, setReportDay] = useState(todayIso());

    const show = (next: Partial<PaymentFilters>) => {
        router.get(
            CashierRecordsController.collections().url,
            paymentQuery({ ...filters, ...next }, 'month'),
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const exportUrl = CashierRecordsController.collectionsCsv({
        query: paymentQuery(filters, 'month'),
    }).url;

    return (
        <>
            <Head title="Collections" />

            <div className="space-y-6">
                <PageHeader
                    title="Collections"
                    description={
                        readOnly
                            ? 'The money collected at the cashier for PROWARE, by day or by month. View only.'
                            : 'The money collected for PROWARE, by day or by month. Choose any period, e.g. January 1 to February 28.'
                    }
                    actions={
                        !readOnly && (
                            <a
                                href={exportUrl}
                                data-test="download-collections"
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
                        description={`${receiptCount(totals.count)} in this period`}
                        icon={ReceiptText}
                    />
                    <SummaryCard
                        label="Cash Payments"
                        value={formatPeso(totals.cash_centavos)}
                        description={receiptCount(totals.cash_count)}
                        icon={Banknote}
                    />
                    <SummaryCard
                        label="GCash Payments"
                        value={formatPeso(totals.gcash_centavos)}
                        description={receiptCount(totals.gcash_count)}
                        icon={Smartphone}
                    />
                    <SummaryCard
                        label="Voided Payments"
                        value={formatPeso(totals.void_centavos)}
                        description={`${receiptCount(totals.void_count)}, not counted in the total`}
                        icon={XCircle}
                    />
                </section>

                {!readOnly && (
                    <Panel
                        title="Daily collection report"
                        description="One day's receipts and totals by method, with Prepared by and Checked by lines, for the end-of-day cash count."
                    >
                        <div className="flex flex-wrap items-end gap-3 px-6 py-5">
                            <label className="grid gap-1">
                                <span className="text-xs font-bold tracking-wide text-slate-400 uppercase">
                                    Day
                                </span>
                                <input
                                    type="date"
                                    onClick={openCalendar}
                                    value={reportDay}
                                    max={todayIso()}
                                    onChange={(event) =>
                                        setReportDay(event.target.value)
                                    }
                                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                    aria-label="Day of the report"
                                />
                            </label>
                            <a
                                href={
                                    reportDay === ''
                                        ? undefined
                                        : CashierRecordsController.daily({
                                              query: { date: reportDay },
                                          }).url
                                }
                                target="_blank"
                                rel="noopener"
                                aria-disabled={reportDay === ''}
                                data-test="print-daily-report"
                                className={cn(
                                    'inline-flex h-11 items-center gap-2 rounded-xl bg-[#0D6EFD] px-4 text-sm font-black text-white shadow-sm hover:bg-blue-700',
                                    reportDay === '' &&
                                        'pointer-events-none opacity-50',
                                )}
                            >
                                <Printer size={17} />
                                Print daily report
                            </a>
                            <InputError
                                message={
                                    reportDay === ''
                                        ? 'Choose the day of the report.'
                                        : errors.date
                                }
                                className="w-full font-semibold"
                            />
                        </div>
                    </Panel>
                )}

                <Panel>
                    <div className="space-y-4 border-b border-slate-100 px-6 py-4">
                        <PaymentPeriodFilter
                            filters={filters}
                            clearTo="month"
                            error={errors.date_from ?? errors.date_to}
                            onChange={show}
                        />
                        <div className="flex gap-2">
                            {(
                                [
                                    ['day', 'By day'],
                                    ['month', 'By month'],
                                ] as const
                            ).map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => show({ group: value })}
                                    aria-pressed={filters.group === value}
                                    className={cn(
                                        'rounded-xl px-4 py-2 text-sm font-black transition',
                                        filters.group === value
                                            ? 'bg-slate-900 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {rows.length === 0 ? (
                        <p className="px-6 py-12 text-center text-sm text-slate-500">
                            No payments were recorded in this period.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-left text-xs font-black tracking-wide text-slate-500 uppercase">
                                    <tr>
                                        <th className="px-5 py-3">
                                            {filters.group === 'month'
                                                ? 'Month'
                                                : 'Day'}
                                        </th>
                                        <th className="px-5 py-3 text-right">
                                            Payments
                                        </th>
                                        <th className="px-5 py-3 text-right">
                                            Cash
                                        </th>
                                        <th className="px-5 py-3 text-right">
                                            GCash
                                        </th>
                                        <th className="px-5 py-3 text-right">
                                            Total collected
                                        </th>
                                        <th className="px-5 py-3 text-right">
                                            Void
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {rows.map((row) => (
                                        <tr key={row.period}>
                                            <td className="px-5 py-3 font-bold text-slate-800">
                                                {row.label}
                                            </td>
                                            <td className="px-5 py-3 text-right text-slate-700">
                                                {row.count}
                                            </td>
                                            <td className="px-5 py-3 text-right text-slate-700">
                                                {formatPeso(row.cash_centavos)}
                                            </td>
                                            <td className="px-5 py-3 text-right text-slate-700">
                                                {formatPeso(row.gcash_centavos)}
                                            </td>
                                            <td className="px-5 py-3 text-right font-black text-slate-900">
                                                {formatPeso(row.total_centavos)}
                                            </td>
                                            <td className="px-5 py-3 text-right text-red-700">
                                                {row.void_count > 0
                                                    ? row.void_count
                                                    : ''}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50 font-black text-slate-900">
                                    <tr>
                                        <td className="px-5 py-3">Total</td>
                                        <td className="px-5 py-3 text-right">
                                            {totals.count}
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            {formatPeso(totals.cash_centavos)}
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            {formatPeso(totals.gcash_centavos)}
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            {formatPeso(totals.total_centavos)}
                                        </td>
                                        <td className="px-5 py-3 text-right text-red-700">
                                            {totals.void_count > 0
                                                ? totals.void_count
                                                : ''}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </Panel>
            </div>
        </>
    );
}
