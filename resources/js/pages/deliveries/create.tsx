import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    ExternalLink,
    PackageCheck,
    Search,
    SearchX,
    Truck,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import DeliveryController from '@/actions/App/Http/Controllers/DeliveryController';
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController';
import DeliveryProgress from '@/components/delivery-progress';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import Panel, { TableHeading, TableScroll } from '@/components/panel';
import RecordDeliveryDialog from '@/components/record-delivery-dialog';
import { formatDateOrdered } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Paginated, WaitingOrderRow } from '@/types';

/**
 * Record Delivery, step one: "Which order arrived?" The purchase orders
 * still waiting, the oldest first; Record opens the Record Delivery popup
 * with only that order's items. After saving, the list shows what is
 * still to come.
 */
export default function RecordDelivery({
    orders,
    search: initialSearch,
    followUpDays,
}: {
    orders: Paginated<WaitingOrderRow>;
    search: string | null;
    /** Days after the Date Ordered an order should be complete (Maintenance). */
    followUpDays: number;
}) {
    const [search, setSearch] = useState(initialSearch ?? '');
    const [recordingId, setRecordingId] = useState<number | null>(null);
    const firstRender = useRef(true);

    // Search by Order # as the Specialist types, after a short pause.
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;

            return;
        }

        const timer = window.setTimeout(
            () =>
                router.get(
                    DeliveryController.create().url,
                    search.trim() === '' ? {} : { search: search.trim() },
                    {
                        preserveState: true,
                        preserveScroll: true,
                        replace: true,
                    },
                ),
            400,
        );

        return () => window.clearTimeout(timer);
        // Only the typed text should trigger a search.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    return (
        <>
            <Head title="Record Delivery" />

            <div className="space-y-6">
                <PageHeader
                    title="Record Delivery"
                    description="Which order arrived? Choose it to enter what came for that order."
                    actions={
                        <Link
                            href={DeliveryController.index()}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black whitespace-nowrap text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                            <ArrowLeft size={18} />
                            Back to Deliveries
                        </Link>
                    }
                />

                <Panel>
                    <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h2 className="font-black text-slate-900">
                                Orders waiting to arrive
                            </h2>
                            <p className="mt-1 text-sm text-slate-500">
                                The oldest Date Ordered first. One box with
                                items from two orders? Record each order.
                            </p>
                        </div>
                        <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 lg:max-w-xs">
                            <Search size={18} className="shrink-0" />
                            <input
                                type="search"
                                maxLength={40}
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                inputMode="numeric"
                                placeholder="Search by Order #"
                                className="w-full min-w-0 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                                aria-label="Search by Order #"
                            />
                        </label>
                    </div>

                    {orders.data.length === 0 ? (
                        <div className="px-6 py-16 text-center">
                            {initialSearch ? (
                                <>
                                    <SearchX
                                        size={44}
                                        className="mx-auto text-slate-300"
                                    />
                                    <h3 className="mt-4 text-lg font-black text-slate-800">
                                        No waiting order matches #
                                        {initialSearch}
                                    </h3>
                                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                                        It may have fully arrived already. Check
                                        the Order # on the delivery papers.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <PackageCheck
                                        size={44}
                                        className="mx-auto text-emerald-300"
                                    />
                                    <h3 className="mt-4 text-lg font-black text-slate-800">
                                        Nothing is waiting for delivery
                                    </h3>
                                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                                        Every uploaded order has arrived or is
                                        completed. Upload new orders on Purchase
                                        Orders.
                                    </p>
                                </>
                            )}
                        </div>
                    ) : (
                        <>
                            <TableScroll stickyActions>
                                <table className="w-full min-w-225">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <TableHeading>Order #</TableHeading>
                                            <TableHeading>Waiting</TableHeading>
                                            <TableHeading>
                                                Received So Far
                                            </TableHeading>
                                            <TableHeading align="right">
                                                Still to Come
                                            </TableHeading>
                                            <TableHeading align="right">
                                                Actions
                                            </TableHeading>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orders.data.map((order) => (
                                            <tr
                                                key={order.id}
                                                className="border-t border-slate-100 align-top text-sm transition hover:bg-slate-50/70"
                                            >
                                                <td className="px-5 py-4">
                                                    <p className="flex flex-wrap items-center gap-2">
                                                        <span
                                                            className={cn(
                                                                'font-mono font-black',
                                                                order.order_number
                                                                    ? 'text-blue-700'
                                                                    : 'text-slate-400',
                                                            )}
                                                        >
                                                            {order.order_number
                                                                ? `#${order.order_number}`
                                                                : 'No order #'}
                                                        </span>
                                                        {order.category && (
                                                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-black text-blue-700">
                                                                {order.category}
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className="mt-0.5 text-xs text-slate-500">
                                                        Ordered{' '}
                                                        {formatDateOrdered(
                                                            order.date_ordered,
                                                        )}{' '}
                                                        · {order.items_count}{' '}
                                                        {order.items_count === 1
                                                            ? 'item'
                                                            : 'items'}
                                                    </p>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <p
                                                        className={cn(
                                                            'text-sm font-black whitespace-nowrap',
                                                            order.days_since_ordered >=
                                                                followUpDays
                                                                ? 'text-red-600'
                                                                : 'text-blue-700',
                                                        )}
                                                    >
                                                        {
                                                            order.days_since_ordered
                                                        }{' '}
                                                        {order.days_since_ordered ===
                                                        1
                                                            ? 'day'
                                                            : 'days'}
                                                        <span className="block text-xs font-bold text-slate-500">
                                                            since ordered
                                                        </span>
                                                    </p>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <DeliveryProgress
                                                        progress={order}
                                                    />
                                                </td>
                                                <td className="px-5 py-4 text-right text-base font-black text-slate-900">
                                                    {order.quantity_remaining.toLocaleString(
                                                        'en-PH',
                                                    )}
                                                    <span className="block text-xs font-normal text-slate-500">
                                                        as ordered
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setRecordingId(
                                                                    order.id,
                                                                )
                                                            }
                                                            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0D6EFD] px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700"
                                                        >
                                                            <Truck size={16} />
                                                            Record
                                                        </button>
                                                        <Link
                                                            href={PurchaseOrderController.index(
                                                                {
                                                                    query: {
                                                                        view: order.id,
                                                                    },
                                                                },
                                                            )}
                                                            className="inline-flex h-11 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700 transition hover:bg-blue-100"
                                                        >
                                                            <ExternalLink
                                                                size={15}
                                                            />
                                                            Open order
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </TableScroll>

                            <Pagination pagination={orders} itemName="orders" />
                        </>
                    )}
                </Panel>
            </div>

            <RecordDeliveryDialog
                purchaseOrderId={recordingId}
                onClose={() => setRecordingId(null)}
                onSaved={() => setRecordingId(null)}
            />
        </>
    );
}
