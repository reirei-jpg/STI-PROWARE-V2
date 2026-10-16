import { Link, router } from '@inertiajs/react';
import {
    ArrowRight,
    CheckCircle2,
    Eye,
    Hourglass,
    LoaderCircle,
    PackageCheck,
    QrCode,
    ShoppingBag,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import OrderController from '@/actions/App/Http/Controllers/OrderController';
import CancelOrderDialog from '@/components/cancel-order-dialog';
import OrderDetailsDialog from '@/components/order-details-dialog';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDateOrdered, formatPeso } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { SpecialistOrderRow } from '@/types';

export type OrderCardKey = 'new' | 'ready' | 'last_day' | 'released_today';

export type OrderCardsData = Record<
    OrderCardKey,
    { count: number; orders: SpecialistOrderRow[] }
>;

type Card = {
    key: OrderCardKey;
    title: string;
    icon: LucideIcon;
    /** What the number means: "to prepare". */
    detail: (count: number) => string;
    popupTitle: string;
    emptyText: string;
    iconClassName: string;
    hoverClassName: string;
    /** Student Orders opened on the matching tab. */
    listShow: 'placed' | 'ready' | 'picked_up' | 'all';
};

/** The four cards, in V1's colors: amber waiting, blue in progress, red last day, green done. */
const cards: Card[] = [
    {
        key: 'new',
        title: 'New',
        icon: ShoppingBag,
        detail: () => 'to prepare',
        popupTitle: 'New orders to prepare',
        emptyText: 'No new orders. You are notified when one comes in.',
        iconClassName: 'bg-amber-50 text-amber-600',
        hoverClassName: 'hover:border-amber-300',
        listShow: 'placed',
    },
    {
        key: 'ready',
        title: 'Ready for pickup',
        icon: PackageCheck,
        detail: () => 'waiting for the student',
        popupTitle: 'Ready for pickup',
        emptyText: 'No orders are waiting for pickup.',
        iconClassName: 'bg-blue-50 text-blue-600',
        hoverClassName: 'hover:border-blue-300',
        listShow: 'ready',
    },
    {
        key: 'last_day',
        title: 'Last day today',
        icon: Hourglass,
        detail: () => 'cancels tonight if not picked up',
        popupTitle: 'Last day to pick up',
        emptyText: 'No order is on its last day.',
        iconClassName: 'bg-red-50 text-red-600',
        hoverClassName: 'hover:border-red-300',
        listShow: 'all',
    },
    {
        key: 'released_today',
        title: 'Released today',
        icon: CheckCircle2,
        detail: () => 'paid and handed over',
        popupTitle: 'Released today',
        emptyText: 'Nothing released yet today.',
        iconClassName: 'bg-emerald-50 text-emerald-600',
        hoverClassName: 'hover:border-emerald-300',
        listShow: 'picked_up',
    },
];

/**
 * The student order cards on the Specialist's dashboard: New, Ready for
 * pickup, Last day today and Released today. A card opens a popup with its
 * orders and the button for that stage (Ready for pickup, Open slip, View).
 * When the dashboard refreshes and a new order has come in, a small
 * "New order" popup says so.
 */
