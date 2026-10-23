import { Head, router } from '@inertiajs/react';
import { CircleAlert, Eye } from 'lucide-react';
import { useState } from 'react';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import Panel from '@/components/panel';
import PurchaseOrderDetailsDialog from '@/components/purchase-order-details-dialog';
import { formatDateOrdered, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import type { DeliveryStatus, Paginated } from '@/types';

export type AdminDeliveryTab = 'coming' | 'ongoing' | 'completed';

/** One eStore order on the School Admin's Deliveries list. */
export type AdminDeliveryRow = {
    id: number;
    order_number: string | null;
    category: string | null;
    date_ordered: string;
    days_since_ordered: number;
    items_count: number;
    uploaded_at: string | null;
    last_delivery_at: string | null;
    /** When the last pieces arrived, or when it was closed with some missing. */
    completed_at: string | null;
    completed_after_days: number | null;
    status: DeliveryStatus;
    status_label: string;
    percent_received: number;
    quantity_ordered: number;
    quantity_received: number;
    /** Not complete after the days set in Maintenance. */
    is_late: boolean;
};

export type SchoolAdminOverviewData = {
    deliveries: {
        tab: AdminDeliveryTab;
        late_days: number;
        counts: Record<
            AdminDeliveryTab | 'coming_late' | 'ongoing_late',
            number
        >;
        orders: Paginated<AdminDeliveryRow>;
    };
};

const tabs: {
    value: AdminDeliveryTab;
    label: string;
    hint: string;
    selectedClasses: string;
    countClasses: string;
}[] = [
    {
        value: 'coming',
        label: 'Coming',
        hint: 'Uploaded, nothing arrived yet',
        selectedClasses: 'border-amber-400 bg-amber-50',
        countClasses: 'bg-amber-100 text-amber-800',
    },
    {
        value: 'ongoing',
        label: 'Ongoing',
        hint: 'Some items arrived, the rest still to come',
        selectedClasses: 'border-[#0D6EFD] bg-blue-50',
        countClasses: 'bg-blue-100 text-blue-800',
    },
    {
        value: 'completed',
        label: 'Completed',
        hint: 'Everything arrived, or closed with some missing',
        selectedClasses: 'border-emerald-500 bg-emerald-50',
        countClasses: 'bg-emerald-100 text-emerald-800',
    },
];

const statusClasses: Record<DeliveryStatus, string> = {
    awaiting: 'bg-amber-100 text-amber-800',
    partially_received: 'bg-blue-100 text-blue-800',
    completed: 'bg-emerald-100 text-emerald-800',
    completed_short: 'bg-red-100 text-red-800',
};

const barClasses: Record<DeliveryStatus, string> = {
    awaiting: 'bg-amber-400',
    partially_received: 'bg-[#0D6EFD]',
    completed: 'bg-emerald-500',
    completed_short: 'bg-red-500',
};

const emptyText: Record<AdminDeliveryTab, string> = {
    coming: 'No order is waiting for its first delivery. An order shows here as soon as the Specialist uploads it, until its first items arrive.',
    ongoing:
        'No order is partly delivered right now. An order shows here once its first items arrive, until the rest arrive.',
    completed:
        'No order is complete yet. An order shows here once everything arrived, or when the Specialist closes it with some missing.',
};

/**
 * The School Admin's dashboard (view only): every eStore order the
 * Specialist uploaded, in three tabs by what has arrived, with the date and
 * time of each step. 5 orders a page; View Details opens the order.
 */
export default function SchoolAdminOverview({
    firstName,
    overview,
}: {
    firstName: string;
    overview: SchoolAdminOverviewData;
}) {
    const [viewing, setViewing] = useState<number | null>(null);
    const { tab, counts, late_days: lateDays, orders } = overview.deliveries;
    const today = new Intl.DateTimeFormat('en-PH', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
    }).format(new Date());

    const showTab = (next: AdminDeliveryTab) =>
        router.get(
            dashboard().url,
            { tab: next },
            {
                only: ['overview'],
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );

    return (
        <>
            <Head title="Dashboard" />

            <div className="space-y-7">
                <PageHeader
                    title={`Welcome, ${firstName}`}
                    description={`${today} · the eStore orders the Specialist uploaded and what has arrived. View only.`}
                />

                <Panel
                    title="Deliveries"
                    description="Every eStore order the Specialist uploaded, by what has arrived. Open one for its items and Delivery History."
                >
                    <div
                        role="tablist"
                        aria-label="Delivery status"
                        className="grid gap-3 px-6 pt-5 pb-5 sm:grid-cols-3"
                    >
                        {tabs.map((option) => {
                            const selected = option.value === tab;
                            const late =
                                option.value === 'completed'
                                    ? 0
                                    : counts[`${option.value}_late`];

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    role="tab"
                                    aria-selected={selected}
                                    onClick={() => showTab(option.value)}
                                    className={cn(
                                        'rounded-2xl border-2 px-4 py-3.5 text-left transition',
                                        selected
                                            ? option.selectedClasses
                                            : 'border-slate-200 bg-white hover:border-slate-300',
                                    )}
                                >
                                    <span className="flex items-center justify-between gap-2">
                                        <span className="font-black text-slate-900">
                                            {option.label}
                                        </span>
                                        <span
                                            className={cn(
                                                'min-w-7 rounded-full px-2 py-0.5 text-center text-sm font-black',
                                                option.countClasses,
                                            )}
                                        >
                                            {counts[
                                                option.value
                                            ].toLocaleString('en-PH')}
                                        </span>
                                    </span>
                                    <span className="mt-1 block text-xs font-semibold text-slate-600">
                                        {option.hint}
                                        {late > 0 && (
                                            <span className="font-black text-red-700">
                                                {' '}
                                                · {late} late
                                            </span>
                                        )}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {orders.data.length === 0 ? (
                        <p className="border-t border-slate-100 px-6 py-12 text-center text-sm text-slate-500">
                            {emptyText[tab]}
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[820px] text-sm">
                                <thead className="bg-slate-50 text-left text-[11px] font-black tracking-wider text-slate-500 uppercase">
                                    <tr>
                                        <th className="px-6 py-3">Order #</th>
                                        <th className="px-4 py-3">Dates</th>
                                        <th className="px-4 py-3">Received</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-6 py-3 text-right">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {orders.data.map((order) => (
                                        <OrderRow
                                            key={order.id}
                                            order={order}
                                            lateDays={lateDays}
                                            onView={() => setViewing(order.id)}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <Pagination pagination={orders} itemName="orders" />
                </Panel>
            </div>

            <PurchaseOrderDetailsDialog
                purchaseOrderId={viewing}
                onClose={() => setViewing(null)}
            />
        </>
    );
}

function OrderRow({
    order,
    lateDays,
    onView,
}: {
    order: AdminDeliveryRow;
    lateDays: number;
    onView: () => void;
}) {
    return (
        <tr className={cn('align-top', order.is_late && 'bg-red-50/40')}>
            <td className="px-6 py-4">
                <p className="font-mono font-black text-[#0D6EFD]">
                    {order.order_number
                        ? `#${order.order_number}`
                        : 'No Order #'}
                </p>
                {order.category && (
                    <span className="mt-1.5 inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-black text-blue-700">
                        {order.category}
                    </span>
                )}
            </td>
            <td className="px-4 py-4">
                <p>
                    <span className="text-slate-500">Ordered</span>{' '}
                    <strong>{formatDateOrdered(order.date_ordered)}</strong>{' '}
                    <span className="text-xs text-slate-500">
                        · {daysAgo(order.days_since_ordered)}
                    </span>
                </p>
                <p className="mt-1">
                    <span className="text-slate-500">{stepLabel(order)}</span>{' '}
                    <strong>{formatDateTime(stepAt(order))}</strong>
                </p>
                {order.completed_after_days !== null && (
                    <p className="mt-1 text-xs text-slate-500">
                        {order.completed_after_days === 0
                            ? 'Arrived the same day it was ordered'
                            : `Took ${order.completed_after_days} ${order.completed_after_days === 1 ? 'day' : 'days'} from the Date Ordered`}
                    </p>
                )}
            </td>
            <td className="min-w-48 px-4 py-4">
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                        className={cn(
                            'h-full rounded-full',
                            barClasses[order.status],
                        )}
                        style={{ width: `${order.percent_received}%` }}
                    />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                    {order.percent_received}% ·{' '}
                    {order.quantity_received.toLocaleString('en-PH')} of{' '}
                    {order.quantity_ordered.toLocaleString('en-PH')} pcs
                </p>
            </td>
            <td className="px-4 py-4">
                <span
                    className={cn(
                        'inline-flex rounded-full px-3 py-1 text-xs font-black whitespace-nowrap',
                        statusClasses[order.status],
                    )}
                >
                    {order.status_label}
                </span>
                {order.is_late && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-black text-red-700">
                        <CircleAlert size={14} />
                        Late · not complete after {lateDays} days
                    </p>
                )}
            </td>
            <td className="px-6 py-4 text-right">
                <button
                    type="button"
                    onClick={onView}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 text-sm font-black whitespace-nowrap text-blue-700 transition hover:bg-blue-100"
                >
                    <Eye size={16} />
                    View Details
                </button>
            </td>
        </tr>
    );
}

/** The second date line: when it was uploaded, last delivered, or completed. */
function stepLabel(order: AdminDeliveryRow): string {
    if (order.completed_at !== null) {
        return order.status === 'completed_short'
            ? 'Completed (some missing)'
            : 'Completed';
    }

    return order.last_delivery_at !== null ? 'Last delivery' : 'Uploaded';
}

function stepAt(order: AdminDeliveryRow): string | null {
    return order.completed_at ?? order.last_delivery_at ?? order.uploaded_at;
}

function daysAgo(days: number): string {
    if (days === 0) {
        return 'today';
    }

    return days === 1 ? '1 day ago' : `${days} days ago`;
}
