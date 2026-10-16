import { useForm } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import DeliveryController from '@/actions/App/Http/Controllers/DeliveryController';
import { wholeNumberInput } from '@/lib/number-input';
import { formatUnits } from '@/lib/units';
import type { WaitingItemGroup, WaitingItemRow } from '@/types';

type DeliveryForm = {
    received_on: string;
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
 * form, what was typed per order and per color, why something cannot be
 * saved, what saving adds to stock, and saving itself.
 */
export function useRecordDelivery(groups: WaitingItemGroup[], today: string) {
    const form = useForm<DeliveryForm>({
        received_on: today,
        sales_invoice_number: '',
        delivery_receipt_number: '',
        note: '',
        quantities: {},
    });
    const { data, setData } = form;
    const errors = form.errors as Record<string, string | undefined>;
    // Pieces counted per variant, for codes shared by several variants.
    const [splitCounts, setSplitCounts] = useState<
        Record<string, Record<number, string>>
    >({});

    const rows = useMemo(() => groups.flatMap((group) => group.rows), [groups]);
    const splitGroups = useMemo(
        () =>
            groups.filter(
                (group) => (group.stock_target?.split_into.length ?? 0) > 1,
            ),
        [groups],
    );

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
            return 'Please enter a whole number.';
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

    /** Pieces counted per variant of a shared code; null if one is not a number. */
    const countedPieces = (group: WaitingItemGroup): number | null => {
        let total = 0;

        for (const variant of group.stock_target?.split_into ?? []) {
            const pieces = wholeNumber(
                splitCounts[group.item_code]?.[variant.id],
            );

            if (pieces === null) {
                return null;
            }

            total += pieces;
        }

        return total;
    };

    /** Why a shared code's counts do not fit what the orders receive. */
    const splitProblem = (group: WaitingItemGroup): string | null => {
        const target = group.stock_target;
        const counted = countedPieces(group);

        if (target === null || counted === null) {
            return counted === null ? 'Please enter whole numbers.' : null;
        }

        const arriving = groupReceivedNow(group) * target.pieces_per_unit;

        if (counted % target.pieces_per_unit !== 0) {
            return `Your counts add up to ${formatUnits(counted, 'Piece')}, but Head Office sends this by the ${target.unit_name} of ${target.pieces_per_unit} pcs, so the total must be a multiple of ${target.pieces_per_unit}.`;
        }

        if (counted / target.pieces_per_unit > remainingOf(group)) {
            return `Only ${formatUnits(remainingOf(group) * target.pieces_per_unit, 'Piece')} left to receive for this item.`;
        }

        if (counted !== arriving) {
            return `Your counts add up to ${formatUnits(counted, 'Piece')}, but the orders below receive ${formatUnits(arriving, 'Piece')}. Please make them match.`;
        }

        return null;
    };

    // The date is checked as it is typed: a day that has not come yet is refused.
    const dateProblem =
        data.received_on === ''
            ? 'Please choose the date the delivery arrived.'
            : data.received_on > today
              ? 'The date received cannot be in the future.'
              : null;

    const hasProblems =
        dateProblem !== null ||
        rows.some((row) => rowProblem(row) !== null) ||
        splitGroups.some((group) => splitProblem(group) !== null);

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

    // Never more than what is left to receive for that order.
    const setRowQuantity = (row: WaitingItemRow, value: string) =>
        setData('quantities', {
            ...data.quantities,
            [row.purchase_order_item_id]: wholeNumberInput(
                value,
                row.quantity_remaining,
            ),
        });

    const shareOut = (group: WaitingItemGroup, total: number | null) => {
        if (total === null || total > remainingOf(group)) {
            return;
        }

        let left = total;
        const quantities = { ...data.quantities };

        for (const row of group.rows) {
            const share = Math.min(left, row.quantity_remaining);
            quantities[row.purchase_order_item_id] =
                share > 0 ? String(share) : '';
            left -= share;
        }

        setData('quantities', quantities);
    };

    /**
     * A shared code is counted per variant (e.g. 5 Black, 3 Red); the total
     * fills the orders, oldest first, in Head Office's unit.
     */
    const setSplitCount = (
        group: WaitingItemGroup,
        variantId: number,
        value: string,
    ) => {
        const target = group.stock_target;
        const others = Object.entries(splitCounts[group.item_code] ?? {})
            .filter(([id]) => Number(id) !== variantId)
            .reduce((sum, [, count]) => sum + (wholeNumber(count) ?? 0), 0);
        // All sizes together never more than the pieces left to receive.
        const mostPieces =
            remainingOf(group) * (target?.pieces_per_unit ?? 1) - others;
        const counts = {
            ...splitCounts[group.item_code],
            [variantId]: wholeNumberInput(value, Math.max(0, mostPieces)),
        };
        setSplitCounts({ ...splitCounts, [group.item_code]: counts });

        const pieces = Object.values(counts).reduce(
            (sum, count) => sum + (wholeNumber(count) ?? 0),
            0,
        );

        if (target && pieces % target.pieces_per_unit === 0) {
            shareOut(group, pieces / target.pieces_per_unit);
        }
    };

    /**
     * Save the delivery. From a purchase order's popup it stays on that
     * page and closes the popup when saved.
     */
    const submit = (
        options: { stayOnPage?: boolean; onSaved?: () => void } = {},
    ) => {
        form.transform((current) => ({
            received_on: current.received_on,
            sales_invoice_number: current.sales_invoice_number,
            delivery_receipt_number: current.delivery_receipt_number,
            note: current.note,
            ...(options.stayOnPage ? { stay_on_page: true } : {}),
            items: rows.map((row) => ({
                purchase_order_item_id: row.purchase_order_item_id,
                quantity_received:
                    current.quantities[row.purchase_order_item_id] ?? '',
            })),
            splits: splitGroups.map((group) => ({
                item_code: group.item_code,
                pieces: (group.stock_target?.split_into ?? []).map(
                    (variant) => ({
                        product_variant_id: variant.id,
                        pieces:
                            splitCounts[group.item_code]?.[variant.id] ?? '',
                    }),
                ),
            })),
        }));

        form.post(DeliveryController.store().url, {
            preserveScroll: true,
            preserveState: options.stayOnPage ? true : undefined,
            onSuccess: () => options.onSaved?.(),
        });
    };

    return {
        data,
        setData,
        errors,
        processing: form.processing,
        rows,
        splitGroups,
        rowErrors,
        rowProblem,
        dateProblem,
        receivedNowOf,
        totalReceived,
        groupReceivedNow,
        remainingOf,
        countedPieces,
        splitProblem,
        hasProblems,
        piecesIntoStock,
        notLinkedReceived,
        setRowQuantity,
        splitCounts,
        setSplitCount,
        submit,
    };
}
