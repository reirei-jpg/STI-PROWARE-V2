import { Text, View } from 'react-native';

import ChoiceChip from '@/components/ChoiceChip';
import { choiceIsOpen, type Picked, type PickableVariant, type ProductOption } from '@/lib/option-picker';

/**
 * One option of a product as a row of choices, e.g. "Color: Black, White,
 * Blue", like the website. A choice that does not go with the others chosen
 * is lighter but can still be picked (the others are then cleared); one that
 * is not sold or has no stock at all is crossed out. With `isOut`, a choice
 * that is out of stock (with the others chosen) is crossed out but can still
 * be picked, e.g. to preorder it.
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
        <View className="gap-2">
            <Text className="font-sans-bold text-sm text-slate-700">
                {option.name}
                {picked[option.name] ? (
                    <Text className="font-sans-semibold text-slate-500"> · {picked[option.name]}</Text>
                ) : null}
            </Text>
            <View className="flex-row flex-wrap gap-2">
                {option.choices.map((choice) => {
                    const sold = choiceIsOpen(variants, {}, option.name, choice, canPick);
                    const fitsOthers = choiceIsOpen(variants, picked, option.name, choice, canPick);
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
                        <ChoiceChip
                            key={choice}
                            label={choice}
                            tone={tone}
                            chosen={picked[option.name] === choice}
                            disabled={!sold}
                            faded={!fitsOthers}
                            out={out}
                            onPress={() => onPick(choice)}
                        />
                    );
                })}
            </View>
        </View>
    );
}
