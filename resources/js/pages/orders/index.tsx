import { Head, Link, router } from '@inertiajs/react';
import {
    Banknote,
    CheckCircle2,
    Clock,
    PackageCheck,
    QrCode,
    Search,
    ShoppingBag,
    Undo2,
    Unlock,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import OrderController from '@/actions/App/Http/Controllers/OrderController';
import CancelOrderDialog from '@/components/cancel-order-dialog';
import OrderItems, { OrderStatusBadge } from '@/components/order-items';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import Panel from '@/components/panel';
import SlipScanBox from '@/components/slip-scan-box';
import { formatDateOrdered, formatDateTime, formatPeso } from '@/lib/format';
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
 * it, and release the items once paid. Here too: prepare new orders and
 * mark them Ready for pickup (the student is told), set how many days new
 * orders hold their items, and let students paused for expired orders
 * order again. Orders not released by their date expire by themselves.
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
    const [cancelling, setCancelling] = useState<SpecialistOrder | null>(null);
    const [busy, setBusy] = useState<number | null>(null);
    const firstRender = useRef(true);

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

    const act = (
        url: string,
        order: SpecialistOrder,
        data: Record<string, boolean> = {},
    ) => {
        setBusy(order.id);
        router.post(url, data, {
            preserveScroll: true,
            onFinish: () => setBusy(null),
        });
    };

    // The items leave the shelf only when the student has paid.
    const release = (order: SpecialistOrder) => {
        if (
            window.confirm(
                `Has ${order.student_name} paid ${formatPeso(order.total_centavos)} for ${order.number}?`,
            )
        ) {
            act(OrderController.release(order.id).url, order, { paid: true });
        }
    };

    return (
        <>
            <Head title="Student Orders" />

            <div className="space-y-7">
                <PageHeader
                    title="Student Orders"
                    description="Orders students placed on the storefront. Prepare them and mark them Ready for pickup. When the student shows the issuance slip, scan it and release the items once paid. Orders not released by their pick-up date expire, and their items are free to sell again."
                />

                <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
                    <SlipScanBox />
                    <HoldDaysSetting holdDays={holdDays} />
                </div>

                {pausedStudents.length > 0 && (
                    <PausedStudents students={pausedStudents} />
                )}

                <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
                    <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 lg:max-w-sm">
                        <Search size={18} className="shrink-0" />
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search by order no. (PW-0042) or student"
                            className="w-full min-w-0 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                            aria-label="Search by order number or student name"
                        />
                    </label>

                    <div className="flex flex-wrap items-center gap-2">
                        {chips.map((chip) => (
                            <button
                                key={chip.value}
                                type="button"
                                onClick={() => showList(chip.value, search)}
                                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                                    filters.show === chip.value
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {chip.label}
                                {chip.value !== 'all' && (
                                    <span
                                        className={`rounded-full px-1.5 text-[11px] font-black ${
                                            filters.show === chip.value
                                                ? 'bg-white/25'
                                                : 'bg-white'
                                        }`}
                                    >
                                        {counts[chip.value].toLocaleString(
                                            'en-PH',
                                        )}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </section>

                <Panel
                    title={
                        chips.find((chip) => chip.value === filters.show)
                            ?.label ?? 'Orders'
                    }
                    description={descriptions[filters.show]}
                >
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
                            <ul className="divide-y divide-slate-100">
                                {orders.data.map((order) => (
                                    <li
                                        key={order.id}
                                        className="grid gap-4 p-5 lg:grid-cols-[14rem_1fr_15rem]"
                                    >
                                        <div className="space-y-1">
                                            <p className="text-lg font-black text-slate-900">
                                                {order.number}
                                            </p>
                                            <p className="text-sm font-bold text-slate-700">
                                                {order.student_name}
                                                {order.student_section && (
                                                    <span className="font-normal text-slate-500">
                                                        {' '}
                                                        ·{' '}
                                                        {order.student_section}
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                Placed{' '}
                                                {formatDateTime(
                                                    order.placed_at,
                                                )}
                                            </p>
                                            <div className="pt-1">
                                                <OrderStatusBadge
                                                    order={order}
                                                />
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-slate-100 bg-slate-50/60">
                                            <OrderItems order={order} />
                                        </div>

                                        <div className="space-y-2 text-sm">
                                            <OrderWhen order={order} />

                                            <Link
                                                href={OrderController.slip({
                                                    query: {
                                                        code:
                                                            order.slip_code ??
                                                            order.number,
                                                    },
                                                })}
                                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 font-black text-blue-700 transition hover:bg-blue-100"
                                            >
                                                <QrCode size={16} />
                                                Open slip
                                            </Link>

                                            {order.status === 'placed' && (
                                                <button
                                                    type="button"
                                                    disabled={busy === order.id}
                                                    onClick={() =>
                                                        act(
                                                            OrderController.ready(
                                                                order.id,
                                                            ).url,
                                                            order,
                                                        )
                                                    }
                                                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0D6EFD] px-4 py-2.5 font-black text-white transition hover:bg-blue-700 disabled:opacity-60"
                                                >
                                                    <PackageCheck size={16} />
                                                    Ready for pickup
                                                </button>
                                            )}

                                            {(order.status === 'placed' ||
                                                order.status === 'ready') && (
                                                <>
                                                    <button
                                                        type="button"
                                                        disabled={
                                                            busy === order.id
                                                        }
                                                        onClick={() =>
                                                            release(order)
                                                        }
                                                        className={cn(
                                                            'inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-black transition disabled:opacity-60',
                                                            order.status ===
                                                                'ready'
                                                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                                                : 'border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50',
                                                        )}
                                                    >
                                                        <Banknote size={16} />
                                                        Release (paid)
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setCancelling(order)
                                                        }
                                                        className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2 font-black text-red-700 transition hover:bg-red-100"
                                                    >
                                                        Cancel order
                                                    </button>
                                                </>
                                            )}

                                            {order.can_undo_release && (
                                                <button
                                                    type="button"
                                                    disabled={busy === order.id}
                                                    onClick={() =>
                                                        act(
                                                            OrderController.undoRelease(
                                                                order.id,
                                                            ).url,
                                                            order,
                                                        )
                                                    }
                                                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                                                    title="Released by mistake? Put it back to Ready for pickup (today only)."
                                                >
                                                    <Undo2 size={16} />
                                                    Undo release
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            <Pagination pagination={orders} itemName="orders" />
                        </>
                    )}
                </Panel>
            </div>

            <CancelOrderDialog
                order={cancelling}
                onClose={() => setCancelling(null)}
            />
        </>
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

function OrderWhen({ order }: { order: SpecialistOrder }) {
    if (order.status === 'placed' || order.status === 'ready') {
        return (
            <p className="text-slate-600">
                Pick up by{' '}
                <strong className="text-slate-900">
                    {formatDateOrdered(order.pick_up_by)}
                </strong>
                {order.ready_at && (
                    <span className="block text-xs text-slate-500">
                        Ready since {formatDateTime(order.ready_at)}
                    </span>
                )}
            </p>
        );
    }

    if (order.status === 'picked_up') {
        return (
            <p className="flex items-start gap-1.5 text-slate-600">
                <CheckCircle2
                    size={16}
                    className="mt-0.5 shrink-0 text-emerald-600"
                />
                <span>
                    Released {formatDateTime(order.picked_up_at)}
                    {order.handled_by && (
                        <span className="block text-xs text-slate-500">
                            by {order.handled_by}
                        </span>
                    )}
                </span>
            </p>
        );
    }

    return (
        <p className="text-slate-600">
            {order.expired
                ? `Expired: not released by ${formatDateOrdered(order.pick_up_by)}`
                : `Cancelled ${formatDateTime(order.cancelled_at)}`}
            {!order.expired && order.cancel_reason && (
                <span className="block text-xs text-slate-500">
                    {order.cancel_reason}
                </span>
            )}
            {order.handled_by && (
                <span className="block text-xs text-slate-500">
                    by {order.handled_by}
                </span>
            )}
        </p>
    );
}
