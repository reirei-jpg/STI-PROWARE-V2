const pesoFormatter = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

/**
 * Show an amount stored in centavos as pesos, e.g. 42000 → ₱420.00.
 */
export function formatPeso(centavos: number | null): string {
    return centavos === null ? '—' : pesoFormatter.format(centavos / 100);
}

/**
 * Show a date ("2026-09-29") and optional time ("10:14") as written by the
 * eStore, without shifting it between time zones. Only the date part of a
 * longer value ("2026-09-29T23:59:59+08:00") is used.
 */
export function formatDateOrdered(
    date: string | null,
    time: string | null = null,
): string {
    if (date === null) {
        return '—';
    }

    const [year, month, day] = date.slice(0, 10).split('-').map(Number);
    const [hours, minutes] = (time ?? '00:00').split(':').map(Number);

    return new Intl.DateTimeFormat('en-PH', {
        dateStyle: 'medium',
        ...(time !== null ? { timeStyle: 'short' } : {}),
    }).format(new Date(year, month - 1, day, hours, minutes));
}

/**
 * Show a moment in time (ISO 8601) in the viewer's local time.
 */
export function formatDateTime(value: string | null): string {
    if (value === null) {
        return '—';
    }

    return new Intl.DateTimeFormat('en-PH', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}
