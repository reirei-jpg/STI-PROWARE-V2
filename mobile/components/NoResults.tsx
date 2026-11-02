import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

/**
 * An empty list: what is missing, a hint of what to try, and, after a
 * search, Clear search (instead of only "nothing found").
 */
export default function NoResults({
    icon,
    title,
    hint,
    onClearSearch,
}: {
    icon: ReactNode;
    title: string;
    hint?: string;
    onClearSearch?: () => void;
}) {
    return (
        <View className="items-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12">
            {icon}
            <Text className="mt-3 text-center font-sans-bold text-base text-slate-700">{title}</Text>
            {hint ? (
                <Text className="mt-1 text-center font-sans text-sm leading-5 text-slate-500">{hint}</Text>
            ) : null}
            {onClearSearch ? (
                <Pressable
                    onPress={onClearSearch}
                    accessibilityRole="button"
                    className="mt-4 flex-row items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5"
                >
                    <X size={16} color="#334155" />
                    <Text className="font-sans-bold text-sm text-slate-700">Clear search</Text>
                </Pressable>
            ) : null}
        </View>
    );
}
