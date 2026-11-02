import { CircleAlert, Hourglass, RotateCw, WifiOff } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { OFFLINE_MESSAGE, TOO_SLOW_MESSAGE } from '@/lib/api';

/** Its icon, title and colors tell the situation at a glance. */
function lookOf(message: string) {
    if (message === OFFLINE_MESSAGE) {
        return { title: 'No connection', Icon: WifiOff, tone: 'red' as const };
    }

    if (message === TOO_SLOW_MESSAGE) {
        return { title: 'Connection is slow', Icon: Hourglass, tone: 'amber' as const };
    }

    return { title: 'Could not load', Icon: CircleAlert, tone: 'red' as const };
}

const tones = {
    red: { box: 'border-red-200 bg-red-50', badge: 'bg-red-100', icon: '#b91c1c', title: 'text-red-800', text: 'text-red-700', button: 'border-red-200' },
    amber: { box: 'border-amber-200 bg-amber-50', badge: 'bg-amber-100', icon: '#b45309', title: 'text-amber-900', text: 'text-amber-800', button: 'border-amber-200' },
};

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
    const { title, Icon, tone } = lookOf(message);
    const colors = tones[tone];

    const retry = async (): Promise<void> => {
        setRetrying(true);

        try {
            await onRetry();
        } finally {
            setRetrying(false);
        }
    };

    return (
        <View className={`gap-3 rounded-2xl border p-4 ${colors.box} ${className}`}>
            <View className="flex-row gap-3">
                <View className={`h-10 w-10 items-center justify-center rounded-xl ${colors.badge}`}>
                    <Icon size={20} color={colors.icon} />
                </View>
                <View className="flex-1 gap-0.5">
                    <Text className={`font-sans-bold text-base ${colors.title}`}>{title}</Text>
                    <Text className={`font-sans-semibold text-sm leading-5 ${colors.text}`}>{message}</Text>
                </View>
            </View>
            <Pressable
                onPress={() => void retry()}
                disabled={retrying}
                accessibilityRole="button"
                className={`flex-row items-center justify-center gap-2 self-start rounded-xl border bg-white px-4 py-2.5 ${colors.button}`}
            >
                {retrying ? (
                    <ActivityIndicator size="small" color={colors.icon} />
                ) : (
                    <RotateCw size={16} color={colors.icon} />
                )}
                <Text className={`font-sans-bold text-sm ${colors.text}`}>Try again</Text>
            </Pressable>
        </View>
    );
}
