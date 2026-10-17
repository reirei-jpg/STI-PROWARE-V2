/**
 * Choosing a product's options one row at a time (Capacity, then Color),
 * like online shops, instead of one long list of every combination. A
 * choice is open when some variant that can be picked has it together with
 * the other choices made so far; picking it clears the other choices that no
 * longer fit, so the student never ends up on a combination that is not sold.
 */

export type PickableVariant = {
    id: number;
    choices: Record<string, string>;
};

export type ProductOption = { name: string; choices: string[] };

/** The choice made for each option so far, e.g. { Capacity: '14 oz' }. */
export type Picked = Record<string, string>;

function fits(variant: PickableVariant, picked: Picked): boolean {
    return Object.entries(picked).every(
        ([option, choice]) => variant.choices[option] === choice,
    );
}

/** Whether this choice can still be picked with the other choices made. */
export function choiceIsOpen<V extends PickableVariant>(
    variants: V[],
    picked: Picked,
    option: string,
    choice: string,
    canPick: (variant: V) => boolean,
): boolean {
    const others = Object.fromEntries(
        Object.entries(picked).filter(([name]) => name !== option),
    );

    return variants.some(
        (variant) =>
            canPick(variant) &&
            variant.choices[option] === choice &&
            fits(variant, others),
    );
}

/**
 * Pick a choice; other choices that cannot go with it are cleared, the
 * last ones first.
 */
export function pickChoice<V extends PickableVariant>(
    variants: V[],
    options: ProductOption[],
    picked: Picked,
    option: string,
    choice: string,
    canPick: (variant: V) => boolean,
): Picked {
    const next: Picked = { ...picked, [option]: choice };

    for (const other of [...options].reverse()) {
        if (variants.some((variant) => canPick(variant) && fits(variant, next))) {
            break;
        }

        if (other.name !== option) {
            delete next[other.name];
        }
    }

    return next;
}

/** The variant once every option is chosen (or the only one there is). */
export function pickedVariant<V extends PickableVariant>(
    variants: V[],
    options: ProductOption[],
    picked: Picked,
): V | undefined {
    if (options.length === 0) {
        return variants.length === 1 ? variants[0] : undefined;
    }

    if (!options.every((option) => picked[option.name] !== undefined)) {
        return undefined;
    }

    return variants.find((variant) => fits(variant, picked));
}

/** The choices to start with: those of the only variant there is. */
export function startingPicks<V extends PickableVariant>(
    variants: V[],
    canPick: (variant: V) => boolean,
): Picked {
    return variants.length === 1 && canPick(variants[0])
        ? { ...variants[0].choices }
        : {};
}
