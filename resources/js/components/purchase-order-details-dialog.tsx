import { useHttp } from '@inertiajs/react';
import { ClipboardList, LoaderCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDateOrdered, formatDateTime, formatPeso } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PurchaseOrderDetails } from '@/types';

/**
 * The pop-up window with every detail of one purchase order: the header
 * from the eStore document, who uploaded it, and all ordered items.
 * The details are loaded when the window opens.
 *
 * Every section uses the same side padding (px-8) so the edges line up.
 */
export default function PurchaseOrderDetailsDialog({
    purchaseOrderId,
    onClose,
}: {
    purchaseOrderId: number | null;
    onClose: () => void;
}) {
    const http = useHttp<Record<string, never>, PurchaseOrderDetails>({});
    const [details, setDetails] = useState<PurchaseOrderDetails | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (purchaseOrderId === null) {
            return;
        }

        setDetails(null);
        setFailed(false);

        void http
            .get(PurchaseOrderController.show(purchaseOrderId).url, {
                onSuccess: (response) => setDetails(response),
                onHttpException: () => {
                    setFailed(true);

                    return false;
                },
                onNetworkError: () => {
                    setFailed(true);

                    return false;
                },
            })
            .catch(() => setFailed(true));
        // Load once per opened order; `http` changes on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [purchaseOrderId]);

    return (
        <Dialog
            open={purchaseOrderId !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-6xl [&>button:last-child]:hidden">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-8 py-6">
                    <div>
                        <p className="text-sm font-black tracking-wide text-blue-600 uppercase">
                            eStore Purchase Order
                        </p>
                        <DialogTitle className="mt-1 text-2xl font-black text-slate-900">
                            {details
                                ? details.order_number
                                    ? `Order #${details.order_number}`
                                    : `Ordered ${formatDateOrdered(details.date_ordered, details.time_ordered)}`
                                : 'Purchase Order Details'}
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            Every detail of this purchase order
                        </DialogDescription>
                    </div>

                    <DialogClose className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                        <X size={22} />
                        <span className="sr-only">Close</span>
                    </DialogClose>
                </div>

                <div className="overflow-y-auto">
                    {failed ? (
                        <div className="px-8 py-20 text-center">
                            <ClipboardList
                                size={48}
                                className="mx-auto text-slate-300"
                            />
                            <p className="mt-4 text-lg font-black text-slate-800">
                                The details could not be loaded
                            </p>
                            <p className="mt-2 text-base text-slate-500">
                                Close this window and try again.
                            </p>
                        </div>
                    ) : !details ? (
                        <div className="flex items-center justify-center gap-3 px-8 py-20 text-base font-semibold text-slate-500">
                            <LoaderCircle
                                size={22}
                                className="animate-spin text-blue-600"
                            />
                            Loading details...
                        </div>
                    ) : (
                        <>
                            <dl className="grid auto-rows-fr gap-5 px-8 py-6 sm:grid-cols-2 lg:grid-cols-3">
                                <Detail label="School">
                                    {details.school ?? '—'}
                                </Detail>
                                <Detail label="Ordered by">
                                    {details.ordered_by ?? '—'}
                                </Detail>
                                <Detail label="Date Ordered">
                                    {formatDateOrdered(
                                        details.date_ordered,
                                        details.time_ordered,
                                    )}
                                </Detail>
                                <Detail label="Category">
                                    {details.category ?? '—'}
                                </Detail>
                                <Detail label="Total Amount (Ordered)">
                                    {formatPeso(details.total_amount_centavos)}
                                </Detail>
                                <Detail
                                    label="Uploaded By"
                                    note={formatDateTime(details.uploaded_at)}
                                >
                                    {details.uploaded_by}
                                </Detail>
                            </dl>

                            <div className="overflow-x-auto border-t border-slate-100">
                                <table className="w-full min-w-225">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <Heading>#</Heading>
                                            <Heading>Item Code</Heading>
                                            <Heading>Description</Heading>
                                            <Heading right>
                                                Stock on Hand (School)
                                            </Heading>
                                            <Heading right>QTY Ordered</Heading>
                                            <Heading right>Unit Price</Heading>
                                            <Heading right>Amount</Heading>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {details.items.map((item) => (
                                            <tr
                                                key={item.row_number}
                                                className="border-t border-slate-100 text-base"
                                            >
                                                <Cell className="text-slate-500">
                                                    {item.row_number}
                                                </Cell>
                                                <Cell className="font-mono font-black text-blue-700">
                                                    {item.item_code}
                                                </Cell>
                                                <Cell className="font-semibold text-slate-900">
                                                    {item.description}
                                                </Cell>
                                                <Cell
                                                    right
                                                    className="text-slate-700"
                                                >
                                                    {item.stock_on_hand ?? '—'}
                                                </Cell>
                                                <Cell
                                                    right
                                                    className="font-black text-slate-800"
                                                >
                                                    {item.quantity_ordered}
                                                </Cell>
                                                <Cell
                                                    right
                                                    className="text-slate-700"
                                                >
                                                    {formatPeso(
                                                        item.unit_price_centavos,
                                                    )}
                                                </Cell>
                                                <Cell
                                                    right
                                                    className="font-black text-slate-900"
                                                >
                                                    {formatPeso(
                                                        item.amount_centavos,
                                                    )}
                                                </Cell>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex justify-end border-t border-slate-100 px-8 py-5">
                    <DialogClose className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-base font-black text-slate-700 transition hover:bg-slate-50">
                        Close
                    </DialogClose>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/**
 * One of the four equal boxes at the top of the window.
 */
function Detail({
    label,
    note,
    children,
}: {
    label: string;
    note?: string;
    children: ReactNode;
}) {
    return (
        <div className="flex flex-col rounded-2xl bg-slate-50 p-5">
            <dt className="text-sm font-bold tracking-wide text-slate-400 uppercase">
                {label}
            </dt>
            <dd className="mt-2 text-lg font-black text-slate-900">
                {children}
            </dd>
            {note && (
                <dd className="mt-1 text-sm font-medium text-slate-500">
                    {note}
                </dd>
            )}
        </div>
    );
}

function Heading({
    right = false,
    children,
}: {
    right?: boolean;
    children: ReactNode;
}) {
    return (
        <th
            className={cn(
                'px-8 py-4 text-sm font-black tracking-wide whitespace-nowrap text-slate-400 uppercase',
                right ? 'text-right' : 'text-left',
            )}
        >
            {children}
        </th>
    );
}

function Cell({
    right = false,
    className,
    children,
}: {
    right?: boolean;
    className?: string;
    children: ReactNode;
}) {
    return (
        <td className={cn('px-8 py-5', right && 'text-right', className)}>
            {children}
        </td>
    );
}
