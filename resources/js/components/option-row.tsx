import { choiceIsOpen } from '@/lib/option-picker';
import type {
    Picked,
    PickableVariant,
    ProductOption,
} from '@/lib/option-picker';
import { cn } from '@/lib/utils';

/**
 * One option of a product as a row of choices, e.g. "Color: Black, White,
 * Blue". A choice that does not go with the others chosen is lighter but
 * can still be picked (the others are then cleared); one that is not sold
 * or has no stock at all is crossed out. With `isOut`, a choice that is
 * out of stock (with the others chosen) is crossed out but can still be
 * picked, e.g. to preorder it.
 */
export default function OptionRow<V extends PickableVariant>({
    option,
    picked,
    variants,
    canPick,
    isOut,
    onPick,
    tone = 'blue',
}: {
    option: ProductOption;
    picked: Picked;
    variants: V[];
    canPick: (variant: V) => boolean;
    isOut?: (variant: V) => boolean;
    onPick: (choice: string) => void;
    tone?: 'blue' | 'amber';
}) {
    return (
        <section className="space-y-2">
            <p className="text-sm font-black text-slate-700">
                {option.name}
                {picked[option.name] && (
                    <span className="ml-1.5 font-semibold text-slate-500">
                        · {picked[option.name]}
                    </span>
                )}
            </p>
            <div className="flex flex-wrap gap-2">
                {option.choices.map((choice) => {
                    const chosen = picked[option.name] === choice;
                    const sold = choiceIsOpen(
                        variants,
                        {},
                        option.name,
                        choice,
                        canPick,
                    );
                    const fitsOthers = choiceIsOpen(
                        variants,
                        picked,
                        option.name,
                        choice,
                        canPick,
                    );
                    // Every size that fits is out of stock (still pickable).
                    const out =
                        isOut !== undefined &&
                        sold &&
                        !choiceIsOpen(
                            variants,
                            fitsOthers ? picked : {},
                            option.name,
                            choice,
                            (variant) => canPick(variant) && !isOut(variant),
                        );

                    return (
                        <button
                            key={choice}
                            type="button"
                            disabled={!sold}
                            onClick={() => onPick(choice)}
                            title={
                                !sold
                                    ? 'Not available'
                                    : !fitsOthers
                                      ? 'Not available with your other choice'
                                      : out
                                        ? 'Out of stock'
                                        : undefined
                            }
                            className={cn(
                                'min-w-14 rounded-xl border px-3 py-2 text-sm font-bold transition',
                                chosen
                                    ? tone === 'amber'
                                        ? 'border-amber-500 bg-amber-50 text-amber-900'
                                        : 'border-[#0D6EFD] bg-blue-50 text-blue-800'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                                !chosen &&
                                    sold &&
                                    !fitsOthers &&
                                    'border-dashed text-slate-400',
                                out && 'line-through decoration-slate-400',
                                out &&
                                    !chosen &&
                                    'border-dashed text-slate-400',
                                !sold &&
                                    'cursor-not-allowed border-dashed bg-slate-50 text-slate-400 line-through hover:border-slate-200',
                            )}
                        >
                            {choice}
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
