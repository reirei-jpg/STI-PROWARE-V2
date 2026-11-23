import { Head, Link, router } from '@inertiajs/react';
import { Banknote, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import CashierController from '@/actions/App/Http/Controllers/CashierController';
import CashierRecordsController from '@/actions/App/Http/Controllers/CashierRecordsController';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import Panel from '@/components/panel';
import StaffTag from '@/components/staff-tag';
import { formatDateOrdered, formatDateTime, formatPeso } from '@/lib/format';
import { isSameSearch } from '@/lib/utils';
import type { AwaitingRow, Paginated } from '@/types';

/**
 * Awaiting Payment: who still has to pay, the oldest first. Orders and
 * preorder slips, each found by slip number, buyer name or ID, for a
 * buyer without the slip. Record Payment opens the slip, ready to collect.
 */
export default function AwaitingPayment({
    search: currentSearch,
    orders,
    slips,
}: {
    search: string;
    orders: Paginated<AwaitingRow>;
    slips: Paginated<AwaitingRow>;
}) {
    const [search, setSearch] = useState(currentSearch);
    const firstRender = useRef(true);

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;

            return;
        }

        if (isSameSearch(search, currentSearch)) {
            return;
        }

        const timer = window.setTimeout(
            () =>
                router.get(
                    CashierRecordsController.awaiting().url,
                    search.trim() === '' ? {} : { search: search.trim() },
                    { preserveState: true, replace: true },
                ),
            400,
        );

        return () => window.clearTimeout(timer);
        // Only the typed search starts a new search.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    return (
        <>
            <Head title="Awaiting Payment" />

            <div className="space-y-6">
                <PageHeader
                    title="Awaiting Payment"
                    description="Orders and preorder slips not paid yet, the oldest first. Search by slip number, buyer name or ID when the buyer has no slip."
                />

                <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                    <Search size={18} className="shrink-0" />
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        maxLength={100}
                        autoFocus
                        placeholder="Search slip number, buyer name or ID"
                        className="w-full min-w-0 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                        aria-label="Search awaiting payment"
                    />
                </label>

                <AwaitingList
                    title="Orders"
                    rows={orders}
                    itemName="orders"
                    search={currentSearch}
                />
                <AwaitingList
                    title="Preorder slips"
                    rows={slips}
                    itemName="preorder slips"
                    search={currentSearch}
                />
            </div>
        </>
    );
}

function AwaitingList({
    title,
    rows,
    itemName,
    search,
}: {
    title: string;
    rows: Paginated<AwaitingRow>;
    itemName: string;
    search: string;
}) {
    return (
        <Panel
            title={`${title} (${rows.total})`}
            description={
                title === 'Orders'
                    ? 'Placed and not paid yet. First to pay, first served.'
                    : 'Preorders waiting for their items, not paid yet.'
            }
        >
            {rows.data.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-slate-500">
                    {search !== ''
                        ? `No ${itemName} awaiting payment match "${search}".`
                        : `No ${itemName} are awaiting payment.`}
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-black tracking-wide text-slate-500 uppercase">
                            <tr>
                                <th className="px-5 py-3">Slip</th>
                                <th className="px-5 py-3">Buyer</th>
                                <th className="px-5 py-3">For</th>
                                <th className="px-5 py-3">Since</th>
                                <th className="px-5 py-3 text-right">
                                    Amount due
                                </th>
                                <th className="px-5 py-3">
                                    <span className="sr-only">Record</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rows.data.map((row) => (
                                <tr key={`${row.kind}-${row.id}`}>
                                    <td className="px-5 py-3 font-black whitespace-nowrap text-slate-900">
                                        {row.number}
                                    </td>
                                    <td className="px-5 py-3 text-slate-700">
                                        <span className="flex items-center gap-1.5">
                                            {row.buyer_name}
                                            {row.is_staff && <StaffTag />}
                                        </span>
                                        {row.buyer_id && (
                                            <span className="block text-xs text-slate-500">
                                                {row.buyer_id}
                                            </span>
                                        )}
                                    </td>
                                    <td className="max-w-xs px-5 py-3 text-slate-700">
                                        {row.for}
                                        {row.pay_until && (
                                            <span className="block text-xs font-bold text-amber-700">
                                                Pay by{' '}
                                                {formatDateOrdered(
                                                    row.pay_until,
                                                )}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3 whitespace-nowrap text-slate-600">
                                        {formatDateTime(row.since)}
                                    </td>
                                    <td className="px-5 py-3 text-right font-black whitespace-nowrap text-slate-900">
                                        {formatPeso(row.amount_centavos)}
                                    </td>
                                    <td className="px-5 py-3 text-right whitespace-nowrap">
                                        <Link
                                            href={CashierController.record({
                                                query: {
                                                    code: row.number ?? '',
                                                },
                                            })}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D6EFD] px-3 py-1.5 text-sm font-black text-white hover:bg-blue-700"
                                        >
                                            <Banknote size={15} />
                                            Record Payment
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <Pagination pagination={rows} itemName={itemName} />
        </Panel>
    );
}
