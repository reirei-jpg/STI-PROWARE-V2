import { Link, router, useForm } from '@inertiajs/react';
import {
    ArrowRight,
    CalendarClock,
    ClipboardList,
    Crown,
    LoaderCircle,
    Megaphone,
    TrendingUp,
    TriangleAlert,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import PreorderController from '@/actions/App/Http/Controllers/PreorderController';
import ProductAnnouncementController from '@/actions/App/Http/Controllers/ProductAnnouncementController';
import ProductStockController from '@/actions/App/Http/Controllers/ProductStockController';
import ReadyToOrderController from '@/actions/App/Http/Controllers/ReadyToOrderController';
import SalesReportController from '@/actions/App/Http/Controllers/SalesReportController';
import ConfirmDialog from '@/components/confirm-dialog';
import PreorderCloseDateDialog from '@/components/preorder-close-date-dialog';
import type { CloseDateTarget } from '@/components/preorder-close-date-dialog';
import InputError from '@/components/input-error';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDateOrdered, formatDateTime, formatPeso } from '@/lib/format';
import { formatUnits } from '@/lib/units';
import { cn } from '@/lib/utils';

export type StockCardsData = {
    low_stock: {
        count: number;
        items: {
            product_id: number;
            product_name: string;
            pieces_left: number;
            out_of_stock: boolean;
            warn_at: number;
        }[];
    };
    best_sellers: {
        /** The first day of this month. */
        from: string;
        items: { product_id: number; product_name: string; pieces: number }[];
    };
    ready_to_order: {
        /** The Maintenance number of preorders before ordering. */
        threshold: number;
        count: number;
        items: {
            product_id: number;
            product_name: string;
            pieces: number;
            preorders_close_on: string | null;
        }[];
    };
    top_buyers: {
        /** The first day of the last 3 months. */
        from: string;
        /** Everyone who bought in that time. */
        buyers_count: number;
        items: {
            user_id: number;
            name: string;
            email: string;
            orders: number;
            pieces: number;
            spent_centavos: number;
            last_bought_at: string | null;
        }[];
        /** How many of the top buyers can be told: 10, 20 or 50. */
        sizes: number[];
        /** Products in stock to announce, the latest to arrive first. */
        products: {
            product_id: number;
            product_name: string;
            arrived_on: string | null;
            price_from_centavos: number | null;
            price_to_centavos: number | null;
            announced_at: string | null;
        }[];
        last: {
            product_name: string;
            top: number;
            recipients: number;
            note: string | null;
            sent_at: string | null;
            sent_by: string | null;
        } | null;
    };
    /** Items with unpaid preorders and no payment dates yet. */
    preorders_to_set_up: {
        count: number;
        items: {
            product_id: number;
            product_name: string;
            /** A Coming Soon item, else a sold-out size waiting for restock. */
            coming_soon: boolean;
            buyers: number;
            pieces: number;
            preorders_close_on: string | null;
            expected_arrival_from: string | null;
        }[];
        today: string;
    };
};

type CardKey =
    | 'low_stock'
    | 'best_sellers'
    | 'ready_to_order'
    | 'top_buyers'
    | 'set_up';

/**
 * The stock cards on the Specialist's dashboard: Low stock, Best sellers
 * this month, and Ready to order (Coming Soon items whose preorders reached
 * the Maintenance number), and Top buyers. A card opens its list; on Ready
 * to order the Specialist chooses Create PO or Leave it for each item; on
 * Top buyers they can tell the top buyers about a product in stock.
 */
