import { CheckCircle2, Circle } from 'lucide-react-native';
import { Pressable, Text, TextInput, View } from 'react-native';

import type { CancelReasonOption } from '@/lib/cancel-reasons';

/**
 * Pick why an order is cancelled, like in online shops: one reason from the
 * list, and a box to write why only for Other.
 */
export default function CancelReasonList({
    reasons,
    reason,
    note,
    onReason,
    onNote,
    notePlaceholder,
}: {
    reasons: CancelReasonOption[];
    reason: string;
    note: string;
    onReason: (value: string) => void;
    onNote: (value: string) => void;
    notePlaceholder: string;
}) {
    return (
        <View className="gap-2">
            {reasons.map((option) => {
                const chosen = reason === option.value;

                return (
                    <Pressable
                        key={option.value}
                        onPress={() => onReason(option.value)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: chosen }}
                        className={`flex-row items-center gap-3 rounded-xl border px-4 py-3 ${chosen ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}
                    >
                        {chosen ? <CheckCircle2 size={19} color="#dc2626" /> : <Circle size={19} color="#cbd5e1" />}
                        <Text className={`flex-1 font-sans-semibold text-sm ${chosen ? 'text-red-800' : 'text-slate-700'}`}>
                            {option.label}
                        </Text>
                    </Pressable>
                );
            })}

            {reason === 'other' && (
                <View className="gap-1.5 pt-1">
                    <Text className="font-sans-bold text-sm text-slate-700">Write why</Text>
                    <TextInput
                        value={note}
                        onChangeText={onNote}
                        placeholder={notePlaceholder}
                        placeholderTextColor="#94a3b8"
                        maxLength={200}
                        multiline
                        autoFocus
                        className="min-h-24 rounded-xl border border-slate-200 bg-white px-3 py-3 font-sans text-sm text-slate-900"
                        style={{ textAlignVertical: 'top' }}
                    />
                </View>
            )}
        </View>
    );
}
