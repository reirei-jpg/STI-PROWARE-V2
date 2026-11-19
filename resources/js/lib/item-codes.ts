import type { VariantCombination } from '@/lib/product-variants';

/** Small joining words skipped when making a code (as App\Services\Products\ProductName). */
const SMALL_WORDS = [
    'a',
    'an',
    'and',
    'of',
    'for',
    'the',
    'in',
    'on',
    'with',
    'to',
    'or',
];

const words = (text: string): string[] =>
    text
        .toUpperCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean);

/**
 * The start of a product's code: the first letters of its first two words
 * ("Bagong Product" → BP), or the first two letters of a one-word name
 * ("Lanyard" → LA). The same as App\Services\Products\ProductCode::prefix.
 */
export function productCodePrefix(name: string): string {
    const kept = words(name).filter(
        (word) => !SMALL_WORDS.includes(word.toLowerCase()),
    );

    const prefix =
        kept.length >= 2
            ? kept[0].slice(0, 1) + kept[1].slice(0, 1)
            : kept.length === 1
              ? kept[0].slice(0, 2)
              : 'PR';

    return prefix.length < 2 ? `${prefix}X` : prefix;
}

/**
 * The next free code for a product with this name, e.g. BP-02 when BP-01
 * is taken; empty while there is no name.
 */
export function nextProductCode(name: string, usedCodes: string[]): string {
    if (name.trim() === '') {
        return '';
    }

    const prefix = productCodePrefix(name);
    const numbered = new RegExp(`^${prefix}-(\\d+)$`);
    const highest = Math.max(
        0,
        ...usedCodes.map((code) => Number(numbered.exec(code)?.[1] ?? 0)),
    );

    return `${prefix}-${String(highest + 1).padStart(2, '0')}`;
}

/**
 * A short form of one choice: "Grade 11 (Senior High)" → G11, "Navy Blue"
 * → NAVY, "500 ml" → 500ML, "S" → S.
 */
function shortChoice(choice: string): string {
    const grade = /grade\s*(\d+)/i.exec(choice);

    if (grade) {
        return `G${grade[1]}`;
    }

    const parts = words(choice);

    if (parts.length === 0) {
        return '';
    }

    return /^\d+$/.test(parts[0]) && parts.length > 1
        ? parts[0] + parts[1]
        : parts[0];
}

/**
 * The short form of every choice of each option. Two choices of one option
 * that would get the same short form (Light Blue, Light Gray) use all their
 * words instead (LIGHTBLUE, LIGHTGRAY).
 */
function shortChoices(
    combinations: VariantCombination[],
): Map<string, Map<string, string>> {
    const byOption = new Map<string, Set<string>>();

    for (const combination of combinations) {
        for (const { option, choice } of combination.choices) {
            byOption.set(
                option,
                (byOption.get(option) ?? new Set()).add(choice),
            );
        }
    }

    const shorts = new Map<string, Map<string, string>>();

    for (const [option, choices] of byOption) {
        const first = new Map(
            [...choices].map((choice) => [choice, shortChoice(choice)]),
        );
        const repeated = new Set(
            [...first.values()].filter(
                (short, index, all) => all.indexOf(short) !== index,
            ),
        );

        shorts.set(
            option,
            new Map(
                [...first].map(([choice, short]) => [
                    choice,
                    repeated.has(short) ? words(choice).join('') : short,
                ]),
            ),
        );
    }

    return shorts;
}

/**
 * Each variant's own code, made from the product's code and its choices:
 * BP-01 with S, Grade 11, Navy Blue → BP-01-S-G11-NAVY. A product without
 * options uses the product's code. By combination key.
 */
export function variantCodes(
    productCode: string,
    combinations: VariantCombination[],
): Record<string, string> {
    const code = productCode.trim().toUpperCase();
    const shorts = shortChoices(combinations);

    return Object.fromEntries(
        combinations.map((combination) => [
            combination.key,
            code === ''
                ? ''
                : [
                      code,
                      ...combination.choices.map(
                          ({ option, choice }) =>
                              shorts.get(option)?.get(choice) ?? '',
                      ),
                  ]
                      .filter(Boolean)
                      .join('-'),
        ]),
    );
}
