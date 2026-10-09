import { LoaderCircle, Tag, TrendingUp, X } from 'lucide-react';
import { TableHeading } from '@/components/panel';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDateTime, formatPeso } from '@/lib/format';
import { formatUnits } from '@/lib/units';
import { cn } from '@/lib/utils';
import type { ProductSalesDetails } from '@/types';

/**
 * One product's (size or color's) sales in the period, opened with View
 * Details: its totals, then each release (order, date, student, how many,
 * the price paid against the normal price when it was on sale, what the
 * pieces cost on the eStore, and the profit).
 */
export default function ProductSalesDialog({
    open,
    details,
    periodText,
    onClose,
}: {
    open: boolean;
    /** Undefined while it loads. */
    details: ProductSalesDetails | null | undefined;
    periodText: string;
    onClose: () => void;
}) {
    const product = details?.product ?? null;

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-4xl [&>button:last-child]:hidden">
                {!details || !product ? (
                    <div className="flex flex-col items-center gap-3 px-6 py-16 text-sm font-bold text-slate-500">
                        <DialogTitle className="sr-only">
                            Product sales
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            Loading
                        </DialogDescription>
                        {details ? (
                            'No sales of this product in the period.'
                        ) : (
                            <>
                                <LoaderCircle
                                    size={28}
                                    className="animate-spin text-blue-600"
                                />
                                Loading…
                            </>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                            <div className="flex items-start gap-3">
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                                    <TrendingUp size={22} />
                                </span>
                                <div>
                                    <DialogTitle className="text-lg font-black text-slate-900">
                                        {product.product_name}
                                        {product.variant_label && (
                                            <span className="font-bold text-slate-500">
                                                {' '}
                                                · {product.variant_label}
                                            </span>
                                        )}
                                    </DialogTitle>
                                    <DialogDescription className="text-sm text-slate-500">
                                        Sales {periodText}
                                    </DialogDescription>
                                </div>
                            </div>
                            <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                                <X size={20} />
                                <span className="sr-only">Close</span>
                            </DialogClose>
                        </div>

                        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
                            <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
                                <Figure label="Sold">
                                    {formatUnits(product.pieces, 'Piece')}
                                </Figure>
                                <Figure label="Sales">
                                    {formatPeso(product.sales_centavos)}
                                </Figure>
                                <Figure label="eStore cost">
                                    {formatPeso(product.cost_centavos)}
                                </Figure>
                                <Figure
                                    label="Profit"
                                    tone={
                                        product.profit_centavos < 0
                                            ? 'red'
                                            : 'green'
                                    }
                                >
                                    {formatPeso(product.profit_centavos)}
                                </Figure>
                            </dl>

                            <section>
                                <h3 className="text-xs font-black tracking-wide text-slate-400 uppercase">
                                    Releases ({details.releases_count})
                                    {details.releases_count >
                                        details.releases.length &&
                                        ` · the newest ${details.releases.length}`}
                                </h3>
                                <div className="mt-2 overflow-x-auto rounded-2xl border border-slate-200">
                                    <table className="w-full min-w-200 text-sm">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <TableHeading>
                                                    Order
                                                </TableHeading>
                                                <TableHeading>
                                                    Student
                                                </TableHeading>
                                                <TableHeading align="right">
                                                    Qty
                                                </TableHeading>
                                                <TableHeading align="right">
                                                    Price Paid
                                                </TableHeading>
                                                <TableHeading align="right">
                                                    Total
                                                </TableHeading>
                                                <TableHeading align="right">
                                                    eStore Cost
                                                </TableHeading>
                                                <TableHeading align="right">
                                                    Profit
                                                </TableHeading>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {details.releases.map((release) => (
                                                <tr
                                                    key={`${release.order_id}-${release.unit_name}`}
                                                    className="border-t border-slate-100 align-top"
                                                >
                                                    <td className="px-5 py-3">
                                                        <p className="font-mono text-xs font-black text-blue-700">
                                                            {
                                                                release.order_number
                                                            }
                                                        </p>
                                                        <p className="mt-0.5 text-xs text-slate-500">
                                                            {formatDateTime(
                                                                release.released_at,
                                                            )}
                                                        </p>
                                                    </td>
                                                    <td className="px-5 py-3 text-slate-700">
                                                        {release.student_name}
                                                    </td>
                                                    <td className="px-5 py-3 text-right font-bold whitespace-nowrap text-slate-700">
                                                        {formatUnits(
                                                            release.quantity,
                                                            release.unit_name,
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3 text-right whitespace-nowrap">
                                                        {release.on_sale &&
                                                            release.normal_unit_price_centavos !==
                                                                null && (
                                                                <span className="mr-1.5 text-xs text-slate-400 line-through">
                                                                    {formatPeso(
                                                                        release.normal_unit_price_centavos,
                                                                    )}
                                                                </span>
                                                            )}
                                                        <span
                                                            className={cn(
                                                                'font-black',
                                                                release.on_sale
                                                                    ? 'text-red-600'
                                                                    : 'text-slate-900',
                                                            )}
                                                        >
                                                            {formatPeso(
                                                                release.unit_price_centavos,
                                                            )}
                                                        </span>
                                                        {release.on_sale && (
                                                            <span className="mt-0.5 flex items-center justify-end gap-1 text-[11px] font-black text-red-600">
                                                                <Tag
                                                                    size={11}
                                                                />
                                                                On sale
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3 text-right font-black text-slate-900">
                                                        {formatPeso(
                                                            release.line_total_centavos,
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3 text-right text-slate-700">
                                                        {release.cost_centavos ===
                                                        null ? (
                                                            <span className="text-xs font-bold text-amber-700">
                                                                No eStore price
                                                            </span>
                                                        ) : (
                                                            formatPeso(
                                                                release.cost_centavos,
                                                            )
                                                        )}
                                                    </td>
                                                    <td
                                                        className={cn(
                                                            'px-5 py-3 text-right font-black',
                                                            release.profit_centavos ===
                                                                null
                                                                ? 'text-slate-300'
                                                                : release.profit_centavos <
                                                                    0
                                                                  ? 'text-red-600'
                                                                  : 'text-emerald-700',
                                                        )}
                                                    >
                                                        {release.profit_centavos ===
                                                        null
                                                            ? '—'
                                                            : formatPeso(
                                                                  release.profit_centavos,
                                                              )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        </div>

                        <div className="flex justify-end border-t border-slate-100 px-6 py-4">
                            <DialogClose className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                                Close
                            </DialogClose>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

function Figure({
    label,
    tone,
    children,
}: {
    label: string;
    tone?: 'green' | 'red';
    children: string;
}) {
    return (
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <dt className="text-[11px] font-black tracking-wide text-slate-400 uppercase">
                {label}
            </dt>
            <dd
                className={cn(
                    'mt-0.5 text-lg font-black',
                    tone === 'green' && 'text-emerald-700',
                    tone === 'red' && 'text-red-600',
                    !tone && 'text-slate-900',
                )}
            >
                {children}
            </dd>
        </div>
    );
}
