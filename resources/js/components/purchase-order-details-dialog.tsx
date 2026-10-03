import { Form, Link, useHttp, usePage } from '@inertiajs/react';
import {
    Ban,
    CalendarClock,
    ClipboardList,
    LoaderCircle,
    Truck,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import DeliveryController from '@/actions/App/Http/Controllers/DeliveryController';
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController';
import PurchaseOrderDeliveryController from '@/actions/App/Http/Controllers/PurchaseOrderDeliveryController';
import DeliveryProgress from '@/components/delivery-progress';
import InputError from '@/components/input-error';
import type { ExpectedDeliveryTarget } from '@/components/set-expected-delivery-dialog';
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
import type { OrderDeliveryRecord, PurchaseOrderDetails } from '@/types';

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
    onSetExpectedDate,
}: {
    purchaseOrderId: number | null;
    onClose: () => void;
    onSetExpectedDate?: (order: ExpectedDeliveryTarget) => void;
}) {
    const { auth } = usePage().props;
    const isSpecialist = auth.user.role === 'specialist';
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

                            <DeliverySummary
                                details={details}
                                isSpecialist={isSpecialist}
                                onSetExpectedDate={onSetExpectedDate}
                            />

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
                                            <Heading right>Received</Heading>
                                            <Heading right>Remaining</Heading>
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
                                                    <span className="mt-1 block text-xs font-medium">
                                                        {item.stock_target ? (
                                                            <span className="text-emerald-700">
                                                                Head Office
                                                                sends it{' '}
                                                                {item
                                                                    .stock_target
                                                                    .pieces_per_unit >
                                                                1
                                                                    ? `by the ${item.stock_target.unit_name} (${item.stock_target.pieces_per_unit.toLocaleString('en-PH')} pcs each)`
                                                                    : 'by the piece'}{' '}
                                                                · stock of{' '}
                                                                {
                                                                    item
                                                                        .stock_target
                                                                        .product_name
                                                                }
                                                                {item
                                                                    .stock_target
                                                                    .has_options &&
                                                                    ` (${item.stock_target.variant_label})`}
                                                            </span>
                                                        ) : (
                                                            <span className="text-amber-700">
                                                                Not linked to a
                                                                product · as
                                                                ordered on the
                                                                eStore
                                                            </span>
                                                        )}
                                                    </span>
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
                                                    <Quantity
                                                        value={
                                                            item.quantity_ordered
                                                        }
                                                        unitName={
                                                            item.stock_target
                                                                ?.unit_name
                                                        }
                                                    />
                                                </Cell>
                                                <Cell
                                                    right
                                                    className="font-black text-emerald-700"
                                                >
                                                    <Quantity
                                                        value={
                                                            item.quantity_received
                                                        }
                                                        unitName={
                                                            item.stock_target
                                                                ?.unit_name
                                                        }
                                                    />
                                                </Cell>
                                                <Cell
                                                    right
                                                    className={cn(
                                                        'font-black',
                                                        item.quantity_remaining >
                                                            0
                                                            ? 'text-amber-700'
                                                            : 'text-slate-400',
                                                    )}
                                                >
                                                    <Quantity
                                                        value={
                                                            item.quantity_remaining
                                                        }
                                                        unitName={
                                                            item.stock_target
                                                                ?.unit_name
                                                        }
                                                    />
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

                            <DeliveryHistory deliveries={details.deliveries} />
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
 * How far the order's delivery has come, the expected delivery date, why it
 * was closed short (if it was), and the Specialist's delivery actions.
 */
function DeliverySummary({
    details,
    isSpecialist,
    onSetExpectedDate,
}: {
    details: PurchaseOrderDetails;
    isSpecialist: boolean;
    onSetExpectedDate?: (order: ExpectedDeliveryTarget) => void;
}) {
    const [closing, setClosing] = useState(false);
    const isOpen =
        details.delivery_status === 'awaiting' ||
        details.delivery_status === 'partially_received';

    return (
        <section className="border-t border-slate-100 px-8 py-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex flex-col gap-5 sm:flex-row sm:gap-10">
                    <DeliveryProgress progress={details} className="w-64" />

                    <div>
                        <p className="text-sm font-bold tracking-wide text-slate-400 uppercase">
                            Expected Delivery
                        </p>
                        <p className="mt-1 text-lg font-black text-slate-900">
                            {details.expected_delivery_date
                                ? formatDateOrdered(
                                      details.expected_delivery_date,
                                  )
                                : isOpen
                                  ? 'Not set yet'
                                  : '—'}
                        </p>
                        {details.expected_delivery_note && (
                            <p className="mt-0.5 text-sm text-slate-500">
                                {details.expected_delivery_note}
                            </p>
                        )}
                    </div>
                </div>

                {isSpecialist && isOpen && (
                    <div className="flex flex-wrap gap-2">
                        {onSetExpectedDate && (
                            <button
                                type="button"
                                onClick={() => onSetExpectedDate(details)}
                                className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2.5 text-sm font-black text-blue-700 transition hover:bg-blue-100"
                            >
                                <CalendarClock size={16} />
                                {details.expected_delivery_date
                                    ? 'Change delivery date'
                                    : 'Set delivery date'}
                            </button>
                        )}
                        <Link
                            href={DeliveryController.create()}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-700"
                        >
                            <Truck size={16} />
                            Record Delivery
                        </Link>
                        <button
                            type="button"
                            onClick={() => setClosing((open) => !open)}
                            className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-black text-red-700 transition hover:bg-red-100"
                        >
                            <Ban size={16} />
                            Close order (short)
                        </button>
                    </div>
                )}
            </div>

            {details.closed_reason && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
                    <p className="font-black">
                        Closed as Completed (short)
                        {details.closed_by && ` by ${details.closed_by}`}
                        {details.closed_at &&
                            ` on ${formatDateTime(details.closed_at)}`}
                    </p>
                    <p className="mt-1">Reason: {details.closed_reason}</p>
                </div>
            )}

            {closing && (
                <Form
                    {...PurchaseOrderDeliveryController.close.form(details.id)}
                    options={{ preserveScroll: true }}
                    className="mt-5 rounded-2xl border border-red-200 bg-red-50/60 p-5"
                >
                    {({ processing, errors }) => (
                        <>
                            <p className="font-black text-red-800">
                                Close this order even though{' '}
                                {(
                                    details.quantity_ordered_total -
                                    details.quantity_received_total
                                ).toLocaleString('en-PH')}{' '}
                                (as ordered on the eStore) have not arrived?
                            </p>
                            <p className="mt-1 text-sm text-red-700">
                                Use this when Head Office says the rest will not
                                be delivered. The order will show as Completed
                                (short) with your reason.
                            </p>
                            <label className="mt-4 grid gap-1.5">
                                <span className="text-sm font-black text-slate-700">
                                    Reason
                                </span>
                                <textarea
                                    name="reason"
                                    required
                                    rows={3}
                                    maxLength={500}
                                    placeholder="e.g. Head Office said the M/L polos are out of stock and will not be delivered."
                                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
                                />
                                <InputError message={errors.reason} />
                            </label>
                            <div className="mt-4 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setClosing(false)}
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
                                    Close order
                                </button>
                            </div>
                        </>
                    )}
                </Form>
            )}
        </section>
    );
}

