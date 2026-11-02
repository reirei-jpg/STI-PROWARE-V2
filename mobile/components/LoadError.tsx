import { CircleAlert, RotateCw } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

/**
 * Something could not be loaded: what went wrong, and Try again (instead
 * of asking to go back or leaving an empty screen).
 */
export default function LoadError({
    message,
    onRetry,
    className = 'mx-4 mt-4',
}: {
    message: string;
    onRetry: () => Promise<unknown> | void;
    className?: string;
}) {
    const [retrying, setRetrying] = useState(false);

    const retry = async (): Promise<void> => {
        setRetrying(true);

        try {
            await onRetry();
        } finally {
            setRetrying(false);
        }
    };

    return (
        <View className={`gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 ${className}`}>
            <View className="flex-row gap-2">
                <CircleAlert size={18} color="#b91c1c" />
                <Text className="flex-1 font-sans-semibold text-sm leading-5 text-red-700">
                    {message}
                </Text>
            </View>
            <Pressable
                onPress={() => void retry()}
                disabled={retrying}
                accessibilityRole="button"
                className="flex-row items-center justify-center gap-2 self-start rounded-xl border border-red-200 bg-white px-4 py-2.5"
            >
                {retrying ? (
                    <ActivityIndicator size="small" color="#b91c1c" />
                ) : (
                    <RotateCw size={16} color="#b91c1c" />
                )}
                <Text className="font-sans-bold text-sm text-red-700">Try again</Text>
            </Pressable>
        </View>
    );
}
