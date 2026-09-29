import { Form, Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    CircleAlert,
    CircleCheck,
    CircleX,
    FileScan,
    LoaderCircle,
    Save,
    Trash2,
    UploadCloud,
} from 'lucide-react';
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController';
import PurchaseOrderScanController from '@/actions/App/Http/Controllers/PurchaseOrderScanController';
import InputError from '@/components/input-error';
import PageHeader from '@/components/page-header';
import Panel, { TableHeading } from '@/components/panel';
import { Checkbox } from '@/components/ui/checkbox';
import { formatDateOrdered, formatDateTime, formatPeso } from '@/lib/format';
import type { DuplicateUpload, ScannedPurchaseOrder } from '@/types';

const primaryButtonClasses =
    'inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60';

const secondaryButtonClasses =
    'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60';

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

            <div className="space-y-7">
                <PageHeader
                    title="Scan eStore PO"
                    description="Upload the purchase order file from the eStore email, check what PROWARE read, then save it."
                    actions={
                        <Link
                            href={PurchaseOrderController.index()}
                            className={secondaryButtonClasses}
                        >
                            <ArrowLeft size={18} />
                            Back to Purchase Orders
                        </Link>
                    }
                />

                <Panel
                    title={scan ? 'Scan a Different File' : 'Upload PO File'}
                    description="Any file can be chosen. PROWARE reads the Word file (.docx) sent by the eStore. Maximum 5 MB."
                >
                    <Form
                        {...PurchaseOrderScanController.store.form()}
                        className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start"
                    >
                        {({ processing, errors }) => (
                            <>
                                <div className="flex-1">
                                    <label
                                        htmlFor="document"
                                        className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-blue-300 hover:bg-blue-50/40"
                                    >
                                        <UploadCloud
                                            size={22}
                                            className="shrink-0 text-blue-600"
                                        />
                                        <input
                                            id="document"
                                            type="file"
                                            name="document"
                                            required
                                            className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-100 file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-blue-700"
                                        />
                                    </label>
                                    <InputError
                                        message={errors.document}
                                        className="mt-2"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={processing}
                                    className={
                                        scan
                                            ? secondaryButtonClasses
                                            : primaryButtonClasses
                                    }
                                    data-test="scan-po-button"
                                >
                                    {processing ? (
                                        <LoaderCircle
                                            size={18}
                                            className="animate-spin"
                                        />
                                    ) : (
                                        <FileScan size={18} />
                                    )}
                                    {processing ? 'Scanning...' : 'Scan'}
                                </button>
                            </>
                        )}
                    </Form>
                </Panel>

                {scan && (
                    <>
                        {duplicate && (
                            <Notice
                                tone="red"
                                icon={CircleX}
                                title="Already uploaded"
                            >
                                This order was uploaded on{' '}
                                {formatDateTime(duplicate.uploaded_at)} by{' '}
                                {duplicate.uploaded_by}, so it can't be saved
                                again.
                            </Notice>
                        )}

                        {scan.warnings.length === 0 ? (
                            <Notice
                                tone="green"
                                icon={CircleCheck}
                                title="Everything adds up"
                            >
                                Every row was read, and the amounts match the
                                document total.
                            </Notice>
                        ) : (
                            <Notice
                                tone="amber"
                                icon={CircleAlert}
                                title={`Please check ${scan.warnings.length} ${scan.warnings.length === 1 ? 'thing' : 'things'}`}
                            >
                                <ul className="mt-1 space-y-1.5">
                                    {scan.warnings.map((warning, index) => (
                                        <li
                                            key={index}
                                            className="flex flex-wrap items-center gap-2"
                                        >
                                            {warning.blocking && (
                                                <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-black text-red-700 uppercase">
                                                    Must fix
                                                </span>
                                            )}
                                            <span>
                                                {warning.row !== null &&
                                                    `Row ${warning.row}: `}
                                                {warning.message}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </Notice>
                        )}

                        <Panel
                            title="Scan Result"
                            description={fileName ?? undefined}
                            actions={
                                <Form
                                    {...PurchaseOrderScanController.destroy.form()}
                                >
                                    {({ processing }) => (
                                        <button
                                            type="submit"
                                            disabled={processing}
                                            className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                                        >
                                            <Trash2 size={15} />
                                            Discard this scan
                                        </button>
                                    )}
                                </Form>
                            }
                        >
                            <dl className="grid gap-4 border-b border-slate-100 p-6 sm:grid-cols-3">
                                <Detail label="Date Ordered">
                                    {formatDateOrdered(
                                        scan.date_ordered,
                                        scan.time_ordered,
                                    )}
                                </Detail>
                                <Detail label="Category">
                                    {scan.category ?? '—'}
                                </Detail>
                                <Detail label="Total Amount (Ordered)">
                                    {formatPeso(scan.total_amount_centavos)}
                                </Detail>
                            </dl>

                            <div className="overflow-x-auto">
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
                                        {scan.items.map((item) => (
                                            <tr
                                                key={item.row_number}
                                                className={`border-t border-slate-100 text-sm ${
                                                    rowsWithWarnings.has(
                                                        item.row_number,
                                                    )
                                                        ? 'bg-amber-50'
                                                        : ''
                                                }`}
                                            >
                                                <td className="px-5 py-4 text-slate-500">
                                                    {item.row_number}
                                                </td>
                                                <td className="px-5 py-4 font-mono font-black text-blue-700">
                                                    {item.item_code ?? '—'}
                                                </td>
                                                <td className="px-5 py-4 font-semibold text-slate-900">
                                                    {item.description || '—'}
                                                </td>
                                                <td className="px-5 py-4 text-right text-slate-700">
                                                    {item.stock_on_hand ?? '—'}
                                                </td>
                                                <td className="px-5 py-4 text-right font-black text-slate-800">
                                                    {item.quantity_ordered ??
                                                        '—'}
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
                                                    scan.items_total_centavos,
                                                )}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            <div className="border-t border-slate-100 p-6">
                                {duplicate ? (
                                    <p className="text-sm text-slate-500">
                                        This order is already in PROWARE, so
                                        there is nothing to save.
                                    </p>
                                ) : hasBlockingProblems ? (
                                    <p className="text-sm text-slate-500">
                                        This order can't be saved until the
                                        problems marked{' '}
                                        <strong className="text-red-700">
                                            Must fix
                                        </strong>{' '}
                                        are solved. Check that this is the
                                        purchase order file from the eStore
                                        email.
                                    </p>
                                ) : (
                                    <Form
                                        {...PurchaseOrderController.store.form()}
                                        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        {({ processing, errors }) => (
                                            <>
                                                <div className="space-y-1">
                                                    {scan.warnings.length >
                                                        0 && (
                                                        <label
                                                            htmlFor="warnings_checked"
                                                            className="flex items-center gap-2 text-sm font-semibold text-slate-700"
                                                        >
                                                            <Checkbox
                                                                id="warnings_checked"
                                                                name="warnings_checked"
                                                            />
                                                            I checked the
                                                            warnings above
                                                        </label>
                                                    )}
                                                    <InputError
                                                        message={
                                                            errors.warnings_checked
                                                        }
                                                    />
                                                    <InputError
                                                        message={errors.save}
                                                    />
                                                </div>

                                                <button
                                                    type="submit"
                                                    disabled={processing}
                                                    className={
                                                        primaryButtonClasses
                                                    }
                                                    data-test="save-po-button"
                                                >
                                                    {processing ? (
                                                        <LoaderCircle
                                                            size={18}
                                                            className="animate-spin"
                                                        />
                                                    ) : (
                                                        <Save size={18} />
                                                    )}
                                                    {processing
                                                        ? 'Saving...'
                                                        : 'Save Purchase Order'}
                                                </button>
                                            </>
                                        )}
                                    </Form>
                                )}
                            </div>
                        </Panel>
                    </>
                )}
            </div>
        </>
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

const noticeTones = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800 [&_svg]:text-emerald-600',
    amber: 'border-amber-200 bg-amber-50 text-amber-900 [&_svg]:text-amber-600',
    red: 'border-red-200 bg-red-50 text-red-800 [&_svg]:text-red-600',
};

function Notice({
    tone,
    icon: Icon,
    title,
    children,
}: {
    tone: keyof typeof noticeTones;
    icon: typeof CircleCheck;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div
            role="status"
            className={`flex items-start gap-4 rounded-3xl border p-5 ${noticeTones[tone]}`}
        >
            <Icon size={22} className="mt-0.5 shrink-0" />
            <div className="min-w-0 text-sm leading-6">
                <p className="text-base font-black">{title}</p>
                <div className="mt-1">{children}</div>
            </div>
        </div>
    );
}
