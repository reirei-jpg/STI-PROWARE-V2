import { Minus, Plus } from 'lucide-react-native';
import { Pressable, Text, TextInput, View } from 'react-native';

/**
 * How many: − and + buttons around a number box, then the unit word
 * ("pcs", "Packs"). The number never goes below 1 or above `most`.
 *
 * Typing changes `value`; a button tap or leaving the box gives the final
 * number to `onCommit` (or to `onChange` when there is no `onCommit`).
 */
export default function QuantityStepper({
    value,
    onChange,
    onCommit,
    most,
    unitText,
    disabled = false,
}: {
    /** The box's text, so the student can clear it while typing. */
    value: string;
    onChange: (value: string) => void;
    onCommit?: (quantity: number) => void;
    most: number;
    unitText: string;
    disabled?: boolean;
}) {
    const quantity = Number(value) || 0;
    const commit = (next: number): void => {
        const kept = Math.max(1, Math.min(next, Math.max(most, 1)));

        if (onCommit) {
            onCommit(kept);
        } else {
            onChange(String(kept));
        }
    };

    return (
        <View className="flex-row items-center gap-2">
            <StepButton
                label="One less"
                disabled={disabled || quantity <= 1}
                onPress={() => commit(quantity - 1)}
            >
                <Minus size={18} color="#334155" />
            </StepButton>

            <TextInput
                value={value}
                onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 4))}
                onEndEditing={() => commit(quantity)}
                editable={!disabled}
                keyboardType="number-pad"
                accessibilityLabel="How many"
                className="h-12 w-20 rounded-xl border border-slate-200 bg-white text-center font-sans-bold text-base text-slate-900"
            />

            <StepButton
                label="One more"
                disabled={disabled || quantity >= most}
                onPress={() => commit(quantity + 1)}
            >
                <Plus size={18} color="#334155" />
            </StepButton>

            <Text className="flex-1 font-sans text-sm text-slate-500">{unitText}</Text>
        </View>
    );
}

function StepButton({
    label,
    disabled,
    onPress,
    children,
}: {
    label: string;
    disabled: boolean;
    onPress: () => void;
    children: React.ReactNode;
}) {
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={label}
            className={`h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white ${disabled ? 'opacity-40' : ''}`}
        >
            {children}
        </Pressable>
    );
}
