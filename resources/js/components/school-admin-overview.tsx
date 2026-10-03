import { Head, Link } from '@inertiajs/react';
import {
    Banknote,
    CalendarRange,
    ClipboardList,
    PackageCheck,
    TriangleAlert,
    Trophy,
    XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import OrderController from '@/actions/App/Http/Controllers/OrderController';
import ProductController from '@/actions/App/Http/Controllers/ProductController';
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController';
import PageHeader from '@/components/page-header';
import Panel from '@/components/panel';
import { formatDateTime, formatPeso } from '@/lib/format';
import { formatUnits } from '@/lib/units';

export type SchoolAdminOverviewData = {
    today: { orders: number; centavos: number };
    week: { orders: number; centavos: number; cancelled: number };
    orders: { to_prepare: number; ready: number; ready_centavos: number };
    stock: { low_products: number; out_of_stock_products: number };
    purchase_orders: {
        awaiting: number;
        partially_received: number;
        expected_this_week: number;
        next_expected: string | null;
    };
    best_sellers: { product_id: number; name: string; pieces: number }[];
    cancellations: {
        number: string | null;
        student_name: string;
        reason: string | null;
        cancelled_by: string | null;
        cancelled_at: string | null;
    }[];
};

const plural = (count: number, one: string, many: string) =>
    `${count.toLocaleString('en-PH')} ${count === 1 ? one : many}`;

/**
 * The School Admin's dashboard: what to monitor at a glance (view only).
 * Every card opens the page with the details.
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
    const purchaseOrders = overview.purchase_orders;

    return (
        <>
            <Head title="Dashboard" />

            <div className="space-y-7">
                <PageHeader
                    title={`Welcome, ${firstName}`}
                    description={`${today} · how PROWARE is doing. View only: the Specialist handles orders and stock.`}
                />

                <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    <OverviewCard
                        href={
                            OrderController.index({
                                query: { show: 'picked_up' },
                            }).url
                        }
                        icon={Banknote}
                        label="Sales today"
                        value={formatPeso(overview.today.centavos)}
                    >
                        {plural(overview.today.orders, 'order', 'orders')}{' '}
                        picked up and paid in cash
                    </OverviewCard>
                    <OverviewCard
                        href={
                            OrderController.index({
                                query: { show: 'picked_up' },
                            }).url
                        }
                        icon={CalendarRange}
                        label="This week"
                        value={formatPeso(overview.week.centavos)}
                    >
                        {plural(overview.week.orders, 'order', 'orders')} ·{' '}
                        {overview.week.cancelled} cancelled
                    </OverviewCard>
                    <OverviewCard
                        href={OrderController.index().url}
                        icon={PackageCheck}
                        label="Orders now"
                        value={`${overview.orders.to_prepare} to prepare`}
                    >
                        {overview.orders.ready} ready ·{' '}
                        {formatPeso(overview.orders.ready_centavos)} to collect
                    </OverviewCard>
                    <OverviewCard
                        href={
                            ProductController.index({
                                query: { stock: 'low' },
                            }).url
                        }
                        icon={TriangleAlert}
                        label="Stock"
                        value={plural(
                            overview.stock.low_products,
                            'product low',
                            'products low',
                        )}
                    >
                        {overview.stock.out_of_stock_products} out of stock
                    </OverviewCard>
                </section>

                <section className="grid gap-5 lg:grid-cols-2">
                    <Panel
                        title="Purchase orders"
                        description="Where the eStore orders from Head Office stand."
                        actions={
                            <Link
                                href={PurchaseOrderController.index()}
                                className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 text-sm font-black text-blue-700 transition hover:bg-blue-100"
                            >
                                <ClipboardList size={15} />
                                See all
                            </Link>
                        }
                    >
                        <dl className="divide-y divide-slate-100 text-sm">
                            <Row label="Awaiting delivery">
                                {purchaseOrders.awaiting}
                            </Row>
                            <Row label="Partially received">
                                {purchaseOrders.partially_received}
                            </Row>
                            <Row label="Expected this week">
                                {purchaseOrders.expected_this_week}
                                {purchaseOrders.next_expected && (
                                    <span className="ml-2 font-normal text-slate-500">
                                        (next: Order #
                                        {purchaseOrders.next_expected})
                                    </span>
                                )}
                            </Row>
                        </dl>
                    </Panel>

                    <Panel
                        title="Best sellers this month"
                        description="Pieces picked up by students."
                    >
                        {overview.best_sellers.length === 0 ? (
                            <p className="px-6 py-8 text-center text-sm text-slate-500">
                                No sales yet this month.
                            </p>
                        ) : (
                            <ol className="divide-y divide-slate-100 text-sm">
                                {overview.best_sellers.map((seller, index) => (
                                    <li
                                        key={seller.product_id}
                                        className="flex items-center justify-between gap-3 px-6 py-3"
                                    >
                                        <span className="flex items-center gap-3">
                                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 font-black text-amber-700">
                                                {index === 0 ? (
                                                    <Trophy size={15} />
                                                ) : (
                                                    index + 1
                                                )}
                                            </span>
                                            <span className="font-bold text-slate-900">
                                                {seller.name}
                                            </span>
                                        </span>
                                        <span className="font-black text-slate-700">
                                            {formatUnits(
                                                seller.pieces,
                                                'Piece',
                                            )}
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </Panel>
                </section>

                <Panel
                    title="Recent cancellations"
                    description="The last orders cancelled, why, and by whom."
                >
                    {overview.cancellations.length === 0 ? (
                        <p className="px-6 py-8 text-center text-sm text-slate-500">
                            No cancelled orders.
                        </p>
                    ) : (
                        <ul className="divide-y divide-slate-100 text-sm">
                            {overview.cancellations.map((cancellation) => (
                                <li
                                    key={cancellation.number}
                                    className="flex flex-col gap-1 px-6 py-3 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <span className="flex items-start gap-3">
                                        <XCircle
                                            size={17}
                                            className="mt-0.5 shrink-0 text-red-500"
                                        />
                                        <span>
                                            <span className="font-black text-slate-900">
                                                {cancellation.number} ·{' '}
                                                {cancellation.student_name}
                                            </span>
                                            <span className="block text-slate-600">
                                                {cancellation.reason ??
                                                    'No reason given.'}
                                                {cancellation.cancelled_by &&
                                                    ` (${cancellation.cancelled_by})`}
                                            </span>
                                        </span>
                                    </span>
                                    <span className="shrink-0 text-xs text-slate-500">
                                        {formatDateTime(
                                            cancellation.cancelled_at,
                                        )}
                                    </span>
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
    value: string;
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
                    <p className="mt-2 truncate text-2xl font-black text-slate-950">
                        {value}
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

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3 px-6 py-3">
            <dt className="text-slate-600">{label}</dt>
            <dd className="font-black text-slate-900">{children}</dd>
        </div>
    );
}
