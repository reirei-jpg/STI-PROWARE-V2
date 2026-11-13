import { formatPeso, formatUnits } from '@/lib/format';

/**
 * A preorder is paid at the cashier with its preorder slip, at the price on
 * the day it was preordered (early-bird pieces at the early-bird price).
 * Once paid there is no refund. Same words as the
 * website (resources/js/lib/preorder-price.ts).
 */
export const PREORDER_PRICE_MAY_CHANGE = 'Pay at the cashier with your preorder slip. The price stays as it is today. After paying there is no refund.';

/** "Preordered at ₱500.00 each. The price may change …" (or only the note for older preorders). */
export function preorderPriceNote(preorderedPriceCentavos: number | null): string {
    return preorderedPriceCentavos === null
        ? PREORDER_PRICE_MAY_CHANGE
        : `Preordered at ${formatPeso(preorderedPriceCentavos)} each. ${PREORDER_PRICE_MAY_CHANGE}`;
}

/**
 * The price part of the "Your preorder has arrived" notice, the same as its
 * phone push: " Price now: ₱750.00 each." or, with early-bird pieces,
 * " Price now: ₱750.00 each, but the early-bird price of ₱650.00 stays for 2 pcs."
 */
export function heldPriceText(
    priceCentavos: number | null | undefined,
    earlyBirdPieces: number | null | undefined,
    earlyBirdPriceCentavos: number | null | undefined,
): string {
    if (priceCentavos == null) {
        return '';
    }

    if (earlyBirdPieces && earlyBirdPriceCentavos != null) {
        return ` Price now: ${formatPeso(priceCentavos)} each, but the early-bird price of ${formatPeso(earlyBirdPriceCentavos)} stays for ${formatUnits(earlyBirdPieces, 'Piece')}.`;
    }

    return ` Price now: ${formatPeso(priceCentavos)} each.`;
}