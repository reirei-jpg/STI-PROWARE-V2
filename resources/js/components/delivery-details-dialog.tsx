import { Link } from '@inertiajs/react';
import {
    ExternalLink,
    LoaderCircle,
    Truck,
    TriangleAlert,
    X,
} from 'lucide-react';
import ItemLinkController from '@/actions/App/Http/Controllers/ItemLinkController';
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController';
import { DeliveryStatusBadge } from '@/components/delivery-progress';
import { TableHeading } from '@/components/panel';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDateOrdered, formatDateTime } from '@/lib/format';
import { formatUnits } from '@/lib/units';
import type { DeliveryDetails } from '@/types';

/**
 * One recorded delivery, opened with View Details: when it arrived and its
 * receipt numbers, each item that arrived (the product and size it went
 * into, or that it still needs linking), and the orders it belongs to with
 * how far along they are now.
 */
export default function DeliveryDetailsDialog({
    open,
    details,
    canLink,
    onClose,
}: {
    open: boolean;
    /** Undefined while it loads. */
    details: DeliveryDetails | null | undefined;
    /** Only the Specialist links items to products. */
    canLink: boolean;
    onClose: () => void;
}) {
    const notLinked =
        details?.items.filter((item) => item.product === null).length ?? 0;

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-3xl [&>button:last-child]:hidden">
                {!details ? (
                    <div className="flex flex-col items-center gap-3 px-6 py-16 text-sm font-bold text-slate-500">
                        <DialogTitle className="sr-only">
                            Delivery details
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            Loading
                        </DialogDescription>
                        {details === null ? (
                            'This delivery was not found.'
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
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                                    <Truck size={22} />
                                </span>
                                <div>
                                    <DialogTitle className="text-lg font-black text-slate-900">
                                        Delivery of{' '}
                                        {formatDateOrdered(details.received_on)}
                                    </DialogTitle>
                                    <DialogDescription className="text-sm text-slate-500">
                                        Recorded by {details.recorded_by} ·{' '}
                                        {formatDateTime(details.recorded_at)}
                                    </DialogDescription>
                                </div>
                            </div>
                            <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                                <X size={20} />
                                <span className="sr-only">Close</span>
                            </DialogClose>
                        </div>

                        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
                            <dl className="grid gap-3 sm:grid-cols-3">
                                <Fact label="SI # (Sales Invoice)">
                                    {details.sales_invoice_number}
                                </Fact>
                                <Fact label="DR # (Delivery Receipt)">
                                    {details.delivery_receipt_number}
                                </Fact>
                                <Fact label="Note">{details.note}</Fact>
                            </dl>

                            {notLinked > 0 && (
                                <p className="flex items-start gap-2 rounded-xl border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                                    <TriangleAlert
                                        size={18}
                                        className="mt-0.5 shrink-0"
                                    />
                                    <span>
                                        {notLinked === 1
                                            ? '1 item is'
                                            : `${notLinked} items are`}{' '}
                                        not in stock yet, because{' '}
                                        {notLinked === 1 ? 'it is' : 'they are'}{' '}
                                        not linked to a product.{' '}
                                        {canLink && (
                                            <Link
                                                href={ItemLinkController.index()}
                                                className="font-black underline"
                                            >
                                                Link{' '}
                                                {notLinked === 1
                                                    ? 'it'
                                                    : 'them'}{' '}
                                                in Items to Link
                                            </Link>
                                        )}
                                    </span>
                                </p>
                            )}

                            <section>
                                <h3 className="text-xs font-black tracking-wide text-slate-400 uppercase">
                                    Items that arrived ({details.items.length})
                                </h3>
                                <div className="mt-2 overflow-x-auto rounded-2xl border border-slate-200">
                                    <table className="w-full min-w-160 text-sm">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <TableHeading>
                                                    Item
                                                </TableHeading>
                                                <TableHeading>
                                                    Went into
                                                </TableHeading>
                                                <TableHeading align="right">
                                                    As ordered
                                                </TableHeading>
                                                <TableHeading align="right">
                                                    Added to stock
                                                </TableHeading>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {details.items.map((item) => (
                                                <tr
                                                    key={item.id}
                                                    className="border-t border-slate-100 align-top"
                                                >
                                                    <td className="px-5 py-3">
                                                        <p className="font-mono text-xs font-black text-blue-700">
                                                            {item.item_code}
                                                        </p>
                                                        <p className="mt-0.5 text-slate-700">
                                                            {item.description}
                                                        </p>
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        {item.product ?? (
                                                            <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800">
                                                                Not linked yet
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3 text-right font-bold text-slate-700">
                                                        {item.quantity_received.toLocaleString(
                                                            'en-PH',
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3 text-right font-black text-emerald-700">
                                                        {item.pieces_added > 0
                                                            ? `+${formatUnits(item.pieces_added, 'Piece')}`
                                                            : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-xs font-black tracking-wide text-slate-400 uppercase">
                                    Orders it belongs to
                                </h3>
                                <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200">
                                    {details.orders.map((order) => (
                                        <li
                                            key={order.id}
                                            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                                        >
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-mono font-black text-slate-900">
                                                    {order.order_number
                                                        ? `#${order.order_number}`
                                                        : 'No order #'}
                                                </span>
                                                <DeliveryStatusBadge
                                                    status={
                                                        order.delivery_status
                                                    }
                                                    label={
                                                        order.delivery_status_label
                                                    }
                                                />
                                                <span className="text-slate-500">
                                                    {order.quantity_remaining >
                                                    0
                                                        ? `${order.percent_received}% received · ${order.quantity_remaining.toLocaleString('en-PH')} still to come`
                                                        : 'Everything arrived'}
                                                </span>
                                            </div>
                                            <Link
                                                href={PurchaseOrderController.index(
                                                    {
                                                        query: {
                                                            view: order.id,
                                                        },
                                                    },
                                                )}
                                                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100"
                                            >
                                                <ExternalLink size={14} />
                                                Open purchase order
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
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

function Fact({ label, children }: { label: string; children: string | null }) {
    return (
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <dt className="text-[11px] font-black tracking-wide text-slate-400 uppercase">
                {label}
            </dt>
            <dd
                className={`mt-0.5 text-sm font-bold break-words ${children ? 'text-slate-900' : 'text-slate-400'}`}
            >
                {children ?? 'None given'}
            </dd>
        </div>
    );
}
