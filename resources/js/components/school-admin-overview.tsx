import { Head, Link } from '@inertiajs/react';
import {
    CheckCircle2,
    CircleAlert,
    ClipboardList,
    FileUp,
    Timer,
    TriangleAlert,
    Truck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import DeliveryController from '@/actions/App/Http/Controllers/DeliveryController';
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController';
import { ViewTab, ViewTabs } from '@/components/list-tabs';
import PageHeader from '@/components/page-header';
import Panel from '@/components/panel';
import StatCard from '@/components/stat-card';
import { formatDateOrdered, formatDateTime } from '@/lib/format';
import { buttonClasses } from '@/lib/ui';
import { cn } from '@/lib/utils';

type ActivityKind = 'upload' | 'delivery' | 'closed_short';

type ActivityEvent = {
    kind: ActivityKind;
    at: string | null;
    by: string | null;
    purchase_order_id: number | null;
    title: string;
    detail: string;
};

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
    /** Uploads and short closes, newest first. */
    purchase_order_activity: ActivityEvent[];
    /** Deliveries recorded, newest first. */
    delivery_activity: ActivityEvent[];
    /** Purchase orders not complete after the follow-up days, oldest first. */
    follow_up: {
        days: number;
        count: number;
        orders: {
            purchase_order_id: number;
            order_number: string | null;
            date_ordered: string;
            days_since_ordered: number;
            percent_received: number;
        }[];
    };
};

type Tab = 'purchase_orders' | 'deliveries';

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

const purchaseOrderUrl = (id: number | null) =>
    id === null
        ? PurchaseOrderController.index().url
        : PurchaseOrderController.index({ query: { view: id } }).url;

/**
 * The School Admin's dashboard: monitoring the purchase orders the
 * Specialist uploads and the deliveries that arrive (view only), in two
 * tabs. Every line says who did what and when, and opens that purchase
 * order with its Delivery History.
 */
export default function SchoolAdminOverview({
    firstName,
    overview,
}: {
    firstName: string;
    overview: SchoolAdminOverviewData;
}) {
    const [tab, setTab] = useState<Tab>('purchase_orders');
    const today = new Intl.DateTimeFormat('en-PH', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
    }).format(new Date());
    const cards = overview.cards;

    return (
        <>
            <Head title="Dashboard" />

            <div className="space-y-6">
                <PageHeader
                    title={`Welcome, ${firstName}`}
                    description={`${today} · the purchase orders the Specialist uploaded and what has arrived. View only.`}
                />

                <ViewTabs>
                    <ViewTab
                        active={tab === 'purchase_orders'}
                        onClick={() => setTab('purchase_orders')}
                        icon={ClipboardList}
                        count={cards.awaiting + cards.partially_received}
                    >
                        Purchase Orders
                    </ViewTab>
                    <ViewTab
                        active={tab === 'deliveries'}
                        onClick={() => setTab('deliveries')}
                        icon={Truck}
                        count={cards.deliveries_this_week}
                    >
                        Deliveries
                    </ViewTab>
                </ViewTabs>

                {tab === 'purchase_orders' ? (
                    <div className="space-y-6">
                        <section className="grid gap-4 md:grid-cols-3">
                            <StatCard
                                href={PurchaseOrderController.index().url}
                                icon={ClipboardList}
                                label="Awaiting delivery"
                                value={cards.awaiting}
                                tone="amber"
                                detail={`purchase ${cards.awaiting === 1 ? 'order' : 'orders'} with nothing received yet`}
                            />
                            <StatCard
                                href={PurchaseOrderController.index().url}
                                icon={Timer}
                                label="Partially received"
                                value={cards.partially_received}
                                tone="blue"
                                detail={
                                    cards.partially_received === 0
                                        ? 'none in progress'
                                        : `${cards.partially_percent}% received on average`
                                }
                            />
                            <StatCard
                                href={PurchaseOrderController.index().url}
                                icon={CheckCircle2}
                                label="Completed"
                                value={cards.completed}
                                tone="green"
                                detail={
                                    cards.completed_short === 0
                                        ? 'all fully delivered'
                                        : `incl. ${cards.completed_short} closed short`
                                }
                            />
                        </section>

                        <ActivityPanel
                            title="Recent purchase orders"
                            description="Uploaded by the Specialist, and orders closed short, newest first. Open one to see its items and Delivery History."
                            empty="No purchase order uploaded yet."
                            events={overview.purchase_order_activity}
                            seeAllLabel="All purchase orders"
                            seeAllHref={PurchaseOrderController.index().url}
                            seeAllIcon={ClipboardList}
                        />
                    </div>
                ) : (
                    <div className="space-y-6">
                        <section className="grid gap-4 md:grid-cols-2">
                            <StatCard
                                href={DeliveryController.index().url}
                                icon={Truck}
                                label="Deliveries this week"
                                value={cards.deliveries_this_week}
                                tone="blue"
                                detail={
                                    cards.recorded_by.length === 0
                                        ? 'none recorded yet'
                                        : `recorded by ${cards.recorded_by.join(', ')}`
                                }
                            />
                            <StatCard
                                href={
                                    DeliveryController.index({
                                        query: { show: 'follow_up' },
                                    }).url
                                }
                                icon={CircleAlert}
                                label={`Not complete after ${overview.follow_up.days} days`}
                                value={overview.follow_up.count}
                                tone="red"
                                detail={`purchase ${overview.follow_up.count === 1 ? 'order' : 'orders'} ordered ${overview.follow_up.days} or more days ago, not fully delivered`}
                            />
                        </section>

                        <ActivityPanel
                            title="Recent deliveries"
                            description="What arrived, for which order, with the SI # and DR #, newest first. Open one to see the purchase order."
                            empty="No delivery recorded yet."
                            events={overview.delivery_activity}
                            seeAllLabel="All deliveries"
                            seeAllHref={DeliveryController.index().url}
                            seeAllIcon={Truck}
                        />

                        <FollowUpPanel followUp={overview.follow_up} />
                    </div>
                )}
            </div>
        </>
    );
}

