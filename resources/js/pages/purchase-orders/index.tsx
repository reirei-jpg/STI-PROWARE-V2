import { Head, Link } from '@inertiajs/react';
import { Download, FileScan } from 'lucide-react';
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController';
import PurchaseOrderScanController from '@/actions/App/Http/Controllers/PurchaseOrderScanController';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { formatDateOrdered, formatDateTime, formatPeso } from '@/lib/format';
import type { Paginated, PurchaseOrderSummary } from '@/types';

export default function PurchaseOrdersIndex({
    purchaseOrders,
}: {
    purchaseOrders: Paginated<PurchaseOrderSummary>;
}) {
    return (
        <>
            <Head title="Purchase Orders" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <Heading
                        title="Purchase Orders"
                        description="Orders placed in the eStore and uploaded to PROWARE."
                    />
                    <Button asChild>
                        <Link href={PurchaseOrderScanController.create()}>
                            <FileScan />
                            Scan eStore PO
                        </Link>
                    </Button>
                </div>

                {purchaseOrders.data.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-8 text-center">
                        <p className="font-medium">No purchase orders yet</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Upload the purchase order file from an eStore email
                            to add the first one.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-left text-muted-foreground">
                                <tr>
                                    <th className="px-3 py-2">Date Ordered</th>
                                    <th className="px-3 py-2">Category</th>
                                    <th className="px-3 py-2 text-right">
                                        Items
                                    </th>
                                    <th className="px-3 py-2 text-right">
                                        Total Amount
                                    </th>
                                    <th className="px-3 py-2">Uploaded</th>
                                    <th className="px-3 py-2">File</th>
                                </tr>
                            </thead>
                            <tbody>
                                {purchaseOrders.data.map((purchaseOrder) => (
                                    <tr
                                        key={purchaseOrder.id}
                                        className="border-t"
                                    >
                                        <td className="px-3 py-2 font-medium">
                                            {formatDateOrdered(
                                                purchaseOrder.date_ordered,
                                            )}
                                        </td>
                                        <td className="px-3 py-2">
                                            {purchaseOrder.category ?? '—'}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            {purchaseOrder.items_count}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            {formatPeso(
                                                purchaseOrder.total_amount_centavos,
                                            )}
                                        </td>
                                        <td className="px-3 py-2">
                                            <div>
                                                {formatDateTime(
                                                    purchaseOrder.uploaded_at,
                                                )}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                by {purchaseOrder.uploaded_by}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2">
                                            <a
                                                href={
                                                    PurchaseOrderController.document(
                                                        purchaseOrder.id,
                                                    ).url
                                                }
                                                className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                                            >
                                                <Download className="size-4" />
                                                {
                                                    purchaseOrder.original_file_name
                                                }
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {purchaseOrders.last_page > 1 && (
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                            Page {purchaseOrders.current_page} of{' '}
                            {purchaseOrders.last_page}
                        </span>
                        <div className="flex gap-2">
                            {purchaseOrders.prev_page_url && (
                                <Button variant="outline" size="sm" asChild>
                                    <Link href={purchaseOrders.prev_page_url}>
                                        Previous
                                    </Link>
                                </Button>
                            )}
                            {purchaseOrders.next_page_url && (
                                <Button variant="outline" size="sm" asChild>
                                    <Link href={purchaseOrders.next_page_url}>
                                        Next
                                    </Link>
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

PurchaseOrdersIndex.layout = {
    breadcrumbs: [
        {
            title: 'Purchase Orders',
            href: PurchaseOrderController.index(),
        },
    ],
};
