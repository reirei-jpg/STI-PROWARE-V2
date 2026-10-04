import { Head, Link } from '@inertiajs/react';
import {
    CheckCircle2,
    ClipboardList,
    FileUp,
    PackageCheck,
    Timer,
    TriangleAlert,
    Truck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import DeliveryController from '@/actions/App/Http/Controllers/DeliveryController';
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController';
import PageHeader from '@/components/page-header';
import Panel from '@/components/panel';
import { formatDateOrdered, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

type ActivityKind = 'upload' | 'delivery' | 'closed_short';

export type SchoolAdminOverviewData = {
    cards: {
        awaiting: number;
        partially_received: number;
        /** Average progress of the partially received orders. */
        partially_percent: number;
        completed: number;
        completed_short: number;
        deliveries_this_week: number;
        recorded_by: string[];
    };
    activity: {
        kind: ActivityKind;
        at: string | null;
        by: string | null;
        purchase_order_id: number | null;
        title: string;
        detail: string;
    }[];
    expected: {
        purchase_order_id: number;
        order_number: string | null;
        expected_delivery_date: string;
        late: boolean;
        percent_received: number;
    }[];
};

const activityIcons: Record<ActivityKind, LucideIcon> = {
    upload: FileUp,
    delivery: Truck,
    closed_short: TriangleAlert,
};

const activityClasses: Record<ActivityKind, string> = {
    upload: 'bg-blue-50 text-blue-700',
    delivery: 'bg-emerald-50 text-emerald-700',
    closed_short: 'bg-amber-50 text-amber-700',
};

/**
 * The School Admin's dashboard: monitoring the purchase orders the
 * Specialist uploads and the deliveries that arrive (view only). Every line
 * says who did what and when, and opens that purchase order.
 */
export default function SchoolAdminOverview({
    firstName,
    overview,
}: {
    firstName: string;
    overview: SchoolAdminOverviewData;
}) {
    const today = new Intl.DateTimeFormat('en-PH', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
    }).format(new Date());
    const cards = overview.cards;
    const purchaseOrders = PurchaseOrderController.index().url;

    return (
        <>
            <Head title="Dashboard" />

            <div className="space-y-7">
                <PageHeader
                    title={`Welcome, ${firstName}`}
                    description={`${today} · the purchase orders the Specialist uploaded and what has arrived. View only.`}
                />

                <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    <OverviewCard
                        href={purchaseOrders}
                        icon={ClipboardList}
                        label="Awaiting delivery"
                        value={cards.awaiting}
                    >
                        purchase {cards.awaiting === 1 ? 'order' : 'orders'}{' '}
                        with nothing received yet
                    </OverviewCard>
                    <OverviewCard
                        href={purchaseOrders}
                        icon={Timer}
                        label="Partially received"
                        value={cards.partially_received}
                    >
                        {cards.partially_received === 0
                            ? 'none in progress'
                            : `${cards.partially_percent}% received on average`}
                    </OverviewCard>
                    <OverviewCard
                        href={purchaseOrders}
                        icon={CheckCircle2}
                        label="Completed"
                        value={cards.completed}
                    >
                        {cards.completed_short === 0
                            ? 'all fully delivered'
                            : `incl. ${cards.completed_short} closed short`}
                    </OverviewCard>
                    <OverviewCard
                        href={DeliveryController.index().url}
                        icon={Truck}
                        label="Deliveries this week"
                        value={cards.deliveries_this_week}
                    >
                        {cards.recorded_by.length === 0
                            ? 'none recorded yet'
                            : `recorded by ${cards.recorded_by.join(', ')}`}
                    </OverviewCard>
                </section>

                <Panel
                    title="Recent activity"
                    description="Uploads, deliveries and orders closed short, newest first. Open one to see the full purchase order and its Delivery History."
                    actions={
                        <Link
                            href={DeliveryController.index()}
                            className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 text-sm font-black text-blue-700 transition hover:bg-blue-100"
                        >
                            <Truck size={15} />
                            All deliveries
                        </Link>
                    }
                >
                    {overview.activity.length === 0 ? (
                        <p className="px-6 py-10 text-center text-sm text-slate-500">
                            Nothing uploaded or received yet.
                        </p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {overview.activity.map((event, index) => {
                                const Icon = activityIcons[event.kind];

                                return (
                                    <li key={`${event.kind}-${index}`}>
                                        <Link
                                            href={
                                                event.purchase_order_id
                                                    ? PurchaseOrderController.index(
                                                          {
                                                              query: {
                                                                  view: event.purchase_order_id,
                                                              },
                                                          },
                                                      ).url
                                                    : purchaseOrders
                                            }
                                            className="flex items-start gap-3 px-6 py-4 transition hover:bg-slate-50"
                                        >
                                            <span
                                                className={cn(
                                                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                                                    activityClasses[event.kind],
                                                )}
                                            >
                                                <Icon size={19} />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block font-black text-slate-900">
                                                    {event.title}
                                                </span>
                                                <span className="mt-0.5 block text-sm text-slate-600">
                                                    {event.detail}
                                                </span>
                                                <span className="mt-1 block text-xs text-slate-400">
                                                    {formatDateTime(event.at)}
                                                    {event.by &&
                                                        ` · by ${event.by}`}
                                                </span>
                                            </span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Panel>

                <Panel
                    title="Expected this week"
                    description="Deliveries Head Office said will arrive, and late ones."
                >
                    {overview.expected.length === 0 ? (
                        <p className="px-6 py-10 text-center text-sm text-slate-500">
                            No delivery is expected this week.
                        </p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {overview.expected.map((order) => (
                                <li key={order.purchase_order_id}>
                                    <Link
                                        href={
                                            PurchaseOrderController.index({
                                                query: {
                                                    view: order.purchase_order_id,
                                                },
                                            }).url
                                        }
                                        className="flex items-center justify-between gap-3 px-6 py-4 text-sm transition hover:bg-slate-50"
                                    >
                                        <span className="flex items-center gap-3">
                                            <PackageCheck
                                                size={18}
                                                className="text-blue-600"
                                            />
                                            <span className="font-black text-slate-900">
                                                {order.order_number
                                                    ? `Order #${order.order_number}`
                                                    : 'Purchase order'}
                                            </span>
                                            <span
                                                className={cn(
                                                    'rounded-full px-2.5 py-0.5 text-xs font-black',
                                                    order.late
                                                        ? 'bg-red-100 text-red-700'
                                                        : 'bg-blue-100 text-blue-700',
                                                )}
                                            >
                                                {order.late ? 'Late · ' : ''}
                                                expected{' '}
                                                {formatDateOrdered(
                                                    order.expected_delivery_date,
                                                )}
                                            </span>
                                        </span>
                                        <span className="font-bold text-slate-600">
                                            {order.percent_received}% received
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            </div>
        </>
    );
}

function OverviewCard({
    href,
    icon: Icon,
    label,
    value,
    children,
}: {
    href: string;
    icon: LucideIcon;
    label: string;
    value: number;
    children: ReactNode;
}) {
    return (
        <Link
            href={href}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md"
        >
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-600">{label}</p>
                    <p className="mt-2 text-3xl font-black text-slate-950">
                        {value.toLocaleString('en-PH')}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                        {children}
                    </p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Icon size={20} />
                </div>
            </div>
        </Link>
    );
}
