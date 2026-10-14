import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, ClipboardCheck, History, Pencil } from 'lucide-react';
import { useState } from 'react';
import OrderController from '@/actions/App/Http/Controllers/OrderController';
import ProductController from '@/actions/App/Http/Controllers/ProductController';
import ProductStockController from '@/actions/App/Http/Controllers/ProductStockController';
import CorrectStockDialog from '@/components/correct-stock-dialog';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import Panel, { TableHeading, TableScroll } from '@/components/panel';
import { formatDateOrdered } from '@/lib/format';
import { formatConversion, formatUnits } from '@/lib/units';
import { cn } from '@/lib/utils';
import type {
    Paginated,
    StockCorrectionReasonOption,
    StockHold,
    StockMovementRow,
    StockProduct,
    StockVariant,
} from '@/types';

/**
 * A product's stock: the pieces each variant has on the shelf, how many are
 * held for students' orders (and for whom) and free to sell, and every
 * change to the shelf (deliveries, corrections, released orders) with the
 * balance after, newest first. The Specialist corrects the stock here,
 * with a reason.
 */
export default function ProductStock({
    product,
    variants,
    holds,
    movements,
    filters,
    reasons,
}: {
    product: StockProduct;
    variants: StockVariant[];
    holds: StockHold[];
    movements: Paginated<StockMovementRow>;
    filters: { variant: number | null };
    reasons: StockCorrectionReasonOption[];
}) {
    const [correcting, setCorrecting] = useState(false);

    const showVariant = (variantId: number | null) =>
        router.get(
            ProductStockController.index(product.id).url,
            variantId === null ? {} : { variant: variantId },
            { preserveState: true, preserveScroll: true, replace: true },
        );

    // The eStore code and how Head Office sends it, said once when every
    // size shares it; otherwise each tile says its own.
    const codes = new Set(
        variants.map(
            (variant) => `${variant.estore_item_code}|${variant.sent_by}`,
        ),
    );
    const sharedCode =
        codes.size === 1 && variants[0]?.estore_item_code
            ? `eStore Item Code ${variants[0].estore_item_code}, sent by the ${variants[0].sent_by ?? 'piece'}`
            : null;
    const summary = [
        `${formatUnits(product.stock_on_hand, 'Piece')} on the shelf`,
        product.held_pieces > 0 &&
            `${formatUnits(product.held_pieces, 'Piece')} held for orders`,
        product.is_sold
            ? `warned at ${formatUnits(product.low_stock_alert_at, 'Piece')}${product.has_options ? ' each' : ''}`
            : 'not watched for low stock',
        sharedCode,
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <>
            <Head title={`Stock History · ${product.name}`} />

            <div className="space-y-6">
                <PageHeader
                    title={`Stock History · ${product.name}`}
                    description={summary}
                    actions={
                        <>
                            <Link
                                href={ProductController.index()}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black whitespace-nowrap text-slate-700 shadow-sm transition hover:bg-slate-50"
                            >
                                <ArrowLeft size={18} />
                                Back to Products
                            </Link>
                            <Link
                                href={ProductController.edit(product.id)}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black whitespace-nowrap text-slate-700 shadow-sm transition hover:bg-slate-50"
                            >
                                <Pencil size={18} />
                                Edit Product
                            </Link>
                            <button
                                type="button"
                                onClick={() => setCorrecting(true)}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D6EFD] px-4 py-3 text-sm font-black whitespace-nowrap text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
                            >
                                <ClipboardCheck size={18} />
                                Correct stock
                            </button>
                        </>
                    }
                />

                {product.has_options ? (
                    <section className="flex flex-wrap gap-2">
                        <SizeTile
                            active={filters.variant === null}
                            onClick={() => showVariant(null)}
                            label="All"
                            pieces={product.stock_on_hand}
                        />
                        {variants.map((variant) => (
                            <SizeTile
                                key={variant.id}
                                active={filters.variant === variant.id}
                                onClick={() => showVariant(variant.id)}
                                label={variant.label}
                                pieces={variant.stock_on_hand}
                                held={variant.held_pieces}
                                level={stockLevel(product, variant)}
                                code={
                                    sharedCode === null
                                        ? variant.estore_item_code
                                            ? variant.estore_item_code
                                            : 'No eStore code'
                                        : null
                                }
                            />
                        ))}
                    </section>
                ) : (
                    variants[0] &&
                    !variants[0].estore_item_code && (
                        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-900">
                            No eStore Item Code yet, so deliveries do not reach
                            this stock. Add it in Edit Product.
                        </p>
                    )
                )}

                {holds.length > 0 && (
                    <Panel
                        title="Held for Students' Orders"
                        description={`${formatUnits(product.held_pieces, 'Piece')} on the shelf are kept for these orders until they are released or expire. The nearest pick-up date first.`}
                        className="border-l-4 border-l-amber-500"
                    >
                        <ul className="divide-y divide-slate-100">
                            {holds.map((hold, index) => (
                                <li
                                    key={`${hold.order_id}-${index}`}
                                    className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm"
                                >
                                    <div>
                                        <Link
                                            href={OrderController.slip({
                                                query: {
                                                    code:
                                                        hold.order_number ?? '',
                                                },
                                            })}
                                            className="font-black text-blue-700 hover:underline"
                                        >
                                            {hold.order_number}
                                        </Link>{' '}
                                        <span className="font-bold text-slate-700">
                                            {hold.student_name}
                                        </span>
                                        {product.has_options && (
                                            <span className="text-slate-500">
                                                {' '}
                                                · {hold.variant_label}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-slate-600">
                                        <strong className="text-slate-900">
                                            {formatUnits(hold.pieces, 'Piece')}
                                        </strong>{' '}
                                        · pick up by{' '}
                                        {formatDateOrdered(hold.pick_up_by)}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    </Panel>
                )}

                <Panel
                    title="Every Change to the Stock"
                    description="Newest first, in pieces. Changes cannot be edited or deleted."
                >
                    {movements.data.length === 0 ? (
                        <div className="px-6 py-16 text-center">
                            <History
                                size={44}
                                className="mx-auto text-slate-300"
                            />
                            <h3 className="mt-4 text-lg font-black text-slate-800">
                                No stock changes yet
                            </h3>
                            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                                Stock is added when a delivery of a linked
                                eStore item is recorded, and changes when you
                                correct it.
                            </p>
                        </div>
                    ) : (
                        <>
                            <TableScroll>
                                <table className="w-full min-w-225">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <TableHeading>When</TableHeading>
                                            {product.has_options && (
                                                <TableHeading>
                                                    Size / Color
                                                </TableHeading>
                                            )}
                                            <TableHeading>
                                                What Happened
                                            </TableHeading>
                                            <TableHeading align="right">
                                                Change
                                            </TableHeading>
                                            <TableHeading align="right">
                                                Balance
                                            </TableHeading>
                                            <TableHeading>By</TableHeading>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {movements.data.map((movement) => (
                                            <tr
                                                key={movement.id}
                                                className="border-t border-slate-100 align-top text-sm"
                                            >
                                                <td className="px-5 py-3 whitespace-nowrap">
                                                    <p className="font-semibold text-slate-800">
                                                        {formatDay(
                                                            movement.created_at,
                                                        )}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {formatTime(
                                                            movement.created_at,
                                                        )}
                                                    </p>
                                                </td>
                                                {product.has_options && (
                                                    <td className="px-5 py-3 font-black whitespace-nowrap text-slate-900">
                                                        {movement.variant_label}
                                                    </td>
                                                )}
                                                <td className="px-5 py-3">
                                                    <WhatHappened
                                                        movement={movement}
                                                    />
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <Change
                                                        movement={movement}
                                                    />
                                                </td>
                                                <td className="px-5 py-3 text-right font-black whitespace-nowrap text-slate-900">
                                                    {formatUnits(
                                                        movement.balance_after,
                                                        'Piece',
                                                    )}
                                                </td>
                                                <td className="px-5 py-3 font-semibold whitespace-nowrap text-slate-700">
                                                    {movement.recorded_by ??
                                                        '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </TableScroll>

                            <Pagination
                                pagination={movements}
                                itemName="changes"
                            />
                        </>
                    )}
                </Panel>
            </div>

            <CorrectStockDialog
                open={correcting}
                product={product}
                variants={variants}
                reasons={reasons}
                initialVariantId={filters.variant}
                onClose={() => setCorrecting(false)}
            />
        </>
    );
}

/**
 * "Delivery · Order #30722 · SI # … · received Oct 1" or
 * "Correction · Recount" with the note.
 */
function WhatHappened({ movement }: { movement: StockMovementRow }) {
    return (
        <div>
            <p className="font-black text-slate-900">
                {movement.type_label}
                {movement.reason_label && ` · ${movement.reason_label}`}
                {movement.order && ` · ${movement.order.number}`}
            </p>
            {movement.order && (
                <p className="mt-1 text-xs text-slate-500">
                    {movement.order.student_name}
                </p>
            )}
            {movement.delivery && (
                <p className="mt-1 text-xs text-slate-500">
                    {[
                        movement.delivery.order_number &&
                            `Order #${movement.delivery.order_number}`,
                        movement.delivery.sales_invoice_number &&
                            `SI # ${movement.delivery.sales_invoice_number}`,
                        `received ${formatDateOrdered(movement.delivery.received_on)}`,
                    ]
                        .filter(Boolean)
                        .join(' · ')}
                </p>
            )}
            {movement.note && (
                <p className="mt-1 text-xs text-slate-500">“{movement.note}”</p>
            )}
        </div>
    );
}

/**
 * The change in pieces, with how a delivery became pieces, e.g.
 * "+100 pcs" under "10 Packs × 10".
 */
function Change({ movement }: { movement: StockMovementRow }) {
    const added = movement.quantity > 0;

    return (
        <div>
            <p
                className={cn(
                    'font-black whitespace-nowrap',
                    added ? 'text-emerald-700' : 'text-red-600',
                )}
            >
                {added ? '+' : '−'}
                {formatUnits(Math.abs(movement.quantity), 'Piece')}
            </p>
            {movement.units_received !== null &&
                movement.unit_name !== null &&
                movement.pieces_per_unit !== null &&
                movement.pieces_per_unit > 1 && (
                    <p className="mt-1 text-xs whitespace-nowrap text-slate-500">
                        {formatConversion(
                            movement.units_received,
                            movement.unit_name,
                            movement.pieces_per_unit,
                        )}
                    </p>
                )}
        </div>
    );
}

type StockLevel = 'ok' | 'low' | 'out';

/** Low or out of stock, for a product that is watched for low stock. */
function stockLevel(product: StockProduct, variant: StockVariant): StockLevel {
    if (!product.is_sold || variant.free_to_sell > product.low_stock_alert_at) {
        return 'ok';
    }

    return variant.free_to_sell === 0 ? 'out' : 'low';
}

/**
 * A size or color with its pieces on the shelf; clicking it shows only its
 * changes below ("All" shows every change).
 */
function SizeTile({
    active,
    onClick,
    label,
    pieces,
    held = 0,
    level = 'ok',
    code = null,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    pieces: number;
    held?: number;
    level?: StockLevel;
    /** The size's own eStore code, when sizes do not share one. */
    code?: string | null;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                'min-w-28 rounded-2xl border px-4 py-2.5 text-left shadow-sm transition',
                active
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 bg-white text-slate-900 hover:border-blue-300 hover:bg-blue-50',
            )}
        >
            <span
                className={cn(
                    'block text-xs font-black tracking-wide uppercase',
                    active ? 'text-white/80' : 'text-slate-500',
                )}
            >
                {label}
            </span>
            <span className="mt-0.5 flex items-baseline gap-1.5 whitespace-nowrap">
                <span
                    className={cn(
                        'text-lg font-black',
                        !active && level !== 'ok' && 'text-amber-700',
                        !active && level === 'out' && 'text-red-600',
                    )}
                >
                    {pieces.toLocaleString('en-PH')}
                </span>
                <span
                    className={cn(
                        'text-xs',
                        active ? 'text-white/80' : 'text-slate-500',
                    )}
                >
                    pcs
                </span>
                {level !== 'ok' && (
                    <span
                        className={cn(
                            'inline-flex items-center gap-1 text-xs font-black',
                            active
                                ? 'text-white'
                                : level === 'out'
                                  ? 'text-red-600'
                                  : 'text-amber-700',
                        )}
                    >
                        <span
                            className={cn(
                                'h-2 w-2 rounded-full',
                                level === 'out' ? 'bg-red-500' : 'bg-amber-500',
                            )}
                        />
                        {level === 'out' ? 'Out' : 'Low'}
                    </span>
                )}
            </span>
            {(held > 0 || code) && (
                <span
                    className={cn(
                        'mt-0.5 block text-xs whitespace-nowrap',
                        active ? 'text-white/80' : 'text-slate-500',
                    )}
                >
                    {[held > 0 && `${held} held`, code]
                        .filter(Boolean)
                        .join(' · ')}
                </span>
            )}
        </button>
    );
}

/** "Oct 11, 2026" of a moment, in the viewer's time. */
function formatDay(value: string | null): string {
    if (value === null) {
        return '—';
    }

    return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(
        new Date(value),
    );
}

/** "11:30 AM" of a moment, in the viewer's time. */
function formatTime(value: string | null): string {
    if (value === null) {
        return '';
    }

    return new Intl.DateTimeFormat('en-PH', { timeStyle: 'short' }).format(
        new Date(value),
    );
}
