import { Link, useHttp } from '@inertiajs/react';
import {
    CircleAlert,
    CircleCheck,
    LoaderCircle,
    PackageCheck,
    Save,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import ItemLinkController from '@/actions/App/Http/Controllers/ItemLinkController';
import PurchaseOrderDeliveryController from '@/actions/App/Http/Controllers/PurchaseOrderDeliveryController';
import InputError from '@/components/input-error';
import {
    Quantity,
    SplitCounts,
    deliveryInputClasses,
} from '@/components/record-delivery-parts';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { useRecordDelivery } from '@/hooks/use-record-delivery';
import { formatConversion, formatUnits, unitWord } from '@/lib/units';
import { cn } from '@/lib/utils';
import type { WaitingItemGroup } from '@/types';

type WaitingItems = {
    order_number: string | null;
    is_open: boolean;
    groups: WaitingItemGroup[];
    today: string;
};

/**
 * Record Delivery for one purchase order, as a popup over the page it was
 * opened from: only that order's waiting items, the same checks as the
 * Record Delivery page, and a live line saying what saving will do.
 */
export default function RecordDeliveryDialog({
    purchaseOrderId,
    onClose,
    onSaved,
}: {
    purchaseOrderId: number | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const http = useHttp<Record<string, never>, WaitingItems>({});
    const [waiting, setWaiting] = useState<WaitingItems | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (purchaseOrderId === null) {
            return;
        }

        setWaiting(null);
        setFailed(false);

        void http
            .get(PurchaseOrderDeliveryController.waiting(purchaseOrderId).url, {
                onSuccess: (response) => setWaiting(response),
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

    const orderLabel = waiting?.order_number
        ? `Order #${waiting.order_number}`
        : 'this order';

    return (
        <Dialog
            open={purchaseOrderId !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-4xl [&>button:last-child]:hidden">
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                    <div>
                        <p className="text-xs font-black tracking-wide text-blue-600 uppercase">
                            Record Delivery
                        </p>
                        <DialogTitle className="mt-1 text-xl font-black text-slate-900">
                            {waiting?.order_number
                                ? `Order #${waiting.order_number}`
                                : 'Purchase Order'}
                        </DialogTitle>
                        <DialogDescription className="mt-0.5 text-sm text-slate-500">
                            Enter what arrived from Head Office for {orderLabel}
                            .
                        </DialogDescription>
                    </div>
                    <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                        <X size={20} />
                        <span className="sr-only">Close</span>
                    </DialogClose>
                </header>

                {failed ? (
                    <Message>
                        The items could not be loaded. Close this window and try
                        again.
                    </Message>
                ) : !waiting ? (
                    <div className="flex items-center justify-center gap-3 px-6 py-16 text-sm font-semibold text-slate-500">
                        <LoaderCircle
                            size={20}
                            className="animate-spin text-blue-600"
                        />
                        Loading the items...
                    </div>
                ) : !waiting.is_open || waiting.groups.length === 0 ? (
                    <Message>
                        <PackageCheck
                            size={40}
                            className="mx-auto mb-3 text-slate-300"
                        />
                        Nothing is waiting for {orderLabel}: everything has
                        arrived or the order was completed.
                    </Message>
                ) : (
                    <DeliveryForm
                        key={purchaseOrderId}
                        waiting={waiting}
                        orderLabel={orderLabel}
                        onSaved={onSaved}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

/**
 * The delivery details, this order's items with a Received now box each,
 * and the live summary with Save.
 */
function DeliveryForm({
    waiting,
    orderLabel,
    onSaved,
}: {
    waiting: WaitingItems;
    orderLabel: string;
    onSaved: () => void;
}) {
    const { groups, today } = waiting;
    const delivery = useRecordDelivery(groups, today);
    const {
        data,
        setData,
        errors,
        processing,
        rows,
        splitGroups,
        rowErrors,
        rowProblem,
        receivedNowOf,
        totalReceived,
        groupReceivedNow,
        splitProblem,
        hasProblems,
        notLinkedReceived,
        setRowQuantity,
        splitCounts,
        setSplitCount,
        submit,
    } = delivery;

    // What saving adds to each product's stock.
    const additions = groups
        .filter((group) => group.stock_target && groupReceivedNow(group) > 0)
        .map((group) => {
            const target = group.stock_target!;
            const name =
                target.has_options && target.split_into.length <= 1
                    ? `${target.product_name} (${target.variant_label})`
                    : target.product_name;

            return `${formatUnits(groupReceivedNow(group) * target.pieces_per_unit, 'Piece')} to ${name}`;
        });
    const stillToCome = rows.filter(
        (row) => row.quantity_remaining - receivedNowOf(row) > 0,
    ).length;

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                submit({ stayOnPage: true, onSaved });
            }}
            className="flex min-h-0 flex-1 flex-col"
        >
            <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="grid gap-4 border-b border-slate-200 bg-slate-50/60 px-6 py-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Date Received" error={errors.received_on}>
                        <input
                            type="date"
                            value={data.received_on}
                            max={today}
                            onChange={(event) =>
                                setData('received_on', event.target.value)
                            }
                            className={deliveryInputClasses}
                        />
                    </Field>
                    <Field
                        label="SI # (optional)"
                        error={errors.sales_invoice_number}
                    >
                        <input
                            value={data.sales_invoice_number}
                            onChange={(event) =>
                                setData(
                                    'sales_invoice_number',
                                    event.target.value,
                                )
                            }
                            maxLength={40}
                            placeholder="e.g. 1210000031492"
                            className={cn(deliveryInputClasses, 'font-mono')}
                        />
                    </Field>
                    <Field
                        label="DR # (optional)"
                        error={errors.delivery_receipt_number}
                    >
                        <input
                            value={data.delivery_receipt_number}
                            onChange={(event) =>
                                setData(
                                    'delivery_receipt_number',
                                    event.target.value,
                                )
                            }
                            maxLength={40}
                            className={cn(deliveryInputClasses, 'font-mono')}
                        />
                    </Field>
                    <Field label="Note (optional)" error={errors.note}>
                        <input
                            value={data.note}
                            onChange={(event) =>
                                setData('note', event.target.value)
                            }
                            maxLength={500}
                            placeholder="e.g. 1 box slightly damaged"
                            className={deliveryInputClasses}
                        />
                    </Field>
                </div>

                <div className="px-6 py-5">
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="w-full min-w-175 text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <Heading>Item</Heading>
                                    <Heading right>Ordered</Heading>
                                    <Heading right>Received so far</Heading>
                                    <Heading right>Left</Heading>
                                    <Heading right>Received now</Heading>
                                </tr>
                            </thead>
                            {groups.map((group) => {
                                const target = group.stock_target;
                                const isSplit =
                                    (target?.split_into.length ?? 0) > 1;

                                return (
                                    <tbody
                                        key={group.item_code}
                                        className="border-t border-slate-100"
                                    >
                                        {group.rows.map((row) => {
                                            const problem =
                                                rowProblem(row) ??
                                                rowErrors[
                                                    row.purchase_order_item_id
                                                ];
                                            const receivedNow =
                                                receivedNowOf(row);

                                            return (
                                                <tr
                                                    key={
                                                        row.purchase_order_item_id
                                                    }
                                                    className="align-top"
                                                >
                                                    <td className="px-4 py-3">
                                                        <p className="font-mono text-xs font-black text-blue-700">
                                                            {group.item_code}
                                                        </p>
                                                        <p className="font-semibold text-slate-900">
                                                            {group.description}
                                                        </p>
                                                        <ItemNote
                                                            group={group}
                                                        />
                                                    </td>
                                                    <NumberCell className="font-black text-slate-800">
                                                        <Quantity
                                                            value={
                                                                row.quantity_ordered
                                                            }
                                                            target={target}
                                                        />
                                                    </NumberCell>
                                                    <NumberCell className="text-emerald-700">
                                                        <Quantity
                                                            value={
                                                                row.quantity_received
                                                            }
                                                            target={target}
                                                        />
                                                    </NumberCell>
                                                    <NumberCell className="font-black text-amber-700">
                                                        <Quantity
                                                            value={
                                                                row.quantity_remaining
                                                            }
                                                            target={target}
                                                        />
                                                    </NumberCell>
                                                    <td className="px-4 py-3">
                                                        <span className="flex items-center justify-end gap-2">
                                                            <input
                                                                value={
                                                                    data
                                                                        .quantities[
                                                                        row
                                                                            .purchase_order_item_id
                                                                    ] ?? ''
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    setRowQuantity(
                                                                        row,
                                                                        event
                                                                            .target
                                                                            .value,
                                                                    )
                                                                }
                                                                readOnly={
                                                                    isSplit
                                                                }
                                                                inputMode="numeric"
                                                                placeholder="0"
                                                                className={cn(
                                                                    deliveryInputClasses,
                                                                    'w-24 text-right',
                                                                    isSplit &&
                                                                        'bg-slate-50 text-slate-500',
                                                                    problem &&
                                                                        'border-red-300 focus:border-red-400 focus:ring-red-100',
                                                                )}
                                                                aria-label={`Received now: ${group.item_code}`}
                                                            />
                                                            {target && (
                                                                <span className="w-12 text-left text-xs font-bold text-slate-500">
                                                                    {unitWord(
                                                                        receivedNow,
                                                                        target.unit_name,
                                                                    )}
                                                                </span>
                                                            )}
                                                        </span>
                                                        {isSplit && (
                                                            <p className="mt-1 text-right text-xs text-slate-500">
                                                                From the counts
                                                                below
                                                            </p>
                                                        )}
                                                        {target &&
                                                            !problem &&
                                                            receivedNow > 0 &&
                                                            target.pieces_per_unit >
                                                                1 && (
                                                                <p className="mt-1 text-right text-xs font-bold text-emerald-700">
                                                                    ={' '}
                                                                    {formatConversion(
                                                                        receivedNow,
                                                                        target.unit_name,
                                                                        target.pieces_per_unit,
                                                                    )}
                                                                </p>
                                                            )}
                                                        <InputError
                                                            className="mt-1 text-right"
                                                            message={
                                                                problem ??
                                                                undefined
                                                            }
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {isSplit && target && (
                                            <tr>
                                                <td
                                                    colSpan={5}
                                                    className="bg-slate-50/60 p-0"
                                                >
                                                    <SplitCounts
                                                        group={group}
                                                        counts={
                                                            splitCounts[
                                                                group.item_code
                                                            ] ?? {}
                                                        }
                                                        onChange={(
                                                            variantId,
                                                            value,
                                                        ) =>
                                                            setSplitCount(
                                                                group,
                                                                variantId,
                                                                value,
                                                            )
                                                        }
                                                        problem={
                                                            splitProblem(
                                                                group,
                                                            ) ??
                                                            errors[
                                                                `splits.${splitGroups.indexOf(group)}`
                                                            ] ??
                                                            null
                                                        }
                                                    />
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                );
                            })}
                        </table>
                    </div>
                </div>
            </div>

            <footer className="flex flex-col gap-3 border-t border-slate-200 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1 text-sm">
                    {totalReceived === 0 ? (
                        <p className="text-slate-500">
                            Type how many arrived in Received now.
                        </p>
                    ) : (
                        <>
                            {additions.length > 0 && (
                                <p className="font-bold text-slate-800">
                                    Will add:{' '}
                                    <span className="text-emerald-700">
                                        {additions.slice(0, 3).join(' · ')}
                                        {additions.length > 3 &&
                                            ` · +${additions.length - 3} more`}
                                    </span>
                                </p>
                            )}
                            {notLinkedReceived > 0 && (
                                <p className="text-xs font-bold text-amber-700">
                                    {notLinkedReceived === 1
                                        ? '1 item is not linked to a product: it is recorded, but not added to stock.'
                                        : `${notLinkedReceived} items are not linked to a product: they are recorded, but not added to stock.`}
                                </p>
                            )}
                            {stillToCome === 0 ? (
                                <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                                    <CircleCheck size={14} />
                                    {orderLabel} becomes Completed.
                                </p>
                            ) : (
                                <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                                    <CircleAlert size={14} />
                                    {orderLabel} stays Partially Received ·{' '}
                                    {stillToCome}{' '}
                                    {stillToCome === 1 ? 'item' : 'items'} still
                                    to come.
                                </p>
                            )}
                        </>
                    )}
                    {hasProblems && (
                        <p className="text-xs font-bold text-red-600">
                            Fix the boxes marked in red first.
                        </p>
                    )}
                    <InputError message={errors.items} />
                </div>

                <div className="flex shrink-0 gap-2">
                    <DialogClose
                        type="button"
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                        Cancel
                    </DialogClose>
                    <button
                        type="submit"
                        disabled={
                            processing || totalReceived === 0 || hasProblems
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        data-test="save-delivery-popup-button"
                    >
                        {processing ? (
                            <LoaderCircle size={16} className="animate-spin" />
                        ) : (
                            <Save size={16} />
                        )}
                        {processing ? 'Saving...' : 'Save delivery'}
                    </button>
                </div>
            </footer>
        </form>
    );
}

/** One short line under an item: where it goes into stock, or that it is not linked. */
function ItemNote({ group }: { group: WaitingItemGroup }) {
    const target = group.stock_target;

    if (!target) {
        return (
            <p className="mt-0.5 text-xs font-semibold text-amber-700">
                Not linked to a product: not added to stock ·{' '}
                <Link
                    href={ItemLinkController.index({
                        query: { search: group.item_code },
                    })}
                    className="underline underline-offset-2"
                >
                    Link it
                </Link>
            </p>
        );
    }

    return (
        <p className="mt-0.5 text-xs font-semibold text-emerald-700">
            → {target.product_name}
            {target.split_into.length > 1
                ? ' · count each color below'
                : target.has_options && ` (${target.variant_label})`}{' '}
            ·{' '}
            {target.pieces_per_unit > 1
                ? `by the ${target.unit_name} (${target.pieces_per_unit.toLocaleString('en-PH')} pcs)`
                : 'by the piece'}
        </p>
    );
}

function Field({
    label,
    error,
    children,
}: {
    label: string;
    error?: string;
    children: ReactNode;
}) {
    return (
        <label className="grid gap-1.5">
            <span className="text-xs font-black tracking-wide text-slate-500 uppercase">
                {label}
            </span>
            {children}
            <InputError message={error} />
        </label>
    );
}

function Message({ children }: { children: ReactNode }) {
    return (
        <div className="px-6 py-16 text-center text-sm font-semibold text-slate-500">
            {children}
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
