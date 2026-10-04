/*
 * Money, dates and quantities written the same way as on the PROWARE
 * website. PROWARE stores money in centavos (₱350.00 = 35000).
 */

/** 35000 -> "₱350.00", written by hand so it works on every phone. */
export function formatPeso(centavos: number | null): string {
    if (centavos === null) {
        return '—';
    }

    const [whole, cents] = (centavos / 100).toFixed(2).split('.');

    return `₱${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${cents}`;
}

const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
];

/** "2026-10-06" (or a longer value starting with it) -> "Oct 6, 2026". */
export function formatDate(value: string | null): string {
    if (!value) {
        return '—';
    }

    const [year, month, day] = value.slice(0, 10).split('-').map(Number);

    return `${MONTHS[month - 1]} ${day}, ${year}`;
}

/** An ISO moment -> "Oct 6, 2026, 2:05 PM" in the phone's time. */
export function formatDateTime(value: string | null): string {
    if (!value) {
        return '—';
    }

    const date = new Date(value);
    const hours = date.getHours() % 12 || 12;
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}, ${hours}:${minutes} ${date.getHours() < 12 ? 'AM' : 'PM'}`;
}

/** "Pack" -> "Packs", "Box" -> "Boxes". */
function plural(name: string): string {
    return /(s|x|z|ch|sh)$/i.test(name) ? `${name}es` : `${name}s`;
}

/** The unit word alone: "pc", "pcs", "Pack", "Packs". */
export function unitWord(quantity: number, unitName: string): string {
    if (unitName === 'Piece') {
        return quantity === 1 ? 'pc' : 'pcs';
    }

    return quantity === 1 ? unitName : plural(unitName);
}

/** "1 pc", "450 pcs", "2 Packs". */
export function formatUnits(quantity: number, unitName: string): string {
    return `${quantity.toLocaleString('en-PH')} ${unitWord(quantity, unitName)}`;
}
