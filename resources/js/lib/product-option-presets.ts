/**
 * Ready-made choices the Specialist can tick for common options, so they
 * don't have to type them. Any option can still get other choices typed
 * in. Keys are option names in lowercase.
 */
export const optionPresets: Record<string, string[]> = {
    size: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
    // The programs STI College Ormoc offers (given by the user, Oct 2026).
    program: [
        'BSIT',
        'BSHM',
        'BSTM',
        'Grade 11 (Senior High)',
        'Grade 12 (Senior High)',
    ],
    color: [
        'Black',
        'White',
        'Navy Blue',
        'Blue',
        'Red',
        'Gray',
        'Green',
        'Yellow',
        'Pink',
    ],
    capacity: ['14 oz', '18 oz', '22 oz', '32 oz', '40 oz'],
};

/**
 * The ready-made choices for an option name, e.g. "Size" or "size".
 */
export function presetChoices(optionName: string): string[] | null {
    return optionPresets[optionName.trim().toLowerCase()] ?? null;
}
