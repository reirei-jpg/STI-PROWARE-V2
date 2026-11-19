import { useForm } from '@inertiajs/react';
import { useMemo } from 'react';
import DeliveryController from '@/actions/App/Http/Controllers/DeliveryController';
import { useFormDraft } from '@/hooks/use-form-draft';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import type { WaitingItemGroup, WaitingItemRow } from '@/types';

type DeliveryForm = {
    sales_invoice_number: string;
    delivery_receipt_number: string;
    note: string;
    quantities: Record<number, string>;
};

/**
 * "" → 0, "12" → 12, anything that is not a whole number → null.
 */
export function wholeNumber(value: string | undefined): number | null {
    const trimmed = (value ?? '').trim();

    if (trimmed === '') {
        return 0;
    }

    return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

/**
 * Recording a delivery, shared by the Record Delivery page and the Record
 * Delivery popup of one purchase order, so both check the same things: the
 * form, what was typed per order, why something cannot be saved, what
 * saving adds to stock, and saving itself. Each Item Code is one size or
 * color, so what arrives goes into that one.
 */
export function useRecordDelivery(
    groups: WaitingItemGroup[],
    purchaseOrderId: number,
) {
    const form = useForm<DeliveryForm>({
        sales_invoice_number: '',
        delivery_receipt_number: '',
        note: '',
        quantities: {},
    });
    const { data, setData } = form;
    const errors = form.errors as Record<string, string | undefined>;
    // What was counted is kept until saved, per purchase order ("-v2":
    // drafts from before, with counts per color, are not brought back).
    const draft = useFormDraft(
        `delivery-v2-${purchaseOrderId}`,
        data,
        (saved) => setData(saved),
    );

    // Leaving with counts typed asks first (the draft keeps them).
    const unsaved = useUnsavedChanges(form.isDirty && !form.processing, {
        kept: true,
    });

    const rows = useMemo(() => groups.flatMap((group) => group.rows), [groups]);

    // Server errors point at a row by its position in the list sent.
    const rowErrors = useMemo(() => {
        const byItem: Record<number, string | undefined> = {};

        rows.forEach((row, index) => {
            byItem[row.purchase_order_item_id] =
                errors[`items.${index}.quantity_received`];
        });

        return byItem;
    }, [rows, errors]);

    const receivedNowOf = (row: WaitingItemRow) =>
        wholeNumber(data.quantities[row.purchase_order_item_id]) ?? 0;

    const rowProblem = (row: WaitingItemRow): string | null => {
        const quantity = wholeNumber(
            data.quantities[row.purchase_order_item_id],
        );

        if (quantity === null) {
            return 'Enter a whole number, e.g. 5.';
        }

        if (quantity > row.quantity_remaining) {
            return `Only ${row.quantity_remaining.toLocaleString('en-PH')} left to receive for this order.`;
        }

        return null;
    };

    const totalReceived = rows.reduce(
        (sum, row) => sum + receivedNowOf(row),
        0,
    );

    const groupReceivedNow = (group: WaitingItemGroup) =>
        group.rows.reduce((sum, row) => sum + receivedNowOf(row), 0);

    /** What is left to receive of an item code, on all its orders. */
    const remainingOf = (group: WaitingItemGroup) =>
        group.rows.reduce((sum, row) => sum + row.quantity_remaining, 0);

    const hasProblems = rows.some((row) => rowProblem(row) !== null);

    // What saving adds to stock, in pieces, and how many typed items are
    // not linked to a product (recorded, but not added to stock).
    const piecesIntoStock = groups.reduce(
        (sum, group) =>
            sum +
            (group.stock_target
                ? groupReceivedNow(group) * group.stock_target.pieces_per_unit
                : 0),
        0,
    );
    const notLinkedReceived = groups.filter(
        (group) => group.stock_target === null && groupReceivedNow(group) > 0,
    ).length;

    // Kept exactly as typed (".5", "-1", letters): anything but a whole
    // number, or more than is left, turns the box red (rowProblem) and Save
    // stays off, instead of being changed behind the Specialist's back.
    const setRowQuantity = (row: WaitingItemRow, value: string) =>
        setData('quantities', {
            ...data.quantities,
            [row.purchase_order_item_id]: value.slice(0, 12),
        });

    /** "All" on a row: what is left of it arrived. */
    const fillRow = (row: WaitingItemRow) =>
        setData('quantities', {
            ...data.quantities,
            [row.purchase_order_item_id]: String(row.quantity_remaining),
        });

    /** "Everything arrived": what is left of every row arrived. */
    const fillAll = () =>
        setData(
            'quantities',
            Object.fromEntries(
                rows.map((row) => [
                    row.purchase_order_item_id,
                    String(row.quantity_remaining),
                ]),
            ),
        );

    /**
     * Save the delivery. From a purchase order's popup it stays on that
     * page and closes the popup when saved.
     */
    const submit = (
        options: { stayOnPage?: boolean; onSaved?: () => void } = {},
    ) => {
        form.transform((current) => ({
            sales_invoice_number: current.sales_invoice_number,
            delivery_receipt_number: current.delivery_receipt_number,
            note: current.note,
            ...(options.stayOnPage ? { stay_on_page: true } : {}),
            items: rows.map((row) => ({
                purchase_order_item_id: row.purchase_order_item_id,
                quantity_received:
                    current.quantities[row.purchase_order_item_id] ?? '',
            })),
        }));

        form.post(DeliveryController.store().url, {
            preserveScroll: true,
            preserveState: options.stayOnPage ? true : undefined,
            onSuccess: (page) => {
                draft.clear(page);
                options.onSaved?.();
            },
        });
    };

    return {
        draft,
        unsaved,
        data,
        setData,
        errors,
        processing: form.processing,
        rows,
        rowErrors,
        rowProblem,
        receivedNowOf,
        totalReceived,
        groupReceivedNow,
        remainingOf,
        hasProblems,
        piecesIntoStock,
        notLinkedReceived,
        setRowQuantity,
        fillRow,
        fillAll,
        submit,
    };
}
