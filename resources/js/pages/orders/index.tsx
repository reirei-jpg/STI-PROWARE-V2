import { Head, router } from '@inertiajs/react';
import { Clock, Eye, Search, ShoppingBag, Unlock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import OrderController from '@/actions/App/Http/Controllers/OrderController';
import CancelOrderDialog from '@/components/cancel-order-dialog';
import OrderDetailsDialog from '@/components/order-details-dialog';
import { OrderStatusBadge } from '@/components/order-items';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import Panel, { TableHeading } from '@/components/panel';
import SlipScanBox from '@/components/slip-scan-box';
import { formatDateOrdered, formatDateTime, formatPeso } from '@/lib/format';
import { formatUnits } from '@/lib/units';
import { cn } from '@/lib/utils';
import type { Paginated, SpecialistOrderRow as SpecialistOrder } from '@/types';

type Show = 'placed' | 'ready' | 'picked_up' | 'cancelled' | 'all';

type PausedStudent = {
    id: number;
    name: string;
    email: string;
    paused_until: string;
};

const chips: { value: Show; label: string }[] = [
    { value: 'placed', label: 'New' },
    { value: 'ready', label: 'Ready for pickup' },
    { value: 'picked_up', label: 'Released' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'all', label: 'All' },
];

const descriptions: Record<Show, string> = {
    placed: 'Orders to prepare. The nearest pick-up date first.',
    ready: 'Waiting for the student to show the slip and pay. The nearest pick-up date first.',
    picked_up: 'Paid and handed over. Newest first.',
    cancelled: 'Their items are free to sell again. Newest first.',
    all: 'Every order, newest first.',
};

/**
 * The Specialist's Student Orders page. A student shows the order's
 * issuance slip: scan its QR (or type the order number) to open it, check
 * it, and release the items once paid. Below, every order in a table (by
 * status, with a search); View Details opens an order with its items, its
 * history and its steps (Ready for pickup, Release, Undo, Cancel). Here
 * too: how many days new orders hold their items, and students paused for
 * expired orders. Orders not released by their date expire by themselves.
 */
export default function OrdersIndex({
    orders,
    filters,
    counts,
    holdDays,
    pausedStudents,
}: {
    orders: Paginated<SpecialistOrder>;
    filters: { show: Show; search: string | null };
    counts: Record<Exclude<Show, 'all'>, number>;
    holdDays: number;
    pausedStudents: PausedStudent[];
}) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [viewingId, setViewingId] = useState<number | null>(null);
    const [cancelling, setCancelling] = useState<SpecialistOrder | null>(null);
    const firstRender = useRef(true);
    // The open order follows the list, so it updates after each step; once
    // it moves to another tab (e.g. released), the popup closes.
    const viewing = orders.data.find((order) => order.id === viewingId) ?? null;

    const showList = (show: Show, term: string) =>
        router.get(
            OrderController.index().url,
            {
                ...(show === 'placed' ? {} : { show }),
                ...(term.trim() === '' ? {} : { search: term.trim() }),
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );

    // Search as the Specialist types, after a short pause.
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;

            return;
        }

        const timer = window.setTimeout(
            () => showList(filters.show, search),
            400,
        );

        return () => window.clearTimeout(timer);
        // Only the typed search starts a new search.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    return (
        <>
            <Head title="Student Orders" />

            <div className="space-y-6">
                <PageHeader
                    title="Student Orders"
                    description="Orders students placed on the storefront. Scan the student's issuance slip to release the items once paid, or open any order below. Orders not released by their pick-up date expire, and their items are free to sell again."
                />

                <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
                    <SlipScanBox />
                    <HoldDaysSetting holdDays={holdDays} />
                </div>

                {pausedStudents.length > 0 && (
                    <PausedStudents students={pausedStudents} />
                )}

                <Panel>
                    <div className="space-y-4 border-b border-slate-100 px-6 py-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <h2 className="font-black text-slate-900">
                                    {chips.find(
                                        (chip) => chip.value === filters.show,
                                    )?.label ?? 'Orders'}
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    {descriptions[filters.show]}
                                </p>
                            </div>
                            <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 lg:max-w-sm">
                                <Search size={18} className="shrink-0" />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Search by order no. (PW-0042) or student"
                                    className="w-full min-w-0 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                                    aria-label="Search by order number or student name"
                                />
                            </label>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {chips.map((chip) => (
                                <button
                                    key={chip.value}
                                    type="button"
                                    onClick={() => showList(chip.value, search)}
                                    className={cn(
                                        'inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition',
                                        filters.show === chip.value
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                                    )}
                                >
                                    {chip.label}
                                    {chip.value !== 'all' && (
                                        <span
                                            className={cn(
                                                'rounded-full px-1.5 text-[11px] font-black',
                                                filters.show === chip.value
                                                    ? 'bg-white/25'
                                                    : 'bg-white',
                                            )}
                                        >
                                            {counts[chip.value].toLocaleString(
                                                'en-PH',
                                            )}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {orders.data.length === 0 ? (
                        <div className="px-6 py-16 text-center">
                            <ShoppingBag
                                size={44}
                                className="mx-auto text-slate-300"
                            />
                            <h3 className="mt-4 text-lg font-black text-slate-800">
                                {filters.search
                                    ? 'No order matches your search'
                                    : 'No orders here'}
                            </h3>
                            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                                Orders appear here when students place them from
                                their cart. You are also told in the bell.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-225">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <TableHeading>Order #</TableHeading>
                                            <TableHeading>Student</TableHeading>
                                            <TableHeading>Items</TableHeading>
                                            <TableHeading align="right">
                                                Total
                                            </TableHeading>
                                            <TableHeading>
                                                {filters.show === 'picked_up'
                                                    ? 'Released'
                                                    : filters.show ===
                                                        'cancelled'
                                                      ? 'Cancelled'
                                                      : 'Pick up by'}
                                            </TableHeading>
                                            <TableHeading>Status</TableHeading>
                                            <TableHeading align="right">
                                                Actions
                                            </TableHeading>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orders.data.map((order) => (
                                            <OrderTableRow
                                                key={order.id}
                                                order={order}
                                                onView={() =>
                                                    setViewingId(order.id)
                                                }
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <Pagination pagination={orders} itemName="orders" />
                        </>
                    )}
                </Panel>
            </div>

            <OrderDetailsDialog
                order={viewing}
                onClose={() => setViewingId(null)}
                onCancel={(order) => {
                    setViewingId(null);
                    setCancelling(order);
                }}
            />

            <CancelOrderDialog
                order={cancelling}
                onClose={() => setCancelling(null)}
            />
        </>
    );
}

/** One order: number, student, first item, total, its date, status, View Details. */
function OrderTableRow({
    order,
    onView,
}: {
    order: SpecialistOrder;
    onView: () => void;
}) {
    const [first, ...rest] = order.items;

    return (
        <tr className="border-t border-slate-100 transition hover:bg-slate-50/70">
            <td className="px-5 py-4">
                <p className="font-mono text-sm font-black text-blue-700">
                    {order.number}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                    {formatDateTime(order.placed_at)}
                </p>
            </td>
            <td className="px-5 py-4">
                <p className="text-sm font-bold text-slate-800">
                    {order.student_name}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                    {order.student_section ?? '—'}
                </p>
            </td>
            <td className="px-5 py-4">
                {first && (
                    <p className="max-w-64 truncate text-sm text-slate-800">
                        {first.product_name}
                        {first.variant_label && (
                            <span className="text-slate-500">
                                {' '}
                                · {first.variant_label}
                            </span>
                        )}
                    </p>
                )}
                <p className="mt-1 text-xs text-slate-500">
                    {rest.length > 0
                        ? `+ ${rest.length} more ${rest.length === 1 ? 'item' : 'items'}`
                        : first && formatUnits(first.quantity, first.unit_name)}
                </p>
            </td>
            <td className="px-5 py-4 text-right text-base font-black text-slate-900">
                {formatPeso(order.total_centavos)}
            </td>
            <td className="px-5 py-4">
                <OrderDate order={order} />
            </td>
            <td className="px-5 py-4">
                <OrderStatusBadge order={order} />
            </td>
            <td className="px-5 py-4 text-right">
                <button
                    type="button"
                    onClick={onView}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 text-sm font-black whitespace-nowrap text-blue-700 transition hover:bg-blue-100"
                >
                    <Eye size={15} />
                    View Details
                </button>
            </td>
        </tr>
    );
}

/**
 * Open orders: the pick-up date in V1's date colors (red passed, amber
 * today, blue later). Others: when they were released or cancelled.
 */
function OrderDate({ order }: { order: SpecialistOrder }) {
    if (order.status === 'placed' || order.status === 'ready') {
        const due = new Date(`${order.pick_up_by}T00:00:00`).getTime();
        const now = new Date();
        const today = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
        ).getTime();

        return (
            <p
                className={cn(
                    'text-sm font-black whitespace-nowrap',
                    due < today
                        ? 'text-red-600'
                        : due === today
                          ? 'text-amber-600'
                          : 'text-blue-700',
                )}
            >
                {due === today ? 'Today' : formatDateOrdered(order.pick_up_by)}
                {due < today && (
                    <span className="block text-xs font-bold">Date passed</span>
                )}
            </p>
        );
    }

    if (order.status === 'picked_up') {
        return (
            <p className="text-sm whitespace-nowrap text-slate-700">
                {formatDateOrdered(order.picked_up_at)}
                {order.handled_by && (
                    <span className="block text-xs text-slate-500">
                        by {order.handled_by}
                    </span>
                )}
            </p>
        );
    }

    return (
        <p className="text-sm whitespace-nowrap text-slate-700">
            {formatDateOrdered(order.cancelled_at)}
            <span className="block text-xs text-slate-500">
                {order.expired ? 'Expired' : (order.handled_by ?? '')}
            </span>
        </p>
    );
}

/**
 * How many days new orders hold their items before they expire (1 to 3).
 * Orders already placed keep their pick-up date.
 */
function HoldDaysSetting({ holdDays }: { holdDays: number }) {
    const [saving, setSaving] = useState<number | null>(null);

    const choose = (days: number) => {
        setSaving(days);
        router.patch(
            OrderController.holdDays().url,
            { hold_days: days },
            { preserveScroll: true, onFinish: () => setSaving(null) },
        );
    };

    return (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-black text-slate-900">
                <Clock size={20} className="text-amber-600" />
                Hold items for
            </h2>
            <p className="mt-1 text-sm text-slate-500">
                Days a new order keeps its items for the student before it
                expires.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
                {[1, 2, 3].map((days) => (
                    <button
                        key={days}
                        type="button"
                        disabled={saving !== null || days === holdDays}
                        onClick={() => choose(days)}
                        className={cn(
                            'h-11 rounded-xl text-sm font-black transition',
                            days === holdDays
                                ? 'bg-blue-600 text-white'
                                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60',
                        )}
                    >
                        {days} {days === 1 ? 'day' : 'days'}
                    </button>
                ))}
            </div>
        </section>
    );
}

/**
 * Students whose orders expired too often, who cannot order until the date
 * shown, with Lift pause for a mistake or a good reason.
 */
function PausedStudents({ students }: { students: PausedStudent[] }) {
    const [lifting, setLifting] = useState<number | null>(null);

    const lift = (student: PausedStudent) => {
        if (
            window.confirm(
                `Let ${student.name} order again before ${formatDateOrdered(student.paused_until)}?`,
            )
        ) {
            setLifting(student.id);
            router.post(
                OrderController.liftPause(student.id).url,
                {},
                { preserveScroll: true, onFinish: () => setLifting(null) },
            );
        }
    };

    return (
        <Panel
            title="Students who cannot order now"
            description="Their orders expired 3 times in 30 days without being picked up, so ordering is paused for 7 days."
            className="border-l-4 border-l-amber-500"
        >
            <ul className="divide-y divide-slate-100">
                {students.map((student) => (
                    <li
                        key={student.id}
                        className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                        <div>
                            <p className="font-black text-slate-900">
                                {student.name}
                            </p>
                            <p className="text-sm text-slate-500">
                                {student.email} · Paused until{' '}
                                <strong className="text-amber-700">
                                    {formatDateOrdered(student.paused_until)}
                                </strong>
                            </p>
                        </div>
                        <button
                            type="button"
                            disabled={lifting === student.id}
                            onClick={() => lift(student)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                        >
                            <Unlock size={16} />
                            Lift pause
                        </button>
                    </li>
                ))}
            </ul>
        </Panel>
    );
}
