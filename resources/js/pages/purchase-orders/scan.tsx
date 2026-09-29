import { Form, Head, Link } from '@inertiajs/react';
import { CircleAlert, CircleCheck, CircleX } from 'lucide-react';
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController';
import PurchaseOrderScanController from '@/actions/App/Http/Controllers/PurchaseOrderScanController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { formatDateOrdered, formatDateTime, formatPeso } from '@/lib/format';
import type { DuplicateUpload, ScannedPurchaseOrder } from '@/types';

export default function ScanPurchaseOrder({
    scan,
    fileName,
    duplicate,
}: {
    scan: ScannedPurchaseOrder | null;
    fileName: string | null;
    duplicate: DuplicateUpload | null;
}) {
    const rowsWithWarnings = new Set(
        scan?.warnings.map((warning) => warning.row) ?? [],
    );
    const hasBlockingProblems =
        scan?.warnings.some((warning) => warning.blocking) ?? false;

    return (
        <>
            <Head title="Scan eStore PO" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <Heading
                        title="Scan eStore PO"
                        description="Upload the purchase order file from the eStore email, check what PROWARE read, then save it."
                    />
                    <Button variant="outline" asChild>
                        <Link href={PurchaseOrderController.index()}>
                            Back to Purchase Orders
                        </Link>
                    </Button>
                </div>

                <Form
                    {...PurchaseOrderScanController.store.form()}
                    className="flex max-w-xl flex-col gap-3"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="document">
                                    {scan
                                        ? 'Scan a different file'
                                        : 'Purchase order file'}
                                </Label>
                                <Input
                                    id="document"
                                    type="file"
                                    name="document"
                                    required
                                />
                                <InputError message={errors.document} />
                            </div>

                            <div>
                                <Button
                                    disabled={processing}
                                    variant={scan ? 'outline' : 'default'}
                                    data-test="scan-po-button"
                                >
                                    {processing && <Spinner />}
                                    Scan
                                </Button>
                            </div>
                        </>
                    )}
                </Form>

                {scan && (
                    <section className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h3 className="text-lg font-semibold">
                                    Scan result
                                </h3>
                                {fileName && (
                                    <p className="text-sm text-muted-foreground">
                                        {fileName}
                                    </p>
                                )}
                            </div>

                            <Form
                                {...PurchaseOrderScanController.destroy.form()}
                            >
                                {({ processing }) => (
                                    <Button
                                        variant="ghost"
                                        disabled={processing}
                                    >
                                        Discard this scan
                                    </Button>
                                )}
                            </Form>
                        </div>

                        <dl className="grid gap-4 rounded-xl border p-4 sm:grid-cols-3">
                            <div>
                                <dt className="text-sm text-muted-foreground">
                                    Date Ordered
                                </dt>
                                <dd className="font-medium">
                                    {formatDateOrdered(
                                        scan.date_ordered,
                                        scan.time_ordered,
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">
                                    Category
                                </dt>
                                <dd className="font-medium">
                                    {scan.category ?? '—'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">
                                    Total Amount (Ordered)
                                </dt>
                                <dd className="font-medium">
                                    {formatPeso(scan.total_amount_centavos)}
                                </dd>
                            </div>
                        </dl>

                        {duplicate && (
                            <Alert className="border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40">
                                <CircleX className="text-red-600" />
                                <AlertTitle>Already uploaded</AlertTitle>
                                <AlertDescription>
                                    This order was uploaded on{' '}
                                    {formatDateTime(duplicate.uploaded_at)} by{' '}
                                    {duplicate.uploaded_by}, so it can't be
                                    saved again.
                                </AlertDescription>
                            </Alert>
                        )}

                        {scan.warnings.length === 0 ? (
                            <Alert>
                                <CircleCheck className="text-green-600" />
                                <AlertTitle>Everything adds up</AlertTitle>
                                <AlertDescription>
                                    Every row was read, and the amounts match
                                    the document total.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <Alert className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40">
                                <CircleAlert className="text-amber-600" />
                                <AlertTitle>
                                    Please check {scan.warnings.length}{' '}
                                    {scan.warnings.length === 1
                                        ? 'thing'
                                        : 'things'}
                                </AlertTitle>
                                <AlertDescription>
                                    <ul className="space-y-1">
                                        {scan.warnings.map((warning, index) => (
                                            <li
                                                key={index}
                                                className="flex flex-wrap items-center gap-2"
                                            >
                                                {warning.blocking && (
                                                    <Badge variant="destructive">
                                                        Must fix
                                                    </Badge>
                                                )}
                                                <span>
                                                    {warning.row !== null &&
                                                        `Row ${warning.row}: `}
                                                    {warning.message}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="overflow-x-auto rounded-xl border">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-left text-muted-foreground">
                                    <tr>
                                        <th className="px-3 py-2">#</th>
                                        <th className="px-3 py-2">Item Code</th>
                                        <th className="px-3 py-2">
                                            Description
                                        </th>
                                        <th className="px-3 py-2 text-right">
                                            Stock on Hand
                                        </th>
                                        <th className="px-3 py-2 text-right">
                                            QTY Ordered
                                        </th>
                                        <th className="px-3 py-2 text-right">
                                            Unit Price
                                        </th>
                                        <th className="px-3 py-2 text-right">
                                            Amount
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {scan.items.map((item) => (
                                        <tr
                                            key={item.row_number}
                                            className={
                                                rowsWithWarnings.has(
                                                    item.row_number,
                                                )
                                                    ? 'border-t bg-amber-50 dark:bg-amber-950/40'
                                                    : 'border-t'
                                            }
                                        >
                                            <td className="px-3 py-2">
                                                {item.row_number}
                                            </td>
                                            <td className="px-3 py-2 font-mono">
                                                {item.item_code ?? '—'}
                                            </td>
                                            <td className="px-3 py-2">
                                                {item.description || '—'}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                {item.stock_on_hand ?? '—'}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                {item.quantity_ordered ?? '—'}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                {formatPeso(
                                                    item.unit_price_centavos,
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                {formatPeso(
                                                    item.amount_centavos,
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t font-medium">
                                        <td
                                            colSpan={6}
                                            className="px-3 py-2 text-right"
                                        >
                                            Items total
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            {formatPeso(
                                                scan.items_total_centavos,
                                            )}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {hasBlockingProblems && !duplicate && (
                            <p className="text-sm text-muted-foreground">
                                This order can't be saved until the problems
                                marked <strong>Must fix</strong> are solved.
                                Check that this is the purchase order file from
                                the eStore email.
                            </p>
                        )}

                        {!hasBlockingProblems && !duplicate && (
                            <Form
                                {...PurchaseOrderController.store.form()}
                                className="flex flex-col gap-3"
                            >
                                {({ processing, errors }) => (
                                    <>
                                        {scan.warnings.length > 0 && (
                                            <div className="grid gap-1">
                                                <div className="flex items-center gap-2">
                                                    <Checkbox
                                                        id="warnings_checked"
                                                        name="warnings_checked"
                                                    />
                                                    <Label htmlFor="warnings_checked">
                                                        I checked the warnings
                                                        above
                                                    </Label>
                                                </div>
                                                <InputError
                                                    message={
                                                        errors.warnings_checked
                                                    }
                                                />
                                            </div>
                                        )}

                                        <InputError message={errors.save} />

                                        <div>
                                            <Button
                                                disabled={processing}
                                                data-test="save-po-button"
                                            >
                                                {processing && <Spinner />}
                                                Save purchase order
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </Form>
                        )}
                    </section>
                )}
            </div>
        </>
    );
}

ScanPurchaseOrder.layout = {
    breadcrumbs: [
        {
            title: 'Purchase Orders',
            href: PurchaseOrderController.index(),
        },
        {
            title: 'Scan eStore PO',
            href: PurchaseOrderScanController.create(),
        },
    ],
};
