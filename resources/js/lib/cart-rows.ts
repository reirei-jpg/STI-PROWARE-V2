import type { CartLine } from '@/types';

/**
 * One row of the cart as the student sees it: a single item, or a uniform
 * set (its top and bottom lines together, changed and removed as one).
 */
export type CartRow = {
    key: string;
    /** The line used to tick, change or remove the row (the server does the set's other line too). */
    line: CartLine;
    /** Both lines of a set; just the line for a single item. */
    lines: CartLine[];
};

export function cartRows(lines: CartLine[]): CartRow[] {
    const rows: CartRow[] = [];
    const sets = new Map<string, CartRow>();

    for (const line of lines) {
        if (line.set === null) {
            rows.push({ key: `line-${line.id}`, line, lines: [line] });

            continue;
        }

        const row = sets.get(line.set.key);

        if (row) {
            row.lines.push(line);

            continue;
        }

        const newRow = { key: `set-${line.set.key}`, line, lines: [line] };
        sets.set(line.set.key, newRow);
        rows.push(newRow);
    }

    return rows;
}
