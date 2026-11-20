import { Minus, Plus } from 'lucide-react-native';
import { Pressable, Text, TextInput, View } from 'react-native';

import { quantityProblem, typedQuantity } from '@/lib/quantity';

/**
 * How many: − and + buttons around a number box, then the unit word
 * ("pcs", "Packs").
 *
 * The box keeps exactly what was typed (".5", "-1", letters): a wrong amount
 * is outlined in red with the reason under it ("Enter a whole number, e.g.
 * 2.", "Enter at least 1."), and the screen using it stays greyed out
 * (typedQuantity). More than `most` says "Enter N or fewer." unless
 * `keepTyped`, where the screen says what is wrong and `invalid` outlines
 * the box. A button tap, or leaving the box with a right number, gives the
 * number to `onCommit` (or to `onChange` when there is no `onCommit`); a
 * wrong number is never committed.
 */
export default function QuantityStepper({
    value,
    onChange,
    onCommit,
    most,
    unitText,
    disabled = false,
    showLeft = true,
    keepTyped = false,
    invalid = false,
}: {
    /** The box's text, so the student can clear it while typing. */
    value: string;
    onChange: (value: string) => void;
    onCommit?: (quantity: number) => void;
    most: number;
    unitText: string;
    disabled?: boolean;
    /** "Only N left" at the most (off where the most is not what is left in stock). */
    showLeft?: boolean;
    keepTyped?: boolean;
    invalid?: boolean;
}) {
    const quantity = typedQuantity(value) ?? 0;
    const cap = Math.max(most, 1);
    const typedCap = keepTyped ? Number.MAX_SAFE_INTEGER : cap;
    const problem = quantityProblem(value) ?? (!keepTyped && quantity > cap ? `Enter ${cap} or fewer.` : null);
    const wrong = invalid || problem !== null;
    const commit = (next: number, cap = Math.max(most, 1)): void => {
        const kept = Math.max(1, Math.min(next, cap));

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
                // Kept as typed: a wrong amount shows in red instead of changing.
                onChangeText={(text) => onChange(text.slice(0, 12))}
                // Only a right number is committed (e.g. saved in the cart).
                onEndEditing={() => {
                    if (problem === null || (keepTyped && quantityProblem(value) === null)) {
                        commit(quantity, typedCap);
                    }
                }}
                editable={!disabled}
                keyboardType="numbers-and-punctuation"
                accessibilityLabel="How many"
                className={`h-12 w-20 rounded-xl border text-center font-sans-bold text-base ${wrong ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-900'}`}
            />

            <StepButton
                label="One more"
                disabled={disabled || quantity >= most}
                onPress={() => commit(quantity + 1)}
            >
                <Plus size={18} color="#334155" />
            </StepButton>

            <View className="flex-1">
                <Text className="font-sans text-sm text-slate-500">{unitText}</Text>
                {problem !== null && <Text className="font-sans-bold text-xs text-red-600">{problem}</Text>}
                {showLeft && !wrong && most > 0 && quantity >= most && (
                    <Text className="font-sans-bold text-xs text-amber-700">Only {most} left</Text>
                )}
            </View>
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
