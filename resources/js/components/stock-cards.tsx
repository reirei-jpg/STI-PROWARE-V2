import { Link, useForm, useHttp } from '@inertiajs/react';
import {
    ArrowRight,
    Banknote,
    Crown,
    FileText,
    LoaderCircle,
    Megaphone,
    TrendingUp,
    TriangleAlert,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import OrderController from '@/actions/App/Http/Controllers/OrderController';
import PreorderSlipController from '@/actions/App/Http/Controllers/PreorderSlipController';
import ProductAnnouncementController from '@/actions/App/Http/Controllers/ProductAnnouncementController';
import ProductStockController from '@/actions/App/Http/Controllers/ProductStockController';
import SalesReportController from '@/actions/App/Http/Controllers/SalesReportController';
import InputError from '@/components/input-error';
import StaffTag from '@/components/staff-tag';
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
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { confirmLeave } from '@/lib/back-guard';

export type StockCardsData = {
    low_stock: {
        count: number;
        items: {
            product_id: number;
            product_name: string;
            pieces_left: number;
            out_of_stock: boolean;
            warn_at: number;
            /** The low sizes or colors: "S/M: 1 pc left, A5: none left". */
            low_sizes: string | null;
        }[];
    };
    best_sellers: {
        /** The first day of this month. */
        from: string;
        items: { product_id: number; product_name: string; pieces: number }[];
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
    /** Preorder slips waiting for their items: unpaid (to verify) and paid. */
    preorder_slips: {
        to_verify: number;
        paid: number;
        all: number;
    };
};

type CardKey = 'low_stock' | 'best_sellers' | 'top_buyers' | 'preorder_slips';

/**
 * The stock cards on the Specialist's dashboard: Low stock, Best sellers
 * this month, Top buyers and Preorders. A card opens its list; on Top
 * buyers the Specialist can tell the top buyers about a product in stock,
 * and on Preorders check which preorder slips are paid.
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
                        icon={Banknote}
                        iconClassName="bg-amber-50 text-amber-600"
                        title="Preorders"
                        value={data.preorder_slips.to_verify.toLocaleString(
                            'en-PH',
                        )}
                        detail={`awaiting payment · ${data.preorder_slips.all.toLocaleString('en-PH')} ${data.preorder_slips.all === 1 ? 'slip' : 'slips'} in all`}
                        onOpen={() => setOpen('preorder_slips')}
                    />
                </div>
            </section>

            <Dialog
                open={open !== null}
                onOpenChange={(isOpen) =>
                    !isOpen && confirmLeave(() => setOpen(null))
                }
            >
                <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-2xl [&>button:last-child]:hidden">
                    {open === 'low_stock' && <LowStockList data={data} />}
                    {open === 'best_sellers' && <BestSellerList data={data} />}
                    {open === 'preorder_slips' && (
                        <PreorderSlipsList counts={data.preorder_slips} />
                    )}
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
                                            : `${item.low_sizes ?? `${formatUnits(item.pieces_left, 'Piece')} left`} · warned at ${formatUnits(item.warn_at, 'Piece')}`}
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
    // Closing with a product or note chosen asks first.
    const unsaved = useUnsavedChanges(
        telling && form.isDirty && !form.processing,
    );
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
                {unsaved.prompt}
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

type SlipTab = 'to_verify' | 'paid' | 'all';

type PreorderSlipRow = {
    slip_id: number;
    number: string | null;
    buyer_name: string;
    buyer_id_number: string | null;
    is_staff: boolean;
    product_name: string;
    /** "L × 2, XL × 1" or "3 pcs". */
    items: string;
    pieces: number;
    amount_centavos: number;
    paid: boolean;
    paid_on: string | null;
    pay_from: string | null;
    pay_until: string | null;
};

/** One buyer with their slips: a buyer has one slip per press of Preorder. */
type PreorderBuyerRow = {
    buyer_id: number;
    buyer_name: string;
    buyer_id_number: string | null;
    is_staff: boolean;
    unpaid_slips: number;
    unpaid_centavos: number;
    slips: PreorderSlipRow[];
};

type PreorderSlipPage = {
    data: PreorderBuyerRow[];
    current_page: number;
    last_page: number;
    total: number;
    counts: StockCardsData['preorder_slips'];
};

const slipTabs: { key: SlipTab; label: string }[] = [
    { key: 'to_verify', label: 'Awaiting payment' },
    { key: 'paid', label: 'Paid' },
    { key: 'all', label: 'All' },
];

/**
 * The Preorders card: a shortcut to the preorder slips still waiting for
 * their items, unpaid first. The cashier records the payments; View slip
 * opens the slip (as when it is scanned), with Release once its items are
 * here.
 */
function PreorderSlipsList({
    counts: initialCounts,
}: {
    counts: StockCardsData['preorder_slips'];
}) {
    const http = useHttp<Record<string, never>, PreorderSlipPage>({});
    const [tab, setTab] = useState<SlipTab>('to_verify');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [result, setResult] = useState<PreorderSlipPage | null>(null);
    const [failed, setFailed] = useState(false);
    const latest = useRef(0);
    const counts = result?.counts ?? initialCounts;

    // Load the page as the Specialist switches tabs, pages or types.
    useEffect(() => {
        const requestNumber = ++latest.current;
        const timer = window.setTimeout(
            () =>
                void http
                    .get(
                        PreorderSlipController.index({
                            query: { tab, search: search.trim(), page },
                        }).url,
                        {
                            onSuccess: (response) => {
                                if (requestNumber === latest.current) {
                                    setResult(response);
                                    setFailed(false);
                                }
                            },
                        },
                    )
                    .catch(() => setFailed(true)),
            search === '' ? 0 : 300,
        );

        return () => window.clearTimeout(timer);
        // `http` changes on every render; only these should reload.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, search, page]);

    const buyers = result?.data ?? [];

    return (
        <>
            <ListHeader
                title="Preorders"
                description="Preorders waiting for their items, by buyer, unpaid first. The cashier records the payments; View slip opens the slip."
            />
            <div className="space-y-3 border-b border-slate-100 px-6 py-4">
                <div className="flex flex-wrap gap-2">
                    {slipTabs.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => {
                                setTab(item.key);
                                setPage(1);
                            }}
                            className={cn(
                                'rounded-xl border px-3.5 py-2 text-sm font-black transition',
                                tab === item.key
                                    ? 'border-[#0D6EFD] bg-[#0D6EFD] text-white'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                            )}
                        >
                            {item.label} (
                            {counts[item.key].toLocaleString('en-PH')})
                        </button>
                    ))}
                </div>
                <input
                    type="search"
                    value={search}
                    onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                    }}
                    maxLength={120}
                    placeholder="Search slip number or buyer name"
                    aria-label="Search slip number or buyer name"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 outline-none focus:border-[#0D6EFD] focus:ring-2 focus:ring-blue-100"
                />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
                {failed ? (
                    <p className="px-6 py-12 text-center text-sm text-red-600">
                        The slips could not be loaded. Check the connection,
                        then try again.
                    </p>
                ) : result === null ? (
                    <div className="space-y-3 px-6 py-5">
                        {[0, 1, 2].map((key) => (
                            <div
                                key={key}
                                className="h-16 animate-pulse rounded-2xl bg-slate-100"
                            />
                        ))}
                    </div>
                ) : buyers.length === 0 ? (
                    <p className="px-6 py-12 text-center text-sm text-slate-500">
                        {search.trim() !== ''
                            ? `No slip or buyer in ${slipTabs.find((item) => item.key === tab)?.label} matches "${search.trim()}".`
                            : tab === 'to_verify'
                              ? 'Every preorder slip waiting for its items is paid.'
                              : tab === 'paid'
                                ? 'No paid preorder slip is waiting for its items.'
                                : 'No preorder slip is waiting for its items.'}
                    </p>
                ) : (
                    <ul
                        className={cn(
                            'space-y-3 px-6 py-4',
                            http.processing && 'opacity-60',
                        )}
                    >
                        {buyers.map((buyer) => (
                            <li
                                key={buyer.buyer_id}
                                className="overflow-hidden rounded-2xl border border-slate-200"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-3">
                                    <p className="flex flex-wrap items-center gap-1.5 font-black text-slate-900">
                                        {buyer.buyer_name}
                                        {buyer.is_staff && <StaffTag />}
                                        {buyer.buyer_id_number && (
                                            <span className="text-sm font-normal text-slate-500">
                                                {buyer.buyer_id_number}
                                            </span>
                                        )}
                                    </p>
                                    <span
                                        className={cn(
                                            'rounded-full px-2.5 py-0.5 text-xs font-black ring-1',
                                            buyer.unpaid_slips > 0
                                                ? 'bg-amber-50 text-amber-700 ring-amber-200'
                                                : 'bg-emerald-50 text-emerald-700 ring-emerald-200',
                                        )}
                                    >
                                        {buyer.unpaid_slips > 0
                                            ? `Not paid: ${formatPeso(buyer.unpaid_centavos)}`
                                            : 'All paid'}
                                    </span>
                                </div>
                                <ul className="divide-y divide-slate-100">
                                    {buyer.slips.map((row) => (
                                        <li
                                            key={row.slip_id}
                                            className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div className="min-w-0 space-y-0.5">
                                                <p className="text-sm font-bold text-slate-800">
                                                    {row.product_name}:{' '}
                                                    {row.items}
                                                </p>
                                                <p className="text-sm text-slate-500">
                                                    {row.number} ·{' '}
                                                    <span className="font-black text-slate-900">
                                                        {formatPeso(
                                                            row.amount_centavos,
                                                        )}
                                                    </span>{' '}
                                                    ·{' '}
                                                    {row.paid ? (
                                                        <span className="font-bold text-emerald-700">
                                                            Paid{' '}
                                                            {formatDateOrdered(
                                                                row.paid_on,
                                                            )}
                                                        </span>
                                                    ) : (
                                                        <span className="font-bold text-amber-700">
                                                            {row.pay_until ===
                                                            null
                                                                ? 'Awaiting payment'
                                                                : `Awaiting payment · pay ${formatDateOrdered(row.pay_from)} to ${formatDateOrdered(row.pay_until)}`}
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                            <Link
                                                href={
                                                    OrderController.slip({
                                                        query: {
                                                            code:
                                                                row.number ??
                                                                '',
                                                        },
                                                    }).url
                                                }
                                                className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-black text-blue-700 transition hover:bg-blue-50 sm:self-auto"
                                            >
                                                <FileText size={14} />
                                                View slip
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <ListFooter>
                {result !== null && result.last_page > 1 ? (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={page <= 1 || http.processing}
                            onClick={() => setPage(page - 1)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-slate-500">
                            Page {result.current_page} of {result.last_page}
                        </span>
                        <button
                            type="button"
                            disabled={
                                page >= result.last_page || http.processing
                            }
                            onClick={() => setPage(page + 1)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                ) : (
                    <span className="text-sm text-slate-500">
                        {result !== null && result.total > 0
                            ? `${result.total.toLocaleString('en-PH')} ${result.total === 1 ? 'buyer' : 'buyers'}`
                            : ''}
                    </span>
                )}
            </ListFooter>
        </>
    );
}
