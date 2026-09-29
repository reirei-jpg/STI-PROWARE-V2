import type { ProductOptionInput } from '@/types';

export type VariantCombination = {
    /** "Color: Blue | Capacity: 22 oz"; empty for a product without options. */
    key: string;
    /** "Blue / 22 oz"; "Default" for a product without options. */
    label: string;
};

/**
 * Every combination of the options' choices, in the same order and with the
 * same keys as the server (App\Services\Products\ProductVariants).
 */
export function variantCombinations(
    options: ProductOptionInput[],
): VariantCombination[] {
    let rows: { option: string; choice: string }[][] = [[]];

    for (const option of options) {
        const name = option.name.trim();
        const next: typeof rows = [];

        for (const row of rows) {
            for (const choice of option.choices) {
                next.push([...row, { option: name, choice: choice.trim() }]);
            }
        }

        rows = next;
    }

    return rows.map((row) => ({
        key: row
            .map(({ option, choice }) => `${option}: ${choice}`)
            .join(' | '),
        label:
            row.length === 0
                ? 'Default'
                : row.map(({ choice }) => choice).join(' / '),
    }));
}
