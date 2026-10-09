import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarDays,
    GraduationCap,
    ImageIcon,
    LoaderCircle,
    Minus,
    Plus,
    ShoppingCart,
    Trash2,
    TriangleAlert,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import CartController from '@/actions/App/Http/Controllers/CartController';
import StudentOrderController from '@/actions/App/Http/Controllers/StudentOrderController';
import InputError from '@/components/input-error';
import { Checkbox } from '@/components/ui/checkbox';
import { formatDateOrdered, formatPeso } from '@/lib/format';
import { formatUnits } from '@/lib/units';
import { cn } from '@/lib/utils';
import { home } from '@/routes';
import type { CartLine } from '@/types';

/**
 * Tick or untick lines for the next Place Order. The tick changes at once;
 * the total follows when the server answers.
 */
function selectLines(ids: number[], selected: boolean): void {
    router
        .optimistic<{ lines: CartLine[] }>((props) => ({
            lines: props.lines.map((line) =>
                ids.includes(line.id) ? { ...line, selected } : line,
            ),
        }))
        .patch(
            CartController.select().url,
            { cart_item_ids: ids, selected },
            { preserveScroll: true },
        );
}

/**
 * The student's cart at today's prices, and Place Order for the ticked
 * items (the rest stay in the cart for later), with the course/section for
 * the issuance slip. They show the slip and pay at the PROWARE office; the
 * items are held for them until the pick-up date.
 */
