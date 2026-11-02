import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

/** Still loading after this long: the connection is said to be slow. */
const SLOW_AFTER_MS = 8000;

/**
 * The spinner while a screen loads. After a few seconds it says the
 * connection is slow, so a long wait does not look frozen.
 */
export default function LoadingState({ className = 'mt-10' }: { className?: string }) {
    const [slow, setSlow] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);

        return () => clearTimeout(timer);
    }, []);

    return (
        <View className={`items-center gap-3 px-6 ${className}`}>
            <ActivityIndicator color="#0D6EFD" />
            {slow && (
                <Text className="text-center font-sans-semibold text-sm leading-5 text-amber-700">
                    Still loading. The connection is slow, so this takes longer than usual.
                </Text>
            )}
        </View>
    );
}
