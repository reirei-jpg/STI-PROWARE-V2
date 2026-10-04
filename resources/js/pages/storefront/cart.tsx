import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    Banknote,
    ImageIcon,
    LoaderCircle,
    Minus,
    Plus,
    ShoppingCart,
    Trash2,
    TriangleAlert,
} from 'lucide-react';
import { useState } from 'react';
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
 * items (the rest stay in the cart for later). They pay in cash at the
 * PROWARE office when they pick the order up; the items are held for them
 * until the pick-up date.
 */
export default function Cart({
    lines,
    selected_count: selectedCount,
    total_centavos: total,
    can_place_order: canPlaceOrder,
    pick_up_by: pickUpBy,
}: {
    lines: CartLine[];
    selected_count: number;
    total_centavos: number;
    can_place_order: boolean;
    pick_up_by: string;
}) {
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const placeOrder = useForm({});
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

                        <aside className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
                            <div className="flex items-baseline justify-between">
                                <span className="text-sm font-bold text-slate-600">
                                    Total ({selectedCount}{' '}
                                    {selectedCount === 1 ? 'item' : 'items'})
                                </span>
                                <span className="text-2xl font-black text-slate-900">
                                    {formatPeso(total)}
                                </span>
                            </div>

                            <p className="flex gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
                                <Banknote
                                    size={20}
                                    className="mt-0.5 shrink-0"
                                />
                                <span>
                                    Pay in cash at the PROWARE office when you
                                    pick it up. Pick it up by{' '}
                                    <strong>
                                        {formatDateOrdered(pickUpBy)}
                                    </strong>
                                    , or the order is cancelled.
                                </span>
                            </p>

                            <InputError message={errors.cart} />

                            {selectedCount === 0 ? (
                                <p className="text-sm text-slate-600">
                                    Tick the items you want to order.
                                </p>
                            ) : (
                                tickedHaveProblems && (
                                    <p className="text-sm text-red-600">
                                        Fix or untick the items marked in red
                                        first.
                                    </p>
                                )
                            )}

                            <button
                                type="button"
                                disabled={
                                    !canPlaceOrder || placeOrder.processing
                                }
                                onClick={() =>
                                    placeOrder.post(
                                        StudentOrderController.store().url,
                                    )
                                }
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {placeOrder.processing && (
                                    <LoaderCircle
                                        size={17}
                                        className="animate-spin"
                                    />
                                )}
                                Place Order
                                {selectedCount > 0 && ` (${selectedCount})`}
                            </button>
                            {selectedCount > 0 &&
                                selectedCount < lines.length && (
                                    <p className="text-center text-xs text-slate-500">
                                        Unticked items stay in your cart.
                                    </p>
                                )}
                        </aside>
                    </div>
                )}
            </div>
        </>
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
