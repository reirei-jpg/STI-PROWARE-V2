import { Form, useHttp, usePage } from '@inertiajs/react';
import { Ban, ClipboardList, LoaderCircle, Truck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController';
import PurchaseOrderDeliveryController from '@/actions/App/Http/Controllers/PurchaseOrderDeliveryController';
import InputError from '@/components/input-error';
import RecordDeliveryDialog from '@/components/record-delivery-dialog';
import RemindSpecialist from '@/components/remind-specialist';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDateOrdered, formatDateTime, formatPeso } from '@/lib/format';
import { formatConversion, unitWord } from '@/lib/units';
import { cn } from '@/lib/utils';
import type {
    OrderDeliveryRecord,
    PurchaseOrderDetails,
    PurchaseOrderItemDetails,
} from '@/types';

type Tab = 'items' | 'deliveries';

/**
 * The pop-up window with one purchase order, as a back-office record: the
 * order number with its category and the Specialist's actions on top, one
 * row of key facts, then the ordered items and the delivery history in two
 * tabs. The details are loaded when the window opens.
 */
export default function PurchaseOrderDetailsDialog({
    purchaseOrderId,
    onClose,
}: {
    purchaseOrderId: number | null;
    onClose: () => void;
}) {
    const { auth } = usePage().props;
    const isSpecialist = auth.user.role === 'specialist';
    const isSchoolAdmin = auth.user.role === 'school_admin';
    const http = useHttp<Record<string, never>, PurchaseOrderDetails>({});
    const [details, setDetails] = useState<PurchaseOrderDetails | null>(null);
    const [failed, setFailed] = useState(false);
    const [tab, setTab] = useState<Tab>('items');
    const [closing, setClosing] = useState(false);
    const [recording, setRecording] = useState(false);
    // Bumped after a delivery is saved, to load the order's new numbers.
    const [reloads, setReloads] = useState(0);

    useEffect(() => {
        if (purchaseOrderId === null) {
            return;
        }

        // Another order starts fresh; a reload after saving a delivery keeps
        // the window as it is.
        if (details?.id !== purchaseOrderId) {
            setDetails(null);
            setTab('items');
            setClosing(false);
        }

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
        // Load once per opened order (and after a delivery is saved);
        // `http` changes on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [purchaseOrderId, reloads]);

    const isOpen =
        details !== null &&
        (details.delivery_status === 'awaiting' ||
            details.delivery_status === 'partially_received');

    return (
        <>
            <RecordDeliveryDialog
                purchaseOrderId={recording ? purchaseOrderId : null}
                onClose={() => setRecording(false)}
                onSaved={() => {
                    setRecording(false);
                    setReloads((count) => count + 1);
                }}
            />
            <Dialog
                open={purchaseOrderId !== null}
                onOpenChange={(open) => !open && onClose()}
            >
                <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-5xl [&>button:last-child]:hidden">
                    <header className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-500">
                                eStore Purchase Order
                                {details?.category && ` · ${details.category}`}
                            </p>
                            <DialogTitle className="mt-0.5 text-xl font-bold text-slate-900">
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

                        <div className="flex shrink-0 items-center gap-2">
                            {isSpecialist && isOpen && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setRecording(true)}
                                        className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700"
                                    >
                                        <Truck size={16} />
                                        Record Delivery
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setClosing((open) => !open)
                                        }
                                        aria-expanded={closing}
                                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-black text-red-700 transition hover:bg-red-100"
                                    >
                                        <Ban size={16} />
                                        Rest won&apos;t arrive
                                    </button>
                                </>
                            )}
                            <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                                <X size={20} />
                                <span className="sr-only">Close</span>
                            </DialogClose>
                        </div>
                    </header>

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
                                <p className="mt-1 text-sm text-slate-500">
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
                                <dl className="grid border-b border-slate-200 sm:grid-cols-2 sm:gap-x-8 sm:px-6">
                                    <Fact label="Status">
                                        <span
                                            className={cn(
                                                details.delivery_status ===
                                                    'completed_short' &&
                                                    'text-red-700',
                                            )}
                                        >
                                            {details.delivery_status_label}
                                        </span>{' '}
                                        <span className="font-normal text-slate-500">
                                            (
                                            {details.quantity_received_total.toLocaleString(
                                                'en-PH',
                                            )}{' '}
                                            of{' '}
                                            {details.quantity_ordered_total.toLocaleString(
                                                'en-PH',
                                            )}
                                            , {details.percent_received}%)
                                        </span>
                                    </Fact>
                                    <Fact label="Date Ordered">
                                        {formatDateOrdered(
                                            details.date_ordered,
                                            details.time_ordered,
                                        )}
                                    </Fact>
                                    <Fact label="Total Amount">
                                        {formatPeso(
                                            details.total_amount_centavos,
                                        )}
                                    </Fact>
                                    <Fact
                                        label="Uploaded"
                                        note={`by ${details.uploaded_by}`}
                                    >
                                        {formatDateTime(details.uploaded_at)}
                                    </Fact>
                                    {details.completed_at !== null ? (
                                        <Fact
                                            label={
                                                details.delivery_status ===
                                                'completed_short'
                                                    ? 'Completed (some missing)'
                                                    : 'Completed'
                                            }
                                            note={completedAfter(
                                                details.completed_after_days,
                                            )}
                                        >
                                            {formatDateTime(
                                                details.completed_at,
                                            )}
                                        </Fact>
                                    ) : (
                                        <Fact
                                            label="Last delivery"
                                            note={
                                                details.deliveries.length === 0
                                                    ? 'Nothing has arrived yet'
                                                    : `${details.deliveries.length} ${details.deliveries.length === 1 ? 'delivery' : 'deliveries'} so far`
                                            }
                                        >
                                            {formatDateTime(
                                                details.last_delivery_at,
                                            )}
                                        </Fact>
                                    )}
                                    {details.school && (
                                        <Fact label="School">
                                            {details.school}
                                        </Fact>
                                    )}
                                    {details.ordered_by && (
                                        <Fact label="Ordered by">
                                            {details.ordered_by}
                                        </Fact>
                                    )}
                                </dl>

                                <div className="space-y-3 px-6 pt-5">
                                    {isOpen && details.is_late && (
                                        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                                            <p className="text-red-700">
                                                <b>
                                                    Late: not complete after{' '}
                                                    {details.late_days} days
                                                </b>{' '}
                                                (ordered{' '}
                                                {details.days_since_ordered}{' '}
                                                days ago). Head Office gives no
                                                delivery date.
                                            </p>
                                            {isSchoolAdmin && (
                                                <RemindSpecialist
                                                    order={{
                                                        ...details,
                                                        quantity_ordered:
                                                            details.quantity_ordered_total,
                                                        quantity_received:
                                                            details.quantity_received_total,
                                                    }}
                                                    onSent={() =>
                                                        setReloads(
                                                            (count) =>
                                                                count + 1,
                                                        )
                                                    }
                                                    className="shrink-0"
                                                />
                                            )}
                                        </div>
                                    )}

                                    {isOpen && !details.is_late && (
                                        <p className="text-sm text-slate-600">
                                            Not complete yet (ordered{' '}
                                            {details.days_since_ordered}{' '}
                                            {details.days_since_ordered === 1
                                                ? 'day'
                                                : 'days'}{' '}
                                            ago). Head Office gives no delivery
                                            date; ask them if it takes too long.
                                        </p>
                                    )}

                                    {details.closed_reason && (
                                        <p className="text-sm text-red-700">
                                            <b>Some items will not arrive.</b>{' '}
                                            Reason: {details.closed_reason}
                                        </p>
                                    )}

                                    {closing && (
                                        <CloseShortForm
                                            details={details}
                                            onCancel={() => setClosing(false)}
                                        />
                                    )}
                                </div>

                                <div className="px-6 pt-5">
                                    <div className="flex gap-6 border-b border-slate-200">
                                        <TabButton
                                            active={tab === 'items'}
                                            count={details.items.length}
                                            onClick={() => setTab('items')}
                                        >
                                            Items
                                        </TabButton>
                                        <TabButton
                                            active={tab === 'deliveries'}
                                            count={details.deliveries.length}
                                            onClick={() => setTab('deliveries')}
                                        >
                                            Delivery History
                                        </TabButton>
                                    </div>
                                </div>

                                <div className="px-6 pt-4 pb-6">
                                    {tab === 'items' ? (
                                        <ItemsTable details={details} />
                                    ) : (
                                        <DeliveryHistory details={details} />
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    <footer className="flex justify-end border-t border-slate-200 bg-slate-50/60 px-6 py-3">
                        <DialogClose className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50">
                            Close
                        </DialogClose>
                    </footer>
                </DialogContent>
            </Dialog>
        </>
    );
}

/**
 * The ordered items as a compact table: the item (code, description and
 * which product's stock it goes into), the quantities, the prices, and the
 * total at the bottom.
 */
function ItemsTable({ details }: { details: PurchaseOrderDetails }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-200 text-sm">
                <thead className="border-b border-slate-300">
                    <tr>
                        <Heading>Item</Heading>
                        <Heading right>Ordered</Heading>
                        <Heading right>Received</Heading>
                        <Heading right>Remaining</Heading>
                        <Heading right>Unit Price</Heading>
                        <Heading right>Amount</Heading>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                    {details.items.map((item) => (
                        <tr key={item.row_number} className="align-top">
                            <td className="px-4 py-3">
                                <p className="font-medium text-slate-900">
                                    {item.description}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {item.item_code}
                                </p>
                                <StockTarget item={item} />
                            </td>
                            <NumberCell>
                                <Quantity
                                    value={item.quantity_ordered}
                                    unitName={item.stock_target?.unit_name}
                                />
                            </NumberCell>
                            <NumberCell>
                                <Quantity
                                    value={item.quantity_received}
                                    unitName={item.stock_target?.unit_name}
                                />
                            </NumberCell>
                            <NumberCell
                                className={cn(
                                    item.quantity_remaining === 0 &&
                                        'text-slate-400',
                                )}
                            >
                                <Quantity
                                    value={item.quantity_remaining}
                                    unitName={item.stock_target?.unit_name}
                                />
                            </NumberCell>
                            <NumberCell>
                                {formatPeso(item.unit_price_centavos)}
                            </NumberCell>
                            <NumberCell>
                                {formatPeso(item.amount_centavos)}
                            </NumberCell>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="border-t border-slate-300">
                    <tr>
                        <td
                            colSpan={5}
                            className="px-4 py-3 text-right font-semibold text-slate-600"
                        >
                            Total Amount
                        </td>
                        <td className="px-4 py-3 text-right font-bold whitespace-nowrap text-slate-900">
                            {formatPeso(details.total_amount_centavos)}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

/**
 * One short line under an item: which product's stock it goes into and how
 * Head Office sends it, or that it is not linked to a product yet. The
 * school's stock on hand from the eStore order is added when above 0.
 */
function StockTarget({ item }: { item: PurchaseOrderItemDetails }) {
    const target = item.stock_target;
    const schoolStock =
        item.stock_on_hand !== null && item.stock_on_hand > 0
            ? ` · school stock on the order: ${item.stock_on_hand}`
            : '';

    if (!target) {
        return (
            <p className="text-xs text-slate-500">
                Not linked to a product yet{schoolStock}
            </p>
        );
    }

    const sentAs =
        target.pieces_per_unit > 1
            ? `by the ${target.unit_name} (${target.pieces_per_unit.toLocaleString('en-PH')} pcs)`
            : 'by the piece';

    return (
        <p className="text-xs text-slate-500">
            Stock of {target.product_name}
            {target.has_options && ` (${target.variant_label})`} · {sentAs}
            {schoolStock}
        </p>
    );
}

/**
 * Marking that the rest of an order will not arrive (Completed, some
 * missing), with the reason, when Head Office says so.
 */
function CloseShortForm({
    details,
    onCancel,
}: {
    details: PurchaseOrderDetails;
    onCancel: () => void;
}) {
    return (
        <Form
            {...PurchaseOrderDeliveryController.close.form(details.id)}
            options={{ preserveScroll: true }}
            className="rounded-xl border border-red-200 bg-red-50/60 p-4"
        >
            {({ processing, errors }) => (
                <>
                    <p className="text-sm font-black text-red-800">
                        {(
                            details.quantity_ordered_total -
                            details.quantity_received_total
                        ).toLocaleString('en-PH')}{' '}
                        (as ordered on the eStore) have not arrived. Will the
                        rest not come?
                    </p>
                    <p className="mt-0.5 text-sm text-red-700">
                        Use this when Head Office says the rest will not be
                        delivered. The order becomes Completed (some missing),
                        with your reason.
                    </p>
                    <label className="mt-3 grid gap-1.5">
                        <span className="text-sm font-black text-slate-700">
                            Reason
                        </span>
                        <textarea
                            name="reason"
                            required
                            rows={2}
                            maxLength={500}
                            placeholder="e.g. Head Office said the M/L polos are out of stock and will not be delivered."
                            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
                        />
                        <InputError message={errors.reason} />
                    </label>
                    <div className="mt-3 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={processing}
                            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-red-700 disabled:opacity-60"
                        >
                            {processing && (
                                <LoaderCircle
                                    size={16}
                                    className="animate-spin"
                                />
                            )}
                            Yes, rest won&apos;t arrive
                        </button>
                    </div>
                </>
            )}
        </Form>
    );
}

/** "Arrived the same day it was ordered" or "Took 2 days from the Date Ordered". */
function completedAfter(days: number | null): string | undefined {
    if (days === null) {
        return undefined;
    }

    if (days === 0) {
        return 'The same day it was ordered';
    }

    return `${days} ${days === 1 ? 'day' : 'days'} after the Date Ordered`;
}

type HistoryRow = {
    key: string;
    at: string | null;
    tone: 'plain' | 'green' | 'red';
    what: string;
    detail: string | null;
    by: string | null;
    delivery?: OrderDeliveryRecord;
};

/**
 * Everything that happened to this order as a table, oldest first, each
 * with its date and time: the upload, every delivery recorded, and when it
 * was completed (or closed with some missing). An order still open ends
 * with what is still to come.
 */
function DeliveryHistory({ details }: { details: PurchaseOrderDetails }) {
    const deliveries = [...details.deliveries].sort((a, b) =>
        (a.recorded_at ?? '').localeCompare(b.recorded_at ?? ''),
    );
    const rows: HistoryRow[] = [
        {
            key: 'uploaded',
            at: details.uploaded_at,
            tone: 'plain',
            what: 'Purchase order uploaded',
            detail: `${details.items.length} ${details.items.length === 1 ? 'item' : 'items'} · ${details.quantity_ordered_total.toLocaleString('en-PH')} as ordered on the eStore · ${formatPeso(details.total_amount_centavos)}`,
            by: details.uploaded_by,
        },
        ...deliveries.map((delivery): HistoryRow => ({
            key: `delivery-${delivery.id}`,
            at: delivery.recorded_at,
            tone: 'plain',
            what: 'Delivery recorded',
            detail: [
                `Received ${formatDateOrdered(delivery.received_on)}`,
                delivery.sales_invoice_number &&
                    `SI # ${delivery.sales_invoice_number}`,
                delivery.delivery_receipt_number &&
                    `DR # ${delivery.delivery_receipt_number}`,
            ]
                .filter(Boolean)
                .join(' · '),
            by: delivery.recorded_by,
            delivery,
        })),
    ];

    if (details.delivery_status === 'completed') {
        rows.push({
            key: 'completed',
            at: details.completed_at,
            tone: 'green',
            what: 'Completed',
            detail: `Everything arrived: ${details.quantity_received_total.toLocaleString('en-PH')} of ${details.quantity_ordered_total.toLocaleString('en-PH')} as ordered on the eStore`,
            by: deliveries.at(-1)?.recorded_by ?? null,
        });
    }

    if (details.delivery_status === 'completed_short') {
        rows.push({
            key: 'closed',
            at: details.closed_at,
            tone: 'red',
            what: 'Completed (some missing)',
            detail: [
                details.closed_reason && `“${details.closed_reason}”`,
                `${details.percent_received}% received`,
            ]
                .filter(Boolean)
                .join(' · '),
            by: details.closed_by,
        });
    }

    const stillToCome = details.items.filter(
        (item) => item.quantity_remaining > 0,
    );
    const isOpen =
        details.delivery_status === 'awaiting' ||
        details.delivery_status === 'partially_received';

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-200 text-sm">
                <thead className="border-b border-slate-300">
                    <tr>
                        <Heading>Date &amp; time</Heading>
                        <Heading>What happened</Heading>
                        <Heading>Details</Heading>
                        <Heading>By</Heading>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => (
                        <tr key={row.key} className="align-top">
                            <td className="px-4 py-3 whitespace-nowrap text-slate-800">
                                {formatDateTime(row.at)}
                            </td>
                            <td
                                className={cn(
                                    'px-4 py-3 font-semibold whitespace-nowrap',
                                    row.tone === 'red'
                                        ? 'text-red-700'
                                        : 'text-slate-900',
                                )}
                            >
                                {row.what}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                                {row.detail}
                                {row.delivery && (
                                    <DeliveredItems delivery={row.delivery} />
                                )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                                {row.by ?? '—'}
                            </td>
                        </tr>
                    ))}

                    {isOpen && stillToCome.length > 0 && (
                        <tr className="align-top">
                            <td className="px-4 py-3 text-slate-400">—</td>
                            <td className="px-4 py-3 font-semibold whitespace-nowrap text-slate-900">
                                Still to come
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                                <ul className="space-y-0.5">
                                    {stillToCome.map((item) => (
                                        <li key={item.row_number}>
                                            {item.description}:{' '}
                                            <b>
                                                <Quantity
                                                    value={
                                                        item.quantity_remaining
                                                    }
                                                    unitName={
                                                        item.stock_target
                                                            ?.unit_name
                                                    }
                                                />
                                            </b>
                                        </li>
                                    ))}
                                </ul>
                            </td>
                            <td className="px-4 py-3 text-slate-400">—</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

/** What one delivery brought, and what went into stock. */
function DeliveredItems({ delivery }: { delivery: OrderDeliveryRecord }) {
    return (
        <ul className="mt-1 space-y-1 text-sm text-slate-800">
            {delivery.items.map((item) => (
                <li key={item.item_code}>
                    {item.description}
                    {item.added_to_stock.length > 0 ? (
                        item.added_to_stock.map((added) => (
                            <span
                                key={added.product_name}
                                className="block text-xs text-slate-500"
                            >
                                {formatConversion(
                                    added.units_received,
                                    added.unit_name,
                                    added.pieces_per_unit,
                                )}{' '}
                                to the stock of {added.product_name}
                            </span>
                        ))
                    ) : (
                        <span className="block text-xs text-slate-500">
                            {item.quantity_received.toLocaleString('en-PH')}{' '}
                            received (as ordered on the eStore) · not in stock
                            yet: not linked to a product
                        </span>
                    )}
                </li>
            ))}
        </ul>
    );
}

/** One label and value in the grid under the header. */
function Fact({
    label,
    note,
    children,
}: {
    label: string;
    note?: string;
    children: ReactNode;
}) {
    return (
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-2.5 text-sm sm:px-0">
            <dt className="shrink-0 font-semibold text-slate-500">{label}</dt>
            <dd className="text-right font-semibold text-slate-900">
                {children}
                {note && (
                    <span className="block text-xs font-medium text-slate-500">
                        {note}
                    </span>
                )}
            </dd>
        </div>
    );
}

function TabButton({
    active,
    count,
    onClick,
    children,
}: {
    active: boolean;
    count: number;
    onClick: () => void;
    children: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                '-mb-px border-b-2 pb-2.5 text-sm transition',
                active
                    ? 'border-slate-900 font-bold text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
        >
            {children} ({count})
        </button>
    );
}

/**
 * A number with its unit beside it, e.g. "10 Packs" or "5 pcs"; just the
 * number for an item not linked to a product (its unit is not known).
 */
function Quantity({ value, unitName }: { value: number; unitName?: string }) {
    return (
        <span className="inline-flex items-baseline justify-end gap-1">
            {value.toLocaleString('en-PH')}
            {unitName && (
                <span className="text-xs font-bold text-slate-500">
                    {unitWord(value, unitName)}
                </span>
            )}
        </span>
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
                'px-4 py-2.5 text-xs font-semibold whitespace-nowrap text-slate-500',
                right ? 'text-right' : 'text-left',
            )}
        >
            {children}
        </th>
    );
}

function NumberCell({
    className,
    children,
}: {
    className?: string;
    children: ReactNode;
}) {
    return (
        <td
            className={cn(
                'px-4 py-3 text-right whitespace-nowrap tabular-nums',
                className,
            )}
        >
            {children}
        </td>
    );
}
