/**
 * Quantities written with their unit, the same way the server writes them
 * (App\Services\Stock\Units): "1 pc", "450 pcs", "2 Packs", and what a
 * delivery adds to stock, "2 Packs × 10 = 20 pcs".
 */

/** "Pack" → "Packs", "Box" → "Boxes". */
function plural(name: string): string {
    return /(s|x|z|ch|sh)$/i.test(name) ? `${name}es` : `${name}s`;
}

/** The unit word alone, for a label beside a number: "pcs", "Packs". */
export function unitWord(quantity: number, unitName: string): string {
    if (unitName === 'Piece') {
        return quantity === 1 ? 'pc' : 'pcs';
    }

    return quantity === 1 ? unitName : plural(unitName);
}

/** "1 pc", "450 pcs", "1 Pack", "2 Packs", "3 Boxes". */
export function formatUnits(quantity: number, unitName: string): string {
    return `${quantity.toLocaleString('en-PH')} ${unitWord(quantity, unitName)}`;
}

/**
 * What a delivery adds to stock: "2 Packs × 10 = 20 pcs", or just
 * "20 pcs" for an item Head Office sends by the piece.
 */
export function formatConversion(
    units: number,
    unitName: string,
    piecesPerUnit: number,
): string {
    const pieces = formatUnits(units * piecesPerUnit, 'Piece');

    return piecesPerUnit === 1
        ? pieces
        : `${formatUnits(units, unitName)} × ${piecesPerUnit.toLocaleString('en-PH')} = ${pieces}`;
}