export default function Cart({
    lines,
    selected_count: selectedCount,
    total_centavos: total,
    can_place_order: canPlaceOrder,
    pick_up_by: pickUpBy,
    section,
    order_refusal: orderRefusal,
}: {
    lines: CartLine[];
    selected_count: number;
    total_centavos: number;
    can_place_order: boolean;
    pick_up_by: string;
    /** The course/section the student gave last time, for the slip. */
    section: string | null;
    /** Why Place Order would be refused (too many waiting, or paused). */
    order_refusal: string | null;
}) {
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const placeOrder = useForm({ section: section ?? '' });
    const allTicked = lines.every((line) => line.selected);
    const tickedHaveProblems = lines.some(
        (line) => line.selected && line.problem !== null,
    );

    return (
        <>
            <Head title="Cart" />

            <div className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">
                            Cart
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Prices are today's. They are kept once you place the
                            order.
                        </p>
                    </div>
                    <Link
                        href={home()}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                        <ArrowLeft size={17} />
                        Back to the store
                    </Link>
                </div>

                {lines.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                        <ShoppingCart
                            size={40}
                            className="mx-auto text-slate-300"
                        />
                        <h2 className="mt-3 text-lg font-black text-slate-800">
                            Your cart is empty
                        </h2>
                        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                            Tap Add to Cart on an item in the store.
                        </p>
                    </div>
                ) : (
                    <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
                        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                            <label className="flex cursor-pointer items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700">
                                <Checkbox
                                    checked={allTicked}
                                    onCheckedChange={() =>
                                        selectLines(
                                            lines.map((line) => line.id),
                                            !allTicked,
                                        )
                                    }
                                    className="size-5"
                                />
                                Select all
                                <span className="font-bold text-slate-500">
                                    ({selectedCount} of {lines.length})
                                </span>
                            </label>
                            <ul className="divide-y divide-slate-100">
                                {lines.map((line) => (
                                    <CartLineRow key={line.id} line={line} />
                                ))}
                            </ul>
                        </div>

                        <aside className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-24">
                            <div className="bg-linear-to-br from-[#0D6EFD] to-blue-700 px-5 py-5 text-white">
                                <p className="text-xs font-black tracking-wide text-blue-100 uppercase">
                                    Order summary
                                </p>
                                <div className="mt-2 flex items-end justify-between gap-3">
                                    <span className="text-sm font-bold text-blue-50">
                                        {selectedCount}{' '}
                                        {selectedCount === 1 ? 'item' : 'items'}
                                    </span>
                                    <span className="text-3xl font-black tracking-tight">
                                        {formatPeso(total)}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-5 p-5">
                                <ol className="space-y-3">
                                    <Step number={1}>Place your order</Step>
                                    <Step number={2}>
                                        Show your issuance slip at the PROWARE
                                        office by{' '}
                                        <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-0.5 font-black text-blue-700">
                                            <CalendarDays size={14} />
                                            {formatDateOrdered(pickUpBy)}
                                        </span>
                                    </Step>
                                    <Step number={3}>
                                        Pay there and get your items
                                    </Step>
                                </ol>
                                <p className="-mt-2 pl-10 text-xs text-slate-500">
                                    Not picked up by then? The order is
                                    cancelled.
                                </p>

                                <div>
                                    <label
                                        htmlFor="section"
                                        className="text-sm font-black text-slate-700"
                                    >
                                        Course/Section
                                    </label>
                                    <div className="relative mt-1">
                                        <GraduationCap
                                            size={18}
                                            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
                                        />
                                        <input
                                            id="section"
                                            value={placeOrder.data.section}
                                            onChange={(event) =>
                                                placeOrder.setData(
                                                    'section',
                                                    event.target.value,
                                                )
                                            }
                                            maxLength={40}
                                            placeholder="e.g. BSIT 1-A"
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pr-3 pl-10 text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                                        />
                                    </div>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Printed on your issuance slip. Kept for
                                        next time.
                                    </p>
                                    <InputError
                                        message={placeOrder.errors.section}
                                    />
                                </div>

                                <InputError message={errors.cart} />

                                {orderRefusal !== null ? (
                                    <p className="flex gap-2 rounded-xl border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
                                        <TriangleAlert
                                            size={18}
                                            className="mt-0.5 shrink-0"
                                        />
                                        {orderRefusal}
                                    </p>
                                ) : selectedCount === 0 ? (
                                    <p className="text-sm text-slate-600">
                                        Tick the items you want to order.
                                    </p>
                                ) : (
                                    tickedHaveProblems && (
                                        <p className="text-sm text-red-600">
                                            Fix or untick the items marked in
                                            red first.
                                        </p>
                                    )
                                )}

                                <button
                                    type="button"
                                    disabled={
                                        !canPlaceOrder ||
                                        orderRefusal !== null ||
                                        placeOrder.processing
                                    }
                                    onClick={() =>
                                        placeOrder.post(
                                            StudentOrderController.store().url,
                                        )
                                    }
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0D6EFD] px-5 py-3.5 text-base font-black text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
                                >
                                    {placeOrder.processing && (
                                        <LoaderCircle
                                            size={18}
                                            className="animate-spin"
                                        />
                                    )}
                                    Place Order
                                    {selectedCount > 0 &&
                                        ` · ${formatPeso(total)}`}
                                </button>
                                {selectedCount > 0 &&
                                    selectedCount < lines.length && (
                                        <p className="-mt-2 text-center text-xs text-slate-500">
                                            Unticked items stay in your cart.
                                        </p>
                                    )}
                            </div>
                        </aside>
                    </div>
                )}
            </div>
        </>
    );
}

/** One numbered step of what happens after Place Order. */
function Step({ number, children }: { number: number; children: ReactNode }) {
    return (
        <li className="flex items-start gap-3 text-sm leading-6 text-slate-700">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-black text-blue-700 ring-1 ring-blue-200">
                {number}
            </span>
            <span className="pt-0.5">{children}</span>
        </li>
    );
}