/**
 * Every delivery that brought items of this order, newest first.
 */
function DeliveryHistory({
    deliveries,
}: {
    deliveries: OrderDeliveryRecord[];
}) {
    return (
        <section className="border-t border-slate-100 px-8 py-6">
            <h3 className="text-lg font-black text-slate-900">
                Delivery History
            </h3>

            {deliveries.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                    Nothing has arrived for this order yet.
                </p>
            ) : (
                <ol className="mt-4 space-y-3">
                    {deliveries.map((delivery) => (
                        <li
                            key={delivery.id}
                            className="rounded-2xl border border-slate-200 p-4"
                        >
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <p className="font-black text-slate-900">
                                    Received{' '}
                                    {formatDateOrdered(delivery.received_on)}
                                </p>
                                <p className="text-sm text-slate-500">
                                    {[
                                        delivery.sales_invoice_number &&
                                            `SI # ${delivery.sales_invoice_number}`,
                                        delivery.delivery_receipt_number &&
                                            `DR # ${delivery.delivery_receipt_number}`,
                                        `Recorded by ${delivery.recorded_by}`,
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </p>
                            </div>
                            <ul className="mt-2 space-y-2 text-sm text-slate-700">
                                {delivery.items.map((item) => (
                                    <li key={item.item_code}>
                                        <span className="font-mono font-bold text-blue-700">
                                            {item.item_code}
                                        </span>{' '}
                                        {item.description}
                                        {item.added_to_stock.length > 0 ? (
                                            item.added_to_stock.map((added) => (
                                                <span
                                                    key={added.product_name}
                                                    className="mt-0.5 block text-emerald-700"
                                                >
                                                    Received{' '}
                                                    <span className="font-black">
                                                        {formatConversion(
                                                            added.units_received,
                                                            added.unit_name,
                                                            added.pieces_per_unit,
                                                        )}
                                                    </span>{' '}
                                                    added to the stock of{' '}
                                                    {added.product_name}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="mt-0.5 block text-amber-700">
                                                Received{' '}
                                                <span className="font-black">
                                                    {item.quantity_received.toLocaleString(
                                                        'en-PH',
                                                    )}
                                                </span>{' '}
                                                (as ordered on the eStore) · not
                                                in stock yet: not linked to a
                                                product
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </li>
                    ))}
                </ol>
            )}
        </section>
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
