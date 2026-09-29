import { useHttp } from '@inertiajs/react';
import { ClipboardList, LoaderCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController';
import { TableHeading } from '@/components/panel';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDateOrdered, formatDateTime, formatPeso } from '@/lib/format';
import type { PurchaseOrderDetails } from '@/types';

/**
 * The pop-up window with every detail of one purchase order: the header
 * from the eStore document, who uploaded it, and all ordered items.
 * The details are loaded when the window opens.
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
            <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-5xl [&>button:last-child]:hidden">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                    <div>
                        <p className="text-xs font-black tracking-wide text-blue-600 uppercase">
                            eStore Purchase Order
                        </p>
                        <DialogTitle className="mt-1 text-xl font-black text-slate-900">
                            {details
                                ? `Ordered ${formatDateOrdered(details.date_ordered, details.time_ordered)}`
                                : 'Purchase Order Details'}
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            Every detail of this purchase order
                        </DialogDescription>
                    </div>

                    <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                        <X size={20} />
                        <span className="sr-only">Close</span>
                    </DialogClose>
                </div>

                <div className="overflow-y-auto">
                    {failed ? (
                        <div className="px-6 py-16 text-center">
                            <ClipboardList
                                size={44}
                                className="mx-auto text-slate-300"
                            />
                            <p className="mt-4 font-black text-slate-800">
                                The details could not be loaded
                            </p>
                            <p className="mt-2 text-sm text-slate-500">
                                Close this window and try again.
                            </p>
                        </div>
                    ) : !details ? (
                        <div className="flex items-center justify-center gap-3 px-6 py-16 text-sm font-semibold text-slate-500">
                            <LoaderCircle
                                size={20}
                                className="animate-spin text-blue-600"
                            />
                            Loading details...
                        </div>
                    ) : (
                        <>
                            <dl className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
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
                                <Detail label="Uploaded">
                                    {details.uploaded_by}
                                    <span className="mt-0.5 block text-xs font-medium text-slate-500">
                                        {formatDateTime(details.uploaded_at)}
                                    </span>
                                </Detail>
                            </dl>

                            <div className="overflow-x-auto border-t border-slate-100">
                                <table className="w-full min-w-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <TableHeading>#</TableHeading>
                                            <TableHeading>
                                                Item Code
                                            </TableHeading>
                                            <TableHeading>
                                                Description
                                            </TableHeading>
                                            <TableHeading align="right">
                                                Stock on Hand
                                            </TableHeading>
                                            <TableHeading align="right">
                                                QTY Ordered
                                            </TableHeading>
                                            <TableHeading align="right">
                                                Unit Price
                                            </TableHeading>
                                            <TableHeading align="right">
                                                Amount
                                            </TableHeading>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {details.items.map((item) => (
                                            <tr
                                                key={item.row_number}
                                                className="border-t border-slate-100 text-sm"
                                            >
                                                <td className="px-5 py-4 text-slate-500">
                                                    {item.row_number}
                                                </td>
                                                <td className="px-5 py-4 font-mono font-black text-blue-700">
                                                    {item.item_code}
                                                </td>
                                                <td className="px-5 py-4 font-semibold text-slate-900">
                                                    {item.description}
                                                </td>
                                                <td className="px-5 py-4 text-right text-slate-700">
                                                    {item.stock_on_hand ?? '—'}
                                                </td>
                                                <td className="px-5 py-4 text-right font-black text-slate-800">
                                                    {item.quantity_ordered}
                                                </td>
                                                <td className="px-5 py-4 text-right text-slate-700">
                                                    {formatPeso(
                                                        item.unit_price_centavos,
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 text-right font-black text-slate-900">
                                                    {formatPeso(
                                                        item.amount_centavos,
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t border-slate-200 bg-slate-50">
                                            <td
                                                colSpan={6}
                                                className="px-5 py-4 text-right text-xs font-black tracking-wide text-slate-500 uppercase"
                                            >
                                                Items Total
                                            </td>
                                            <td className="px-5 py-4 text-right text-base font-black text-blue-700">
                                                {formatPeso(
                                                    details.items_total_centavos,
                                                )}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex justify-end border-t border-slate-100 px-6 py-4">
                    <DialogClose className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                        Close
                    </DialogClose>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function Detail({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-2xl bg-slate-50 p-4">
            <dt className="text-xs font-bold tracking-wide text-slate-400 uppercase">
                {label}
            </dt>
            <dd className="mt-1 font-black text-slate-900">{children}</dd>
        </div>
    );
}