function CartLineRow({ line }: { line: CartLine }) {
    const [quantity, setQuantity] = useState(String(line.quantity));
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const save = (value: number) => {
        if (value < 1 || value === line.quantity) {
            setQuantity(String(line.quantity));

            return;
        }

        setQuantity(String(value));
        setBusy(true);
        router.patch(
            CartController.update(line.id).url,
            { quantity: value },
            {
                preserveScroll: true,
                onSuccess: () => setError(null),
                onError: (errors) => {
                    setError(errors.quantity ?? null);
                    setQuantity(String(line.quantity));
                },
                onFinish: () => setBusy(false),
            },
        );
    };

    const remove = () => {
        setBusy(true);
        router.delete(CartController.destroy(line.id).url, {
            preserveScroll: true,
            onFinish: () => setBusy(false),
        });
    };

    const current = Number(quantity) || 0;

    return (
        <li
            className={cn(
                'flex flex-col gap-3 p-4 sm:flex-row sm:items-center',
                line.problem && line.selected && 'bg-red-50/60',
                !line.selected && 'bg-slate-50/70',
            )}
        >
            <div className="flex min-w-0 flex-1 items-center gap-3">
                <Checkbox
                    checked={line.selected}
                    onCheckedChange={(checked) =>
                        selectLines([line.id], checked === true)
                    }
                    aria-label={`Order ${line.product_name}`}
                    className="size-5"
                />
                <div
                    className={cn(
                        'flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-300',
                        !line.selected && 'opacity-60',
                    )}
                >
                    {line.photo_url ? (
                        <img
                            src={line.photo_url}
                            alt=""
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <ImageIcon size={22} />
                    )}
                </div>
                <div className="min-w-0">
                    <p className="font-black text-slate-900">
                        {line.product_name}
                    </p>
                    <p className="text-sm text-slate-600">
                        {line.variant_label && `${line.variant_label} · `}
                        {line.pieces_per_unit > 1
                            ? `${line.unit_name} of ${line.pieces_per_unit}`
                            : 'By the piece'}
                    </p>
                    {line.unit_price_centavos !== null && (
                        <p
                            className={cn(
                                'text-sm font-bold',
                                line.on_sale ? 'text-red-600' : 'text-blue-700',
                            )}
                        >
                            {formatPeso(line.unit_price_centavos)}
                            <span className="font-normal text-slate-500">
                                {' '}
                                /{' '}
                                {line.pieces_per_unit > 1
                                    ? line.unit_name
                                    : 'pc'}
                                {line.on_sale && ' · On sale'}
                            </span>
                        </p>
                    )}
                    {line.problem && (
                        <p className="mt-1 flex items-start gap-1 text-sm font-bold text-red-700">
                            <TriangleAlert
                                size={15}
                                className="mt-0.5 shrink-0"
                            />
                            {line.problem}
                        </p>
                    )}
                    {error && <InputError message={error} />}
                </div>
            </div>

            <div className="flex items-center justify-between gap-4 sm:justify-end">
                <div>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => save(current - 1)}
                            disabled={busy || current <= 1}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                            aria-label="One less"
                        >
                            <Minus size={14} />
                        </button>
                        <input
                            value={quantity}
                            onChange={(event) =>
                                setQuantity(
                                    event.target.value
                                        .replace(/\D/g, '')
                                        .slice(0, 4),
                                )
                            }
                            onBlur={() => save(current)}
                            onKeyDown={(event) =>
                                event.key === 'Enter' && save(current)
                            }
                            inputMode="numeric"
                            className="h-9 w-14 rounded-lg border border-slate-200 text-center text-sm font-black text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            aria-label="How many"
                        />
                        <button
                            type="button"
                            onClick={() => save(current + 1)}
                            disabled={busy || current >= line.most_allowed}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                            aria-label="One more"
                        >
                            <Plus size={14} />
                        </button>
                    </div>
                    <p className="mt-1 text-center text-xs text-slate-500">
                        {formatUnits(line.quantity, line.unit_name)}
                        {line.pieces_per_unit > 1 &&
                            ` = ${formatUnits(line.quantity * line.pieces_per_unit, 'Piece')}`}
                    </p>
                </div>

                <p className="w-24 text-right font-black text-slate-900">
                    {line.unit_price_centavos !== null
                        ? formatPeso(line.line_total_centavos)
                        : '—'}
                </p>

                <button
                    type="button"
                    onClick={remove}
                    disabled={busy}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    aria-label={`Remove ${line.product_name}`}
                    title="Remove"
                >
                    <Trash2 size={17} />
                </button>
            </div>
        </li>
    );
}
