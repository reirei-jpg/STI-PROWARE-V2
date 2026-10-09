/**
 * What can be typed in PROWARE's number boxes, so no box accepts an
 * endless or unrealistic number. The server checks the same limits again.
 */

/** The highest price anyone can type, in pesos (SaveProductRequest::MAX_PRICE_PESOS). */
export const MAX_PRICE_PESOS = 100000;

/**
 * A price as typed: digits and one decimal point, at most two decimals,
 * never above ₱100,000. "5353453535…" stops at "100000"; "12.345" stays
 * "12.34"; letters are dropped.
 */
export function priceInput(value: string): string {
    const [whole = '', ...rest] = value.replace(/[^\d.]/g, '').split('.');
    const hasPoint = rest.length > 0;
    const decimals = rest.join('').slice(0, 2);
    const digits = whole.replace(/^0+(?=\d)/, '');

    if (Number(digits) > MAX_PRICE_PESOS || digits.length > 6) {
        return String(MAX_PRICE_PESOS);
    }

    if (Number(digits) === MAX_PRICE_PESOS) {
        // ₱100,000.00 is the most: no centavos above it.
        return hasPoint
            ? `${digits}.${decimals.replace(/[1-9]/g, '0')}`
            : digits;
    }

    return hasPoint ? `${digits}.${decimals}` : digits;
}

/**
 * A whole number as typed: digits only, never above `most` (e.g. the
 * pieces left in stock, or 1,000 per cart item).
 */
export function wholeNumberInput(value: string, most: number): string {
    const digits = value
        .replace(/\D/g, '')
        .replace(/^0+(?=\d)/, '')
        .slice(0, 7);

    if (digits === '') {
        return '';
    }

    return Number(digits) > most ? String(Math.max(0, most)) : digits;
}
