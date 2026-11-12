/**
 * The most of one item a buyer can get at once (BuyerLimit on the server):
 * the Specialist's Maintenance setting, or more for a buyer the Specialist
 * allowed more. The server sends it as `most_per_item`; 99 when it does not.
 */
export const DEFAULT_MOST_PER_ITEM = 99;

export function mostPerItem(fromServer: number | null | undefined): number {
    return fromServer ?? DEFAULT_MOST_PER_ITEM;
}

/** "You can get at most 99 of one item. Contact the PROWARE office to get more." (BuyerLimit::message) */
export function buyerLimitMessage(most: number): string {
    return `You can get at most ${most.toLocaleString('en-PH')} of one item. Contact the PROWARE office to get more.`;
}