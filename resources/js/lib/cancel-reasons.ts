/**
 * Why an order is cancelled, picked from a list like in online shops. The
 * same lists as App\Enums\CancelReason on the server (and the phone app's
 * mobile/lib/cancel-reasons.ts). Other asks them to write why.
 */
export type CancelReasonOption = { value: string; label: string };

/** The reasons a student can pick when they cancel their own order. */
export const STUDENT_CANCEL_REASONS: CancelReasonOption[] = [
    {
        value: 'wrong_size_or_color',
        label: 'I ordered the wrong size or color',
    },
    { value: 'change_items', label: 'I want to change the items or how many' },
    { value: 'ordered_by_mistake', label: 'I ordered by mistake' },
    { value: 'cannot_pick_up', label: 'I cannot pick it up in time' },
    { value: 'no_longer_needed', label: 'I no longer need it' },
    { value: 'other', label: 'Other' },
];

/** The reasons the Specialist can pick when the office cancels an order. */
export const STAFF_CANCEL_REASONS: CancelReasonOption[] = [
    { value: 'item_damaged', label: 'The item is damaged' },
    {
        value: 'not_enough_stock',
        label: 'Not enough stock (the count was wrong)',
    },
    { value: 'student_asked', label: 'The student asked to cancel' },
    {
        value: 'duplicate_order',
        label: 'The student ordered the same thing twice',
    },
    { value: 'other', label: 'Other' },
];

/** The note is needed only for Other, and then at least 5 characters. */
export function cancelReasonReady(reason: string, note: string): boolean {
    return reason !== '' && (reason !== 'other' || note.trim().length >= 5);
}