export default function OrderCards({ data }: { data: OrderCardsData }) {
    const [openKey, setOpenKey] = useState<OrderCardKey | null>(null);
    const [viewingId, setViewingId] = useState<number | null>(null);
    const [cancelling, setCancelling] = useState<SpecialistOrderRow | null>(
        null,
    );
    const newOrder = useNewOrderNotice(data.new.orders);

    // The order shown in View, wherever it is now (it moves between cards).
    const viewing =
        viewingId === null
            ? null
            : (Object.values(data)
                  .flatMap((card) => card.orders)
                  .find((order) => order.id === viewingId) ?? null);

    const openCard = cards.find((card) => card.key === openKey) ?? null;

    return (
        <>
            <section className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-sm font-black tracking-wide text-slate-700 uppercase">
                        Student orders
                    </h2>
                    <p className="text-sm text-slate-500">
                        Click a card to see its orders. Updates by itself.
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {cards.map((card) => (
                        <OrderCard
                            key={card.key}
                            card={card}
                            count={data[card.key].count}
                            onOpen={() => setOpenKey(card.key)}
                        />
                    ))}
                </div>
            </section>

            <Dialog
                open={openCard !== null}
                onOpenChange={(open) => !open && setOpenKey(null)}
            >
                <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-2xl [&>button:last-child]:hidden">
                    {openCard && (
                        <OrderList
                            card={openCard}
                            count={data[openCard.key].count}
                            orders={data[openCard.key].orders}
                            onView={setViewingId}
                        />
                    )}
                </DialogContent>
            </Dialog>

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

            {newOrder.order && (
                <div
                    role="status"
                    className="fixed right-5 bottom-5 z-50 flex w-[22rem] max-w-[calc(100vw-2.5rem)] items-start gap-3 rounded-2xl border border-amber-200 bg-white p-4 shadow-xl"
                >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                        <ShoppingBag size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="font-black text-slate-900">
                            New order {newOrder.order.number}
                        </p>
                        <p className="mt-0.5 truncate text-sm text-slate-500">
                            {newOrder.order.student_name} ·{' '}
                            {newOrder.order.items.length}{' '}
                            {newOrder.order.items.length === 1
                                ? 'item'
                                : 'items'}{' '}
                            · {formatPeso(newOrder.order.total_centavos)}
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                setViewingId(newOrder.order?.id ?? null);
                                newOrder.dismiss();
                            }}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-[#0D6EFD] px-3 py-2 text-sm font-black text-white transition hover:bg-blue-700"
                        >
                            <Eye size={15} />
                            Open order
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={newOrder.dismiss}
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Close"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}
        </>
    );
}

/**
 * The newest order that came in since the dashboard opened, for the "New
 * order" popup; it hides by itself after 12 seconds.
 */
function useNewOrderNotice(orders: SpecialistOrderRow[]) {
    const seen = useRef<Set<number> | null>(null);
    const [order, setOrder] = useState<SpecialistOrderRow | null>(null);

    useEffect(() => {
        // The orders already there when the dashboard opened are not new.
        if (seen.current === null) {
            seen.current = new Set(orders.map((item) => item.id));

            return;
        }

        const arrived = orders.filter((item) => !seen.current?.has(item.id));
        arrived.forEach((item) => seen.current?.add(item.id));

        if (arrived.length > 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- showing the popup is the effect's job
            setOrder(
                arrived.reduce((newest, item) =>
                    item.id > newest.id ? item : newest,
                ),
            );
        }
    }, [orders]);

    useEffect(() => {
        if (order === null) {
            return;
        }

        const timer = window.setTimeout(() => setOrder(null), 12000);

        return () => window.clearTimeout(timer);
    }, [order]);

    return { order, dismiss: () => setOrder(null) };
}

function OrderCard({
    card,
    count,
    onOpen,
}: {
    card: Card;
    count: number;
    onOpen: () => void;
}) {
    const Icon = card.icon;

    return (
        <button
            type="button"
            onClick={onOpen}
            className={cn(
                'group flex flex-col rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
                card.hoverClassName,
            )}
        >
            <span className="flex items-center justify-between gap-3">
                <span
                    className={cn(
                        'flex size-11 items-center justify-center rounded-2xl',
                        card.iconClassName,
                    )}
                >
                    <Icon size={21} />
                </span>
                <span className="flex items-center gap-1 text-sm font-black text-blue-700 opacity-0 transition group-hover:opacity-100">
                    See all
                    <ArrowRight size={15} />
                </span>
            </span>
            <span className="mt-4 text-xs font-black tracking-wide text-slate-500 uppercase">
                {card.title}
            </span>
            <span className="mt-0.5 text-3xl font-black tracking-tight text-slate-900">
                {count.toLocaleString('en-PH')}
            </span>
            <span className="mt-1 text-sm text-slate-500">
                {card.detail(count)}
            </span>
        </button>
    );
}

/** One card's popup: its orders, each with the button for that stage. */
function OrderList({
    card,
    count,
    orders,
    onView,
}: {
    card: Card;
    count: number;
    orders: SpecialistOrderRow[];
    onView: (orderId: number) => void;
}) {
    const Icon = card.icon;
    const [readying, setReadying] = useState<number | null>(null);

    const markReady = (order: SpecialistOrderRow) => {
        setReadying(order.id);
        router.post(
            OrderController.ready(order.id).url,
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onFinish: () => setReadying(null),
            },
        );
    };

    return (
        <>
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                <div className="flex items-start gap-3">
                    <span
                        className={cn(
                            'flex size-11 shrink-0 items-center justify-center rounded-2xl',
                            card.iconClassName,
                        )}
                    >
                        <Icon size={21} />
                    </span>
                    <div>
                        <DialogTitle className="text-lg font-black text-slate-900">
                            {card.popupTitle}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-slate-500">
                            {count} {count === 1 ? 'order' : 'orders'}
                            {card.key === 'new' || card.key === 'ready'
                                ? ', the nearest pick-up date first'
                                : ''}
                        </DialogDescription>
                    </div>
                </div>
                <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                    <X size={20} />
                    <span className="sr-only">Close</span>
                </DialogClose>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
                {orders.length === 0 ? (
                    <p className="px-6 py-12 text-center text-sm text-slate-500">
                        {card.emptyText}
                    </p>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {orders.map((order) => (
                            <li
                                key={order.id}
                                className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="min-w-0">
                                    <p className="font-black text-slate-900">
                                        <span className="font-mono text-blue-700">
                                            {order.number}
                                        </span>{' '}
                                        {order.student_name}
                                        {order.student_section && (
                                            <span className="font-semibold text-slate-500">
                                                {' '}
                                                · {order.student_section}
                                            </span>
                                        )}
                                    </p>
                                    <p className="mt-0.5 text-sm text-slate-500">
                                        {order.items.length}{' '}
                                        {order.items.length === 1
                                            ? 'item'
                                            : 'items'}{' '}
                                        · {formatPeso(order.total_centavos)} ·{' '}
                                        {card.key === 'released_today'
                                            ? `released${order.handled_by ? ` by ${order.handled_by}` : ''}`
                                            : `pick up by ${formatDateOrdered(order.pick_up_by)}`}
                                        {card.key === 'last_day' &&
                                            ` · ${order.status_label}`}
                                    </p>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    {card.key === 'new' && (
                                        <button
                                            type="button"
                                            disabled={readying !== null}
                                            onClick={() => markReady(order)}
                                            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0D6EFD] px-3.5 text-sm font-black whitespace-nowrap text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
                                        >
                                            {readying === order.id ? (
                                                <LoaderCircle
                                                    size={15}
                                                    className="animate-spin"
                                                />
                                            ) : (
                                                <PackageCheck size={15} />
                                            )}
                                            Ready for pickup
                                        </button>
                                    )}
                                    {(card.key === 'ready' ||
                                        card.key === 'last_day') && (
                                        <Link
                                            href={OrderController.slip({
                                                query: {
                                                    code: order.number ?? '',
                                                },
                                            })}
                                            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0D6EFD] px-3.5 text-sm font-black whitespace-nowrap text-white shadow-sm transition hover:bg-blue-700"
                                        >
                                            <QrCode size={15} />
                                            Open slip
                                        </Link>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => onView(order.id)}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 text-sm font-black whitespace-nowrap text-blue-700 transition hover:bg-blue-100"
                                    >
                                        <Eye size={15} />
                                        View
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3">
                <Link
                    href={OrderController.index({
                        query: { show: card.listShow },
                    })}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-blue-700 shadow-sm transition hover:bg-blue-50"
                >
                    {count > orders.length
                        ? `See all ${count} in Student Orders`
                        : 'Open Student Orders'}
                    <ArrowRight size={15} />
                </Link>
                <DialogClose className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50">
                    Close
                </DialogClose>
            </div>
        </>
    );
}
