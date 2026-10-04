import { Pressable, Text } from 'react-native';

import { formatPeso } from '@/lib/format';

/**
 * One choice in a picker: a size or color, or Piece / Pack. The chosen one
 * is outlined (blue, or amber for preorders); one that cannot be chosen is
 * dashed and crossed out.
 */
export default function ChoiceChip({
    label,
    chosen,
    disabled = false,
    price = null,
    tone = 'blue',
    onPress,
}: {
    label: string;
    chosen: boolean;
    disabled?: boolean;
    price?: number | null;
    tone?: 'blue' | 'amber';
    onPress: () => void;
}) {
    const chosenClass =
        tone === 'amber' ? 'border-amber-500 bg-amber-50' : 'border-brand bg-blue-50';
    const chosenText = tone === 'amber' ? 'text-amber-900' : 'text-blue-800';

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: chosen, disabled }}
            className={`rounded-xl border-2 px-3.5 py-2.5 ${
                disabled
                    ? 'border-dashed border-slate-200 bg-slate-50'
                    : chosen
                      ? chosenClass
                      : 'border-slate-200 bg-white'
            }`}
        >
            <Text
                className={`font-sans-bold text-sm ${
                    disabled ? 'text-slate-400 line-through' : chosen ? chosenText : 'text-slate-700'
                }`}
            >
                {label}
            </Text>
            {price !== null && (
                <Text className="font-sans text-xs text-slate-500">
                    {formatPeso(price)}
                </Text>
            )}
        </Pressable>
    );
}
