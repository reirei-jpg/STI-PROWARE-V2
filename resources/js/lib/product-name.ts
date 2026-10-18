/**
 * One way of writing every product name, the same rule as the server
 * (App\Services\Products\ProductName), so the form can show how a name
 * will be saved: each word starts with a capital letter, school
 * abbreviations stay in capitals, small joining words stay lowercase unless
 * they come first, and words with digits or mixed capitals are kept as typed.
 */
const ABBREVIATIONS = [
    'STI',
    'IT',
    'ID',
    'PE',
    'NSTP',
    'SHS',
    'ABM',
    'HUMSS',
    'STEM',
    'GAS',
    'TVL',
    'ICT',
];

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

function tidyWord(word: string, isFirst: boolean): string {
    // Leading and trailing punctuation, e.g. "(female)" or "set,".
    const parts = /^(\W*)(.*?)(\W*)$/u.exec(word);

    if (!parts || parts[2] === '') {
        return word;
    }

    const [, before, core, after] = parts;
    const upper = core.toUpperCase();
    const lower = core.toLowerCase();
    let tidy = core;

    if (ABBREVIATIONS.includes(upper) || /^BS[A-Z]{1,4}$/.test(upper)) {
        tidy = upper;
    } else if (/\d/.test(core)) {
        tidy = core;
    } else if (!isFirst && SMALL_WORDS.includes(lower)) {
        tidy = lower;
    } else if (core === lower || core === upper) {
        tidy = lower.charAt(0).toUpperCase() + lower.slice(1);
    }

    return before + tidy + after;
}

export function tidyProductName(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .filter((word) => word !== '')
        .map((word, position) =>
            word
                .split('-')
                .map((part) => tidyWord(part, position === 0))
                .join('-'),
        )
        .join(' ');
}
