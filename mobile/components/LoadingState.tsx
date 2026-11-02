import { Hourglass } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

/** Still loading after this long: the connection is said to be slow. */
const SLOW_AFTER_MS = 8000;

/**
 * The spinner while a screen loads. After a few seconds it says the
 * connection is slow, so a long wait does not look frozen. A screen with
 * several spinners (one per section) turns the note off on them and shows
 * one SlowNote for the whole screen instead.
 */
export default function LoadingState({
    className = 'mt-10',
    slowNote = true,
}: {
    className?: string;
    slowNote?: boolean;
}) {
    return (
        <View className={`items-center gap-3 px-6 ${className}`}>
            <ActivityIndicator color="#0D6EFD" />
            {slowNote && <SlowNote />}
        </View>
    );
}

/** "Still loading. Your internet connection is slow.", after a few seconds. */
export function SlowNote() {
    const [slow, setSlow] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);

        return () => clearTimeout(timer);
    }, []);

    if (!slow) {
        return null;
    }

    return (
        <View className="flex-row items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-amber-100">
                <Hourglass size={18} color="#b45309" />
            </View>
            <View className="shrink gap-0.5">
                <Text className="font-sans-bold text-sm text-amber-900">Still loading</Text>
                <Text className="font-sans-semibold text-sm text-amber-800">
                    Your internet connection is slow.
                </Text>
            </View>
        </View>
    );
}
