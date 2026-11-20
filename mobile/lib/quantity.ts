/**
 * How many, as typed in a quantity box (as on the website,
 * resources/js/lib/number-input.ts): the whole number (1 or more), or null
 * when it is not one (".5", "-1", letters, empty, 0). The box keeps what was
 * typed; this says whether it can be used.
 */
export function typedQuantity(value: string): number | null {
    const trimmed = value.trim();

    return /^\d+$/.test(trimmed) && Number(trimmed) >= 1 ? Number(trimmed) : null;
}

/** Why a typed quantity cannot be used, in plain words; null when it can. */
export function quantityProblem(value: string): string | null {
    const trimmed = value.trim();

    if (trimmed === '' || /^0+$/.test(trimmed)) {
        return 'Enter at least 1.';
    }

    return /^\d+$/.test(trimmed) ? null : 'Enter a whole number, e.g. 2.';
}
