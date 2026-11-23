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
import ConfirmDialog from '@/components/confirm-dialog';
import DraftRestoredNotice from '@/components/draft-restored-notice';
import InputError from '@/components/input-error';
import RequiredLabel from '@/components/required-label';
import {
    Quantity,
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
import { formatDateOrdered } from '@/lib/format';
import { formatConversion, formatUnits, unitWord } from '@/lib/units';
import { cn } from '@/lib/utils';
import type { WaitingItemGroup } from '@/types';
import { confirmLeave } from '@/lib/back-guard';

type WaitingItems = {
    order_number: string | null;
    date_ordered: string;
    is_open: boolean;
    groups: WaitingItemGroup[];
    today: string;
};

/** Whole days from one "YYYY-MM-DD" date to another. */
function daysBetween(from: string, to: string): number {
    const toUtc = (date: string) => {
        const [year, month, day] = date.slice(0, 10).split('-').map(Number);

        return Date.UTC(year, month - 1, day);
    };

    return Math.max(0, Math.round((toUtc(to) - toUtc(from)) / 86_400_000));
}

/** "Ordered Nov 11, 2026 · 8 days ago · 3 items still to come". */
function orderSummary(waiting: WaitingItems): string {
    const days = daysBetween(waiting.date_ordered, waiting.today);
    const age =
        days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;
    const items = waiting.groups.reduce(
        (sum, group) => sum + group.rows.length,
        0,
    );

    return `Ordered ${formatDateOrdered(waiting.date_ordered)} · ${age} · ${items} ${items === 1 ? 'item' : 'items'} still to come`;
}

/**
 * Stock In for one purchase order, as a popup over the page it was opened
 * from: the delivery papers (SI # and DR #, required), what arrived, and a live
 * line saying what saving will do.
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
    const canStockIn =
        waiting !== null && waiting.is_open && waiting.groups.length > 0;

    return (
        <Dialog
            open={purchaseOrderId !== null}
            onOpenChange={(open) => !open && confirmLeave(onClose)}
        >
            <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-4xl [&>button:last-child]:hidden">
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                    <div>
                        <p className="text-xs font-black tracking-wide text-blue-600 uppercase">
                            Stock In
                        </p>
                        <DialogTitle className="mt-1 text-xl font-black text-slate-900">
                            {waiting?.order_number
                                ? `Order #${waiting.order_number}`
                                : 'Purchase Order'}
                        </DialogTitle>
                        <DialogDescription className="mt-0.5 text-sm font-semibold text-slate-500">
                            {canStockIn
                                ? orderSummary(waiting)
                                : 'Enter what arrived from Head Office.'}
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
                ) : !canStockIn ? (
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
                        purchaseOrderId={purchaseOrderId!}
                        waiting={waiting}
                        orderLabel={orderLabel}
                        onSaved={onSaved}
                        onCancel={onClose}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

/**
 * On top: SI # and DR # (required: they confirm the delivery) and a note.
 * What arrived: this order's items with a Received now box each.
 * Then the live summary with Save.
 */
function DeliveryForm({
    purchaseOrderId,
    waiting,
    orderLabel,
    onSaved,
    onCancel,
}: {
    purchaseOrderId: number;
    waiting: WaitingItems;
    orderLabel: string;
    onSaved: () => void;
    /** Cancel was confirmed: close the popup. */
    onCancel: () => void;
}) {
    const { groups } = waiting;
    const delivery = useRecordDelivery(groups, purchaseOrderId);
    const {
        draft,
        unsaved,
        data,
        setData,
        errors,
        processing,
        rows,
        rowErrors,
        rowProblem,
        receivedNowOf,
        totalReceived,
        groupReceivedNow,
        hasProblems,
        paperProblem,
        papersMissing,
        papersWrong,
        setPaper,
        notLinkedReceived,
        setRowQuantity,
        fillAll,
        submit,
    } = delivery;

    // What saving adds to each product's stock.
    const additions = groups
        .filter((group) => group.stock_target && groupReceivedNow(group) > 0)
        .map((group) => {
            const target = group.stock_target!;
            const name = target.has_options
                ? `${target.product_name} (${target.variant_label})`
                : target.product_name;

            return `${formatUnits(groupReceivedNow(group) * target.pieces_per_unit, 'Piece')} to ${name}`;
        });
    // "*Received now required" stays until one item is filled in correctly.
    const receivedNeeded = totalReceived === 0 || hasProblems;
    const stillToCome = rows.filter(
        (row) => row.quantity_remaining - receivedNowOf(row) > 0,
    ).length;
    const everythingTyped = rows.every(
        (row) =>
            data.quantities[row.purchase_order_item_id] ===
            String(row.quantity_remaining),
    );
    // Saving adds the stock and serves and notifies waiting buyers at once,
    // and cannot be undone, so the Specialist answers first.
    const [confirming, setConfirming] = useState(false);

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                setConfirming(true);
            }}
            className="flex min-h-0 flex-1 flex-col"
        >
            {unsaved.prompt}
            <ConfirmDialog
                open={confirming}
                title={`Stock in this delivery for ${orderLabel}?`}
                description={
                    <>
                        {additions.length > 0
                            ? `It adds ${additions.join(', ')} to stock now. `
                            : 'It is recorded on the order. '}
                        Buyers waiting for these items are served first and
                        notified.{' '}
                        {stillToCome === 0
                            ? `${orderLabel} becomes Completed. `
                            : ''}
                        This cannot be undone.
                    </>
                }
                cancelLabel="Check again"
                confirmLabel="Stock in"
                busy={processing}
                onConfirm={() => {
                    setConfirming(false);
                    submit({ stayOnPage: true, onSaved });
                }}
                onClose={() => setConfirming(false)}
            />
            <div className="min-h-0 flex-1 overflow-y-auto">
                {draft.restored && (
                    <div className="px-6 pt-4">
                        <DraftRestoredNotice
                            onDiscard={draft.discard}
                            onDismiss={draft.dismiss}
                        />
                    </div>
                )}

                <section className="border-b border-slate-200 bg-slate-50/60 px-6 py-5">
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Field
                            label={
                                <RequiredLabel
                                    required={
                                        data.sales_invoice_number.trim() === ''
                                    }
                                >
                                    SI # (Sales Invoice)
                                </RequiredLabel>
                            }
                            error={
                                paperProblem('sales_invoice_number') ??
                                errors.sales_invoice_number
                            }
                        >
                            <input
                                value={data.sales_invoice_number}
                                onChange={(event) =>
                                    setPaper(
                                        'sales_invoice_number',
                                        event.target.value,
                                    )
                                }
                                maxLength={40}
                                placeholder="e.g. 1210000031492"
                                data-test="sales-invoice-number"
                                className={cn(
                                    deliveryInputClasses,
                                    'font-mono',
                                )}
                            />
                        </Field>
                        <Field
                            label={
                                <RequiredLabel
                                    required={
                                        data.delivery_receipt_number.trim() ===
                                        ''
                                    }
                                >
                                    DR # (Delivery Receipt)
                                </RequiredLabel>
                            }
                            error={
                                paperProblem('delivery_receipt_number') ??
                                errors.delivery_receipt_number
                            }
                        >
                            <input
                                value={data.delivery_receipt_number}
                                onChange={(event) =>
                                    setPaper(
                                        'delivery_receipt_number',
                                        event.target.value,
                                    )
                                }
                                maxLength={40}
                                placeholder="e.g. 0000045671"
                                data-test="delivery-receipt-number"
                                className={cn(
                                    deliveryInputClasses,
                                    'font-mono',
                                )}
                            />
                        </Field>
                        <Field label="Note" error={errors.note}>
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
                </section>

                <section className="px-6 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-black tracking-wide text-slate-900 uppercase">
                                What arrived
                            </h3>
                            {/* Goes once at least one item is filled in correctly. */}
                            {receivedNeeded && (
                                <p className="mt-0.5 text-sm text-slate-600">
                                    <RequiredLabel>Received now</RequiredLabel>{' '}
                                    (at least one item) before Save delivery can
                                    be clicked.
                                </p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={fillAll}
                            disabled={everythingTyped}
                            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800 shadow-sm transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <PackageCheck size={16} />
                            Everything arrived
                        </button>
                    </div>

                    <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="w-full min-w-160 text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <Heading>Item</Heading>
                                    <Heading right>Left to receive</Heading>
                                    <Heading right>
                                        <RequiredLabel
                                            required={receivedNeeded}
                                        >
                                            Received now
                                        </RequiredLabel>
                                    </Heading>
                                </tr>
                            </thead>
                            {groups.map((group) => (
                                <tbody
                                    key={group.item_code}
                                    className="border-t border-slate-100"
                                >
                                    {group.rows.map((row) => (
                                        <ItemRow
                                            key={row.purchase_order_item_id}
                                            group={group}
                                            value={
                                                data.quantities[
                                                    row.purchase_order_item_id
                                                ] ?? ''
                                            }
                                            ordered={row.quantity_ordered}
                                            remaining={row.quantity_remaining}
                                            receivedNow={receivedNowOf(row)}
                                            problem={
                                                rowProblem(row) ??
                                                rowErrors[
                                                    row.purchase_order_item_id
                                                ] ??
                                                null
                                            }
                                            onChange={(value) =>
                                                setRowQuantity(row, value)
                                            }
                                        />
                                    ))}
                                </tbody>
                            ))}
                        </table>
                    </div>
                </section>
            </div>

            <footer className="flex flex-col gap-3 border-t border-slate-200 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1 text-sm">
                    {/* What saving adds shows only once the numbers can be saved. */}
                    {hasProblems || papersWrong ? (
                        <p className="font-bold text-red-600">
                            Fix the boxes marked in red first.
                        </p>
                    ) : papersMissing ? (
                        <p
                            data-test="papers-missing"
                            className="font-bold text-amber-800"
                        >
                            Enter the SI # and DR # from Head Office&apos;s
                            papers.
                        </p>
                    ) : totalReceived === 0 ? (
                        <p className="font-bold text-amber-800">
                            Type how many arrived in Received now, or click
                            Everything arrived.
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
                    <InputError message={errors.items} />
                </div>

                <div className="flex shrink-0 gap-2">
                    {/* Cancel throws what was typed away (asks first); an
                        accidental close keeps it as a draft. */}
                    <button
                        type="button"
                        onClick={() =>
                            unsaved.confirmDiscard(() => {
                                draft.discard();
                                onCancel();
                            })
                        }
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={
                            processing ||
                            totalReceived === 0 ||
                            hasProblems ||
                            papersMissing ||
                            papersWrong
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

/**
 * One ordered item: its code and name with where it goes into stock, how
 * many are left of how many were ordered, and its Received now box.
 */
function ItemRow({
    group,
    value,
    ordered,
    remaining,
    receivedNow,
    problem,
    onChange,
}: {
    group: WaitingItemGroup;
    value: string;
    ordered: number;
    remaining: number;
    receivedNow: number;
    problem: string | null;
    onChange: (value: string) => void;
}) {
    const target = group.stock_target;

    return (
        <tr className="align-top">
            <td className="px-4 py-3">
                <p className="font-semibold text-slate-900">
                    <span className="font-mono text-xs font-black text-blue-700">
                        {group.item_code}
                    </span>{' '}
                    · {group.description}
                </p>
                <ItemNote group={group} />
            </td>
            <td className="px-4 py-3 text-right whitespace-nowrap">
                <span className="font-black text-amber-700">
                    <Quantity value={remaining} target={target} />
                </span>
                <p className="text-xs font-semibold text-slate-500">
                    of {ordered.toLocaleString('en-PH')} ordered
                </p>
            </td>
            <td className="px-4 py-3">
                <span className="flex items-center justify-end gap-2">
                    <input
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                        inputMode="numeric"
                        placeholder="0"
                        aria-invalid={problem ? true : undefined}
                        className={cn(deliveryInputClasses, 'w-24 text-right')}
                        aria-label={`Received now: ${group.item_code}`}
                    />
                    {target && (
                        <span className="w-10 text-left text-xs font-bold text-slate-500">
                            {unitWord(receivedNow, target.unit_name)}
                        </span>
                    )}
                </span>

                {target &&
                    !problem &&
                    receivedNow > 0 &&
                    target.pieces_per_unit > 1 && (
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
                    message={problem ?? undefined}
                />
            </td>
        </tr>
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
            Goes into: {target.product_name}
            {target.has_options && ` · ${target.variant_label}`}
            {target.pieces_per_unit > 1 &&
                ` · by the ${target.unit_name} (${target.pieces_per_unit.toLocaleString('en-PH')} pcs)`}
        </p>
    );
}

function Field({
    label,
    error,
    children,
}: {
    label: ReactNode;
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
