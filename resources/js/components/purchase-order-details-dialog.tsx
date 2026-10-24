import { Form, useHttp, usePage } from '@inertiajs/react';
import {
    Ban,
    CircleAlert,
    ClipboardList,
    History,
    LoaderCircle,
    Package,
    Truck,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController';
import PurchaseOrderDeliveryController from '@/actions/App/Http/Controllers/PurchaseOrderDeliveryController';
import DeliveryProgress from '@/components/delivery-progress';
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
                            <p className="text-xs font-black tracking-wide text-blue-600 uppercase">
                                eStore Purchase Order
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                <DialogTitle className="text-xl font-black text-slate-900">
                                    {details
                                        ? details.order_number
                                            ? `Order #${details.order_number}`
                                            : `Ordered ${formatDateOrdered(details.date_ordered, details.time_ordered)}`
                                        : 'Purchase Order Details'}
                                </DialogTitle>
                                {details?.category && (
                                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700 ring-1 ring-blue-100">
                                        {details.category}
                                    </span>
                                )}
                            </div>
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
                                <dl className="grid grid-cols-2 divide-slate-100 border-b border-slate-200 bg-slate-50/60 lg:grid-cols-4 lg:divide-x">
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
                                    <Fact label="Delivery">
                                        <DeliveryProgress
                                            progress={details}
                                            className="w-full max-w-56"
                                        />
                                    </Fact>
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
                                        <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
                                            <p className="flex items-start gap-2">
                                                <CircleAlert
                                                    size={16}
                                                    className="mt-0.5 shrink-0"
                                                />
                                                <span>
                                                    <b>
                                                        Late · not complete
                                                        after{' '}
                                                        {details.late_days} days
                                                        (ordered{' '}
                                                        {
                                                            details.days_since_ordered
                                                        }{' '}
                                                        days ago).
                                                    </b>{' '}
                                                    Head Office gives no
                                                    delivery date.
                                                </span>
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
                                        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
                                            <CircleAlert
                                                size={16}
                                                className="mt-0.5 shrink-0"
                                            />
                                            <span>
                                                <b>
                                                    Not complete yet · ordered{' '}
                                                    {details.days_since_ordered}{' '}
                                                    {details.days_since_ordered ===
                                                    1
                                                        ? 'day'
                                                        : 'days'}{' '}
                                                    ago.
                                                </b>{' '}
                                                Head Office gives no delivery
                                                date; ask them if it takes too
                                                long.
                                            </span>
                                        </p>
                                    )}

                                    {details.closed_reason && (
                                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                                            <p className="font-black">
                                                Completed (some missing)
                                                {details.closed_by &&
                                                    ` by ${details.closed_by}`}
                                                {details.closed_at &&
                                                    ` on ${formatDateTime(details.closed_at)}`}
                                            </p>
                                            <p className="mt-0.5">
                                                Reason: {details.closed_reason}
                                            </p>
                                        </div>
                                    )}

                                    {closing && (
                                        <CloseShortForm
                                            details={details}
                                            onCancel={() => setClosing(false)}
                                        />
                                    )}
                                </div>

                                <div className="px-6 pt-5">
                                    <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                                        <TabButton
                                            active={tab === 'items'}
                                            icon={<Package size={16} />}
                                            count={details.items.length}
                                            onClick={() => setTab('items')}
                                        >
                                            Items
                                        </TabButton>
                                        <TabButton
                                            active={tab === 'deliveries'}
                                            icon={<History size={16} />}
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
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-200 text-sm">
                <thead className="bg-slate-50">
                    <tr>
                        <Heading>Item</Heading>
                        <Heading right>Ordered</Heading>
                        <Heading right>Received</Heading>
                        <Heading right>Remaining</Heading>
                        <Heading right>Unit Price</Heading>
                        <Heading right>Amount</Heading>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {details.items.map((item) => (
                        <tr key={item.row_number} className="align-top">
                            <td className="px-4 py-3">
                                <p className="font-mono text-xs font-black text-blue-700">
                                    {item.item_code}
                                </p>
                                <p className="font-semibold text-slate-900">
                                    {item.description}
                                </p>
                                <StockTarget item={item} />
                            </td>
                            <NumberCell className="font-black text-slate-800">
                                <Quantity
                                    value={item.quantity_ordered}
                                    unitName={item.stock_target?.unit_name}
                                />
                            </NumberCell>
                            <NumberCell className="font-black text-emerald-700">
                                <Quantity
                                    value={item.quantity_received}
                                    unitName={item.stock_target?.unit_name}
                                />
                            </NumberCell>
                            <NumberCell
                                className={cn(
                                    'font-black',
                                    item.quantity_remaining > 0
                                        ? 'text-amber-700'
                                        : 'text-slate-400',
                                )}
                            >
                                <Quantity
                                    value={item.quantity_remaining}
                                    unitName={item.stock_target?.unit_name}
                                />
                            </NumberCell>
                            <NumberCell className="text-slate-600">
                                {formatPeso(item.unit_price_centavos)}
                            </NumberCell>
                            <NumberCell className="font-black text-slate-900">
                                {formatPeso(item.amount_centavos)}
                            </NumberCell>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="border-t border-slate-200 bg-slate-50">
                    <tr>
                        <td
                            colSpan={5}
                            className="px-4 py-3 text-right text-xs font-black tracking-wide text-slate-500 uppercase"
                        >
                            Total Amount
                        </td>
                        <td className="px-4 py-3 text-right font-black whitespace-nowrap text-slate-900">
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
            <p className="mt-0.5 text-xs font-semibold text-amber-700">
                Not linked to a product yet{schoolStock}
            </p>
        );
    }

    const sentAs =
        target.pieces_per_unit > 1
            ? `by the ${target.unit_name} (${target.pieces_per_unit.toLocaleString('en-PH')} pcs)`
            : 'by the piece';

    return (
        <p className="mt-0.5 text-xs font-semibold text-emerald-700">
            → {target.product_name}
            {target.has_options && ` (${target.variant_label})`} · {sentAs}
            <span className="font-medium text-slate-500">{schoolStock}</span>
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

type TimelineStep = {
    key: string;
    at: string | null;
    tone: 'slate' | 'blue' | 'green' | 'red';
    title: string;
    detail: string | null;
    delivery?: OrderDeliveryRecord;
};

const dotClasses: Record<TimelineStep['tone'], string> = {
    slate: 'bg-slate-400',
    blue: 'bg-[#0D6EFD]',
    green: 'bg-emerald-500',
    red: 'bg-red-500',
};

/**
 * Everything that happened to this order, oldest first, each with its date
 * and time: the upload, every delivery recorded, and when it was completed
 * (or closed with some missing). An order still open ends with what is
 * still to come.
 */
function DeliveryHistory({ details }: { details: PurchaseOrderDetails }) {
    const steps: TimelineStep[] = [
        {
            key: 'uploaded',
            at: details.uploaded_at,
            tone: 'slate',
            title: 'Purchase order uploaded',
            detail: `${details.items.length} ${details.items.length === 1 ? 'item' : 'items'} · ${details.quantity_ordered_total.toLocaleString('en-PH')} as ordered on the eStore · ${formatPeso(details.total_amount_centavos)} · by ${details.uploaded_by}`,
        },
        ...[...details.deliveries]
            .sort((a, b) =>
                (a.recorded_at ?? '').localeCompare(b.recorded_at ?? ''),
            )
            .map((delivery): TimelineStep => ({
                key: `delivery-${delivery.id}`,
                at: delivery.recorded_at,
                tone: 'blue',
                title: 'Delivery recorded',
                detail: [
                    `Received ${formatDateOrdered(delivery.received_on)}`,
                    delivery.sales_invoice_number &&
                        `SI # ${delivery.sales_invoice_number}`,
                    delivery.delivery_receipt_number &&
                        `DR # ${delivery.delivery_receipt_number}`,
                    `by ${delivery.recorded_by}`,
                ]
                    .filter(Boolean)
                    .join(' · '),
                delivery,
            })),
    ];

    if (details.delivery_status === 'completed') {
        steps.push({
            key: 'completed',
            at: details.completed_at,
            tone: 'green',
            title: 'Completed · everything arrived',
            detail: `${details.quantity_received_total.toLocaleString('en-PH')} of ${details.quantity_ordered_total.toLocaleString('en-PH')} as ordered on the eStore`,
        });
    }

    if (details.delivery_status === 'completed_short') {
        steps.push({
            key: 'closed',
            at: details.closed_at,
            tone: 'red',
            title: 'Completed (some missing)',
            detail: [
                details.closed_reason && `“${details.closed_reason}”`,
                `${details.percent_received}% received`,
                details.closed_by && `by ${details.closed_by}`,
            ]
                .filter(Boolean)
                .join(' · '),
        });
    }

    const stillToCome = details.items.filter(
        (item) => item.quantity_remaining > 0,
    );
    const isOpen =
        details.delivery_status === 'awaiting' ||
        details.delivery_status === 'partially_received';

    return (
        <ol className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
            {steps.map((step) => (
                <li key={step.key} className="flex gap-3 px-4 py-3">
                    <span
                        aria-hidden="true"
                        className={cn(
                            'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
                            dotClasses[step.tone],
                        )}
                    />
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                            <p
                                className={cn(
                                    'text-sm font-black',
                                    step.tone === 'green'
                                        ? 'text-emerald-700'
                                        : step.tone === 'red'
                                          ? 'text-red-700'
                                          : 'text-slate-900',
                                )}
                            >
                                {step.title}
                            </p>
                            <p className="text-sm font-bold whitespace-nowrap text-slate-700">
                                {formatDateTime(step.at)}
                            </p>
                        </div>
                        {step.detail && (
                            <p className="mt-0.5 text-xs text-slate-500">
                                {step.detail}
                            </p>
                        )}
                        {step.delivery && (
                            <DeliveredItems delivery={step.delivery} />
                        )}
                    </div>
                </li>
            ))}

            {isOpen && stillToCome.length > 0 && (
                <li className="flex gap-3 bg-amber-50/50 px-4 py-3">
                    <span
                        aria-hidden="true"
                        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-dashed border-amber-500"
                    />
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                            <p className="text-sm font-black text-amber-800">
                                Still to come
                            </p>
                            <p className="text-xs font-bold text-amber-700">
                                Not delivered yet
                            </p>
                        </div>
                        <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
                            {stillToCome.map((item) => (
                                <li key={item.row_number}>
                                    <span className="font-mono text-xs font-bold text-blue-700">
                                        {item.item_code}
                                    </span>{' '}
                                    {item.description} ·{' '}
                                    <b>
                                        <Quantity
                                            value={item.quantity_remaining}
                                            unitName={
                                                item.stock_target?.unit_name
                                            }
                                        />
                                    </b>
                                </li>
                            ))}
                        </ul>
                    </div>
                </li>
            )}
        </ol>
    );
}

/** What one delivery brought, and what went into stock. */
function DeliveredItems({ delivery }: { delivery: OrderDeliveryRecord }) {
    return (
        <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
            {delivery.items.map((item) => (
                <li key={item.item_code}>
                    <span className="font-mono text-xs font-bold text-blue-700">
                        {item.item_code}
                    </span>{' '}
                    {item.description}
                    {item.added_to_stock.length > 0 ? (
                        item.added_to_stock.map((added) => (
                            <span
                                key={added.product_name}
                                className="block text-xs text-emerald-700"
                            >
                                +
                                <b>
                                    {formatConversion(
                                        added.units_received,
                                        added.unit_name,
                                        added.pieces_per_unit,
                                    )}
                                </b>{' '}
                                to the stock of {added.product_name}
                            </span>
                        ))
                    ) : (
                        <span className="block text-xs text-amber-700">
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

/** One fact in the row under the header. */
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
        <div className="px-6 py-4">
            <dt className="text-xs font-black tracking-wide text-slate-400 uppercase">
                {label}
            </dt>
            <dd className="mt-1 text-sm font-black text-slate-900">
                {children}
            </dd>
            {note && <dd className="mt-0.5 text-xs text-slate-500">{note}</dd>}
        </div>
    );
}

function TabButton({
    active,
    icon,
    count,
    onClick,
    children,
}: {
    active: boolean;
    icon: ReactNode;
    count: number;
    onClick: () => void;
    children: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition',
                active
                    ? 'bg-[#0D6EFD] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white',
            )}
        >
            {icon}
            {children}
            <span
                className={cn(
                    'rounded-full px-2 py-0.5 text-xs',
                    active ? 'bg-white/25' : 'bg-white text-slate-600',
                )}
            >
                {count}
            </span>
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
                'px-4 py-2.5 text-xs font-black tracking-wide whitespace-nowrap text-slate-500 uppercase',
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