export default function StockCards({ data }: { data: StockCardsData }) {
    const [open, setOpen] = useState<CardKey | null>(null);
    const top = data.best_sellers.items[0];
    const topBuyer = data.top_buyers.items[0];

    return (
        <>
            <section className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-sm font-black tracking-wide text-slate-700 uppercase">
                        Stock
                    </h2>
                    <p className="text-sm text-slate-500">
                        Click a card to see its items.
                    </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <Card
                        icon={TriangleAlert}
                        iconClassName="bg-red-50 text-red-600"
                        title="Low stock"
                        value={data.low_stock.count.toLocaleString('en-PH')}
                        detail={
                            data.low_stock.count === 1
                                ? 'item low or out of stock'
                                : 'items low or out of stock'
                        }
                        onOpen={() => setOpen('low_stock')}
                    />
                    <Card
                        icon={TrendingUp}
                        iconClassName="bg-emerald-50 text-emerald-600"
                        title="Best seller this month"
                        value={top ? top.product_name : 'None yet'}
                        small
                        detail={
                            top
                                ? `${formatUnits(top.pieces, 'Piece')} sold`
                                : 'Nothing released this month yet'
                        }
                        onOpen={() => setOpen('best_sellers')}
                    />
                    <Card
                        icon={ClipboardList}
                        iconClassName="bg-amber-50 text-amber-600"
                        title="Ready to order"
                        value={data.ready_to_order.count.toLocaleString(
                            'en-PH',
                        )}
                        detail={`with ${data.ready_to_order.threshold.toLocaleString('en-PH')}+ pieces preordered`}
                        onOpen={() => setOpen('ready_to_order')}
                    />
                    <Card
                        icon={Crown}
                        iconClassName="bg-blue-50 text-blue-600"
                        title="Top buyer"
                        value={topBuyer ? topBuyer.name : 'None yet'}
                        small
                        detail={
                            topBuyer
                                ? `${formatPeso(topBuyer.spent_centavos)} in the last 3 months`
                                : 'No released orders in the last 3 months'
                        }
                        onOpen={() => setOpen('top_buyers')}
                    />
                    <Card
                        icon={CalendarClock}
                        iconClassName="bg-amber-50 text-amber-600"
                        title="Preorders to set up"
                        value={data.preorders_to_set_up.count.toLocaleString(
                            'en-PH',
                        )}
                        detail={
                            data.preorders_to_set_up.count === 1
                                ? 'item needs payment dates'
                                : 'items need payment dates'
                        }
                        onOpen={() => setOpen('set_up')}
                    />{' '}
                </div>
            </section>

            <Dialog
                open={open !== null}
                onOpenChange={(isOpen) => !isOpen && setOpen(null)}
            >
                <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-2xl [&>button:last-child]:hidden">
                    {open === 'low_stock' && <LowStockList data={data} />}
                    {open === 'best_sellers' && <BestSellerList data={data} />}
                    {open === 'ready_to_order' && (
                        <ReadyToOrderList data={data} />
                    )}
                    {open === 'set_up' && <SetUpList data={data} />}
                    {open === 'top_buyers' && (
                        <TopBuyersList
                            data={data}
                            onSent={() => setOpen(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

function Card({
    icon: Icon,
    iconClassName,
    title,
    value,
    detail,
    small = false,
    onOpen,
}: {
    icon: LucideIcon;
    iconClassName: string;
    title: string;
    value: string;
    detail: string;
    /** A name instead of a number. */
    small?: boolean;
    onOpen: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onOpen}
            className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
        >
            <span className="flex items-center justify-between gap-3">
                <span
                    className={cn(
                        'flex size-11 items-center justify-center rounded-2xl',
                        iconClassName,
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
                {title}
            </span>
            <span
                className={cn(
                    'mt-0.5 font-black tracking-tight text-slate-900',
                    small ? 'truncate text-xl' : 'text-3xl',
                )}
            >
                {value}
            </span>
            <span className="mt-1 text-sm text-slate-500">{detail}</span>
        </button>
    );
}

function ListHeader({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div>
                <DialogTitle className="text-lg font-black text-slate-900">
                    {title}
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-500">
                    {description}
                </DialogDescription>
            </div>
            <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                <X size={20} />
                <span className="sr-only">Close</span>
            </DialogClose>
        </div>
    );
}

function ListFooter({ children }: { children: ReactNode }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3">
            {children}
            <DialogClose className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50">
                Close
            </DialogClose>
        </div>
    );
}

const footerLink =
    'inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-blue-700 shadow-sm transition hover:bg-blue-50';

function LowStockList({ data }: { data: StockCardsData }) {
    const { count, items } = data.low_stock;

    return (
        <>
            <ListHeader
                title="Low stock"
                description={`${count} ${count === 1 ? 'item' : 'items'}, the emptiest first. Order more in the eStore.`}
            />
            <div className="min-h-0 flex-1 overflow-y-auto">
                {items.length === 0 ? (
                    <p className="px-6 py-12 text-center text-sm text-slate-500">
                        Nothing is low on stock.
                    </p>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {items.map((item) => (
                            <li
                                key={item.product_id}
                                className="flex items-center justify-between gap-3 px-6 py-3.5"
                            >
                                <div className="min-w-0">
                                    <p className="truncate font-black text-slate-900">
                                        {item.product_name}
                                    </p>
                                    <p
                                        className={cn(
                                            'text-sm',
                                            item.out_of_stock
                                                ? 'font-bold text-red-600'
                                                : 'text-amber-700',
                                        )}
                                    >
                                        {item.out_of_stock
                                            ? 'Out of stock'
                                            : `${formatUnits(item.pieces_left, 'Piece')} left · warned at ${formatUnits(item.warn_at, 'Piece')}`}
                                    </p>
                                </div>
                                <Link
                                    href={ProductStockController.index(
                                        item.product_id,
                                    )}
                                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-black text-blue-700 transition hover:bg-blue-100"
                                >
                                    See stock
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <ListFooter>
                <span className="text-sm text-slate-500">
                    {count > items.length
                        ? `Showing ${items.length} of ${count}.`
                        : ''}
                </span>
            </ListFooter>
        </>
    );
}

function BestSellerList({ data }: { data: StockCardsData }) {
    const { items, from } = data.best_sellers;

    return (
        <>
            <ListHeader
                title="Best sellers this month"
                description={`By pieces released since ${formatDateOrdered(from)}.`}
            />
            <div className="min-h-0 flex-1 overflow-y-auto">
                {items.length === 0 ? (
                    <p className="px-6 py-12 text-center text-sm text-slate-500">
                        Nothing has been released this month yet.
                    </p>
                ) : (
                    <ol className="divide-y divide-slate-100">
                        {items.map((item, index) => (
                            <li
                                key={item.product_id}
                                className="flex items-center gap-4 px-6 py-3.5"
                            >
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-black text-emerald-700">
                                    {index + 1}
                                </span>
                                <span className="min-w-0 flex-1 truncate font-black text-slate-900">
                                    {item.product_name}
                                </span>
                                <span className="shrink-0 text-sm font-bold text-slate-600">
                                    {formatUnits(item.pieces, 'Piece')}
                                </span>
                            </li>
                        ))}
                    </ol>
                )}
            </div>
            <ListFooter>
                <Link
                    href={SalesReportController.index({
                        query: { tab: 'sold' },
                    })}
                    className={footerLink}
                >
                    See Sales Reports
                    <ArrowRight size={15} />
                </Link>
            </ListFooter>
        </>
    );
}

function ReadyToOrderList({ data }: { data: StockCardsData }) {
    const { items, threshold, count } = data.ready_to_order;
    const [busy, setBusy] = useState<number | null>(null);
    const [confirming, setConfirming] = useState<(typeof items)[number] | null>(
        null,
    );

    const act = (url: string, productId: number) => {
        setBusy(productId);
        router.post(
            url,
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onFinish: () => {
                    setBusy(null);
                    setConfirming(null);
                },
            },
        );
    };

    return (
        <>
            <ListHeader
                title="Ready to order"
                description={`Coming Soon items with ${threshold.toLocaleString('en-PH')} or more pieces preordered (set on Maintenance). Create PO closes their preorders; Leave it keeps them open.`}
            />
            <div className="min-h-0 flex-1 overflow-y-auto">
                {items.length === 0 ? (
                    <p className="px-6 py-12 text-center text-sm text-slate-500">
                        No Coming Soon item has {threshold} pieces preordered
                        yet.
                    </p>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {items.map((item) => (
                            <li
                                key={item.product_id}
                                className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="min-w-0">
                                    <p className="truncate font-black text-slate-900">
                                        {item.product_name}
                                    </p>
                                    <p className="text-sm text-slate-500">
                                        <span className="font-black text-amber-700">
                                            {formatUnits(item.pieces, 'Piece')}{' '}
                                            preordered
                                        </span>{' '}
                                        ({threshold} needed)
                                        {item.preorders_close_on &&
                                            ` · closes ${formatDateOrdered(item.preorders_close_on)}`}
                                    </p>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    <button
                                        type="button"
                                        disabled={busy !== null}
                                        onClick={() => setConfirming(item)}
                                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0D6EFD] px-3.5 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-60"
                                    >
                                        Create PO
                                    </button>
                                    <button
                                        type="button"
                                        disabled={busy !== null}
                                        onClick={() =>
                                            act(
                                                ReadyToOrderController.leave(
                                                    item.product_id,
                                                ).url,
                                                item.product_id,
                                            )
                                        }
                                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                                    >
                                        {busy === item.product_id &&
                                        confirming === null ? (
                                            <LoaderCircle
                                                size={14}
                                                className="animate-spin"
                                            />
                                        ) : null}
                                        Leave it
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <ListFooter>
                <Link
                    href={PreorderController.index({
                        query: { stage: 'open' },
                    })}
                    className={footerLink}
                >
                    {count > items.length
                        ? `See all ${count} on Preorders`
                        : 'Open Preorders'}
                    <ArrowRight size={15} />
                </Link>
            </ListFooter>

            {/* Closing preorders cannot be undone here, so it asks first. */}
            <ConfirmDialog
                open={confirming !== null}
                title={`Create a PO for ${confirming?.product_name ?? 'this item'}?`}
                description={`Its preorders close now and ${confirming ? formatUnits(confirming.pieces, 'Piece') : 'the pieces'} move to To order on the Preorders page; buyers can no longer preorder it. Then order them in the eStore and scan the PO.`}
                cancelLabel="Not yet"
                confirmLabel="Create PO"
                busy={busy !== null}
                onConfirm={() =>
                    confirming &&
                    act(
                        ReadyToOrderController.order(confirming.product_id).url,
                        confirming.product_id,
                    )
                }
                onClose={() => setConfirming(null)}
            />
        </>
    );
}

/** "₱480.00", or "from ₱500.00" when sizes have different prices. */
function priceText(from: number | null, to: number | null): string {
    if (from === null) {
        return '';
    }

    return from === to ? formatPeso(from) : `from ${formatPeso(from)}`;
}

/**
 * The buyers who spent the most on released orders in the last 3 months,
 * and Tell top buyers: a product in stock, how many of the top buyers, and
 * a short note; they get a notice and a phone notification.
 */
function TopBuyersList({
    data,
    onSent,
}: {
    data: StockCardsData;
    onSent: () => void;
}) {
    const { items, from, buyers_count, sizes, products, last } =
        data.top_buyers;
    const [telling, setTelling] = useState(false);
    const form = useForm<{ product_id: string; top: number; note: string }>({
        product_id: '',
        top: sizes[0] ?? 10,
        note: '',
    });
    const chosen = products.find(
        (product) => String(product.product_id) === form.data.product_id,
    );
    const recipients = Math.min(form.data.top, buyers_count);
    const price = chosen
        ? priceText(chosen.price_from_centavos, chosen.price_to_centavos)
        : '';

    const send = () =>
        form.post(ProductAnnouncementController.store().url, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                form.reset();
                setTelling(false);
                onSent();
            },
        });

    if (telling) {
        return (
            <>
                <ListHeader
                    title="Tell top buyers about a product"
                    description="They get a notice in PROWARE and a notification on their phone. A product can be announced once a day."
                />
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
                    <label className="grid gap-1.5">
                        <span className="text-sm font-black text-slate-700">
                            Product in stock
                        </span>
                        <select
                            value={form.data.product_id}
                            onChange={(event) =>
                                form.setData('product_id', event.target.value)
                            }
                            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="">Choose a product…</option>
                            {products.map((product) => (
                                <option
                                    key={product.product_id}
                                    value={product.product_id}
                                >
                                    {product.product_name}
                                    {product.arrived_on
                                        ? ` · arrived ${formatDateOrdered(product.arrived_on)}`
                                        : ''}
                                    {product.announced_at
                                        ? ` · announced ${formatDateOrdered(product.announced_at.slice(0, 10))}`
                                        : ''}
                                </option>
                            ))}
                        </select>
                        <span className="text-xs text-slate-500">
                            The latest to arrive are at the top.
                        </span>
                        <InputError message={form.errors.product_id} />
                    </label>

                    <div className="grid gap-1.5">
                        <span className="text-sm font-black text-slate-700">
                            Tell
                        </span>
                        <div className="flex flex-wrap gap-2">
                            {sizes.map((size) => (
                                <button
                                    key={size}
                                    type="button"
                                    onClick={() => form.setData('top', size)}
                                    className={cn(
                                        'rounded-xl border px-4 py-2 text-sm font-black transition',
                                        form.data.top === size
                                            ? 'border-blue-300 bg-blue-50 text-blue-700'
                                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                                    )}
                                >
                                    Top {size} buyers
                                </button>
                            ))}
                        </div>
                        <span className="text-xs text-slate-500">
                            {buyers_count < form.data.top
                                ? `Only ${buyers_count} ${buyers_count === 1 ? 'buyer has' : 'buyers have'} bought in the last 3 months, so ${buyers_count === 1 ? 'that one gets' : 'they all get'} it.`
                                : `The ${form.data.top} buyers who spent the most in the last 3 months.`}
                        </span>
                        <InputError message={form.errors.top} />
                    </div>

                    <label className="grid gap-1.5">
                        <span className="text-sm font-black text-slate-700">
                            Note (optional)
                        </span>
                        <input
                            type="text"
                            maxLength={120}
                            value={form.data.note}
                            onChange={(event) =>
                                form.setData('note', event.target.value)
                            }
                            placeholder="e.g. Limited stock."
                            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                        <InputError message={form.errors.note} />
                    </label>

                    <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                        <p className="text-xs font-black tracking-wide text-blue-700 uppercase">
                            What they will see
                        </p>
                        <p className="mt-1.5 font-black text-slate-900">
                            New in the store:{' '}
                            {chosen ? chosen.product_name : '…'}
                        </p>
                        <p className="text-sm text-slate-600">
                            It is in stock now{price ? ` at ${price}` : ''}.
                            {form.data.note.trim() &&
                                ` ${form.data.note.trim()}`}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3">
                    <button
                        type="button"
                        onClick={() => setTelling(false)}
                        disabled={form.processing}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                    >
                        Back
                    </button>
                    <button
                        type="button"
                        onClick={send}
                        disabled={form.processing}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
                    >
                        {form.processing ? (
                            <LoaderCircle size={15} className="animate-spin" />
                        ) : (
                            <Megaphone size={15} />
                        )}
                        Send to {recipients}{' '}
                        {recipients === 1 ? 'buyer' : 'buyers'}
                    </button>
                </div>
            </>
        );
    }

    return (
        <>
            <ListHeader
                title="Top buyers"
                description={`Who spent the most on released orders since ${formatDateOrdered(from)} (${buyers_count} ${buyers_count === 1 ? 'buyer' : 'buyers'} in all).`}
            />
            <div className="min-h-0 flex-1 overflow-y-auto">
                {items.length === 0 ? (
                    <p className="px-6 py-12 text-center text-sm text-slate-500">
                        No orders were released in the last 3 months.
                    </p>
                ) : (
                    <ol className="divide-y divide-slate-100">
                        {items.map((buyer, index) => (
                            <li
                                key={buyer.user_id}
                                className="flex items-center gap-4 px-6 py-3.5"
                            >
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-black text-blue-700">
                                    {index + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-black text-slate-900">
                                        {buyer.name}
                                    </p>
                                    <p className="truncate text-xs text-slate-500">
                                        {buyer.email}
                                    </p>
                                </div>
                                <div className="shrink-0 text-right">
                                    <p className="font-black text-slate-900">
                                        {formatPeso(buyer.spent_centavos)}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {buyer.orders}{' '}
                                        {buyer.orders === 1
                                            ? 'order'
                                            : 'orders'}{' '}
                                        · {formatUnits(buyer.pieces, 'Piece')}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ol>
                )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3">
                <span className="text-xs text-slate-500">
                    {last
                        ? `Last sent: ${last.product_name} to ${last.recipients} ${last.recipients === 1 ? 'buyer' : 'buyers'}, ${formatDateTime(last.sent_at)}${last.sent_by ? ` by ${last.sent_by}` : ''}.`
                        : 'Nothing announced yet.'}
                </span>
                <div className="flex gap-2">
                    <DialogClose className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50">
                        Close
                    </DialogClose>
                    <button
                        type="button"
                        disabled={items.length === 0 || products.length === 0}
                        onClick={() => setTelling(true)}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
                    >
                        <Megaphone size={15} />
                        Tell top buyers
                    </button>
                </div>
            </div>
        </>
    );
}

/**
 * Items with unpaid preorders and no payment dates yet, the most preordered
 * first: Set dates opens the payment dates. Until they are set, buyers can
 * pay whenever they like and nothing is dropped.
 */
function SetUpList({ data }: { data: StockCardsData }) {
    const { items, count, today } = data.preorders_to_set_up;
    const [setting, setSetting] = useState<CloseDateTarget | null>(null);

    return (
        <>
            <ListHeader
                title="Preorders to set up"
                description="Buyers preordered these, but no payment dates are set yet. Set them: buyers are told to pay at the cashier by the close date, or their preorders are dropped."
            />
            <div className="min-h-0 flex-1 overflow-y-auto">
                {items.length === 0 ? (
                    <p className="px-6 py-12 text-center text-sm text-slate-500">
                        Every item with preorders has its payment dates.
                    </p>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {items.map((item) => (
                            <li
                                key={item.product_id}
                                className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="min-w-0">
                                    <p className="truncate font-black text-slate-900">
                                        {item.product_name}
                                    </p>
                                    <p className="text-sm text-slate-500">
                                        <span className="font-black text-amber-700">
                                            {formatUnits(item.pieces, 'Piece')}
                                        </span>{' '}
                                        unpaid · {item.buyers}{' '}
                                        {item.buyers === 1 ? 'buyer' : 'buyers'}{' '}
                                        ·{' '}
                                        {item.coming_soon
                                            ? 'Coming Soon'
                                            : 'waiting for restock'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setSetting({
                                            id: item.product_id,
                                            name: item.product_name,
                                            preorders_close_on:
                                                item.preorders_close_on,
                                            preorder_pay_from: null,
                                        })
                                    }
                                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#0D6EFD] px-3.5 text-sm font-black text-white transition hover:bg-blue-700"
                                >
                                    <CalendarClock size={14} />
                                    Set dates
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <ListFooter>
                <span className="text-sm text-slate-500">
                    {count > items.length
                        ? `Showing ${items.length} of ${count}.`
                        : ''}
                </span>
            </ListFooter>

            <PreorderCloseDateDialog
                product={setting}
                today={today}
                onClose={() => setSetting(null)}
            />
        </>
    );
}
