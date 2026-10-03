import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Boxes,
    ClipboardCheck,
    History,
    Pencil,
} from 'lucide-react';
import { useState } from 'react';
import ProductController from '@/actions/App/Http/Controllers/ProductController';
import ProductStockController from '@/actions/App/Http/Controllers/ProductStockController';
import CorrectStockDialog from '@/components/correct-stock-dialog';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import Panel, { TableHeading } from '@/components/panel';
import SummaryCard from '@/components/summary-card';
import { formatDateOrdered, formatDateTime } from '@/lib/format';
import { formatConversion, formatUnits } from '@/lib/units';
import { cn } from '@/lib/utils';
import type {
    Paginated,
    StockCorrectionReasonOption,
    StockMovementRow,
    StockProduct,
    StockVariant,
} from '@/types';

/**
 * A product's stock: the pieces each variant has now, and every change to
 * it (deliveries and corrections) with the balance after, newest first.
 * The Specialist corrects the stock here, with a reason.
 */
export default function ProductStock({
    product,
    variants,
    movements,
    filters,
    reasons,
}: {
    product: StockProduct;
    variants: StockVariant[];
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

    return (
        <>
            <Head title={`Stock History · ${product.name}`} />

            <div className="space-y-7">
                <PageHeader
                    title="Stock History"
                    description={`${product.name} · ${formatUnits(product.stock_on_hand, 'Piece')} in stock · ${product.is_sold ? `you are warned at ${formatUnits(product.low_stock_alert_at, 'Piece')} per variant` : 'not watched for low stock (only Available and On Sale products are)'}. Every delivery and correction is listed here and cannot be changed or deleted.`}
                    actions={
                        <>
                            <Link
                                href={ProductController.index()}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                            >
                                <ArrowLeft size={18} />
                                Back to Products
                            </Link>
                            <Link
                                href={ProductController.edit(product.id)}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                            >
                                <Pencil size={18} />
                                Edit Product
                            </Link>
                            <button
                                type="button"
                                onClick={() => setCorrecting(true)}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
                            >
                                <ClipboardCheck size={18} />
                                Correct stock
                            </button>
                        </>
                    }
                />

                <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    {variants.map((variant) => (
                        <SummaryCard
                            key={variant.id}
                            label={`${product.has_options ? variant.label : 'In stock'}${
                                product.is_sold &&
                                variant.stock_on_hand <=
                                    product.low_stock_alert_at
                                    ? variant.stock_on_hand === 0
                                        ? ' · Out of stock'
                                        : ' · Low stock'
                                    : ''
                            }`}
                            value={formatUnits(variant.stock_on_hand, 'Piece')}
                            description={
                                variant.estore_item_code
                                    ? `eStore Item Code ${variant.estore_item_code} · Head Office sends it ${variant.sent_by ? `by the ${variant.sent_by}` : 'by the piece'}`
                                    : 'No eStore Item Code yet, so deliveries do not reach this stock.'
                            }
                            icon={Boxes}
                        />
                    ))}
                </section>

                {product.has_options && (
                    <section className="flex flex-wrap gap-2 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <VariantChip
                            active={filters.variant === null}
                            onClick={() => showVariant(null)}
                        >
                            All variants
                        </VariantChip>
                        {variants.map((variant) => (
                            <VariantChip
                                key={variant.id}
                                active={filters.variant === variant.id}
                                onClick={() => showVariant(variant.id)}
                            >
                                {variant.label}
                            </VariantChip>
                        ))}
                    </section>
                )}

                <Panel
                    title="Every Change to the Stock"
                    description="Newest first. Stock is counted in pieces."
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
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-225">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <TableHeading>When</TableHeading>
                                            {product.has_options && (
                                                <TableHeading>
                                                    Variant
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
                                                <td className="px-5 py-4 whitespace-nowrap text-slate-700">
                                                    {formatDateTime(
                                                        movement.created_at,
                                                    )}
                                                </td>
                                                {product.has_options && (
                                                    <td className="px-5 py-4 font-black text-slate-900">
                                                        {movement.variant_label}
                                                    </td>
                                                )}
                                                <td className="px-5 py-4">
                                                    <WhatHappened
                                                        movement={movement}
                                                    />
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <Change
                                                        movement={movement}
                                                    />
                                                </td>
                                                <td className="px-5 py-4 text-right font-black whitespace-nowrap text-slate-900">
                                                    {formatUnits(
                                                        movement.balance_after,
                                                        'Piece',
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 font-semibold text-slate-700">
                                                    {movement.recorded_by ??
                                                        '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

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

function VariantChip({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'rounded-xl px-4 py-2.5 text-xs font-bold transition',
                active
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
        >
            {children}
        </button>
    );
}