function ActivityPanel({
    title,
    description,
    empty,
    events,
    seeAllLabel,
    seeAllHref,
    seeAllIcon: SeeAllIcon,
}: {
    title: string;
    description: string;
    empty: string;
    events: ActivityEvent[];
    seeAllLabel: string;
    seeAllHref: string;
    seeAllIcon: LucideIcon;
}) {
    return (
        <Panel
            title={title}
            description={description}
            actions={
                <Link
                    href={seeAllHref}
                    className={buttonClasses.secondarySmall}
                >
                    <SeeAllIcon size={15} />
                    {seeAllLabel}
                </Link>
            }
        >
            {events.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-slate-500">
                    {empty}
                </p>
            ) : (
                <ul className="divide-y divide-slate-100">
                    {events.map((event, index) => {
                        const Icon = activityIcons[event.kind];

                        return (
                            <li key={`${event.kind}-${index}`}>
                                <Link
                                    href={purchaseOrderUrl(
                                        event.purchase_order_id,
                                    )}
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
                                            {event.by && ` · by ${event.by}`}
                                        </span>
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Panel>
    );
}

/**
 * Purchase orders not complete after the follow-up days: Head Office gives
 * no delivery date, so these are the ones taking long.
 */
function FollowUpPanel({
    followUp,
}: {
    followUp: SchoolAdminOverviewData['follow_up'];
}) {
    return (
        <Panel
            title={`Not complete after ${followUp.days} days`}
            description="Purchase orders ordered long ago that have not fully arrived, the oldest first."
        >
            {followUp.orders.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-slate-500">
                    Every purchase order ordered {followUp.days} or more days
                    ago has arrived.
                </p>
            ) : (
                <ul className="divide-y divide-slate-100">
                    {followUp.orders.map((order) => (
                        <li key={order.purchase_order_id}>
                            <Link
                                href={purchaseOrderUrl(order.purchase_order_id)}
                                className="flex items-center justify-between gap-3 px-6 py-4 text-sm transition hover:bg-slate-50"
                            >
                                <span className="flex flex-wrap items-center gap-3">
                                    <CircleAlert
                                        size={18}
                                        className="text-red-600"
                                    />
                                    <span className="font-black text-slate-900">
                                        {order.order_number
                                            ? `Order #${order.order_number}`
                                            : 'Purchase order'}
                                    </span>
                                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-black text-red-700">
                                        Ordered{' '}
                                        {formatDateOrdered(order.date_ordered)}{' '}
                                        · {order.days_since_ordered} days ago
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
    );
}
