import { Form, Head } from '@inertiajs/react';
import { CircleAlert, CircleCheck } from 'lucide-react';
import PurchaseOrderScanController from '@/actions/App/Http/Controllers/PurchaseOrderScanController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import type { ScannedPurchaseOrder } from '@/types';

const pesoFormatter = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

function formatPeso(centavos: number | null): string {
    return centavos === null ? '—' : pesoFormatter.format(centavos / 100);
}

function formatDateOrdered(date: string | null, time: string | null): string {
    if (date === null) {
        return '—';
    }

    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = (time ?? '00:00').split(':').map(Number);
    const value = new Date(year, month - 1, day, hours, minutes);

    return new Intl.DateTimeFormat('en-PH', {
        dateStyle: 'medium',
        ...(time !== null ? { timeStyle: 'short' } : {}),
    }).format(value);
}

export default function ScanPurchaseOrder({
    scan,
    fileName,
}: {
    scan: ScannedPurchaseOrder | null;
    fileName: string | null;
}) {
    const rowsWithWarnings = new Set(
        scan?.warnings.map((warning) => warning.row) ?? [],
    );

    return (
        <>
            <Head title="Scan eStore PO" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4">
                <Heading
                    title="Scan eStore PO"
                    description="Upload the purchase order file from the eStore email to check what PROWARE reads from it. Nothing is saved yet."
                />

                <Form
                    {...PurchaseOrderScanController.store.form()}
                    className="flex max-w-xl flex-col gap-3"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="document">
                                    Purchase order file
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
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h3 className="text-lg font-semibold">
                                Scan result
                            </h3>
                            {fileName && (
                                <span className="text-sm text-muted-foreground">
                                    {fileName}
                                </span>
                            )}
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
                                    <ul className="list-disc space-y-1 pl-4">
                                        {scan.warnings.map((warning, index) => (
                                            <li key={index}>
                                                {warning.row !== null &&
                                                    `Row ${warning.row}: `}
                                                {warning.message}
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
                                        <th className="px-3 py-2">Product</th>
                                        <th className="px-3 py-2">Program</th>
                                        <th className="px-3 py-2">Variant</th>
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
                                                <div>
                                                    {item.product_name ?? '—'}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {item.description}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2">
                                                {item.program ?? '—'}
                                            </td>
                                            <td className="px-3 py-2">
                                                {item.variant ? (
                                                    <Badge variant="secondary">
                                                        {item.variant}
                                                    </Badge>
                                                ) : (
                                                    '—'
                                                )}
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
                                            colSpan={8}
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
                    </section>
                )}
            </div>
        </>
    );
}

ScanPurchaseOrder.layout = {
    breadcrumbs: [
        {
            title: 'Scan eStore PO',
            href: PurchaseOrderScanController.create(),
        },
    ],
};
