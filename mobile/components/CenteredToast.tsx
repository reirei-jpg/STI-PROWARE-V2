import { CheckCircle2, X, XCircle } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/** How long a toast stays, as on the website. */
const AUTO_CLOSE_AFTER_MS = 6000;

export type ToastMessage = {
    type: 'success' | 'error';
    message: string;
    /** An optional Undo (or other quick fix) for what just happened. */
    action?: { label: string; onPress: () => void };
};

/**
 * A toast in the middle of the screen, like the website's: for something
 * that already happened, with an optional Undo, closing by itself. The
 * screen behind it can still be used.
 */
export default function CenteredToast({
    toast,
    onClose,
}: {
    toast: ToastMessage | null;
    onClose: () => void;
}) {
    useEffect(() => {
        // An error must be read, so it stays until it is closed.
        if (!toast || toast.type === 'error') {
            return;
        }

        const timer = setTimeout(onClose, AUTO_CLOSE_AFTER_MS);

        return () => clearTimeout(timer);
    }, [toast, onClose]);

    if (!toast) {
        return null;
    }

    const good = toast.type === 'success';

    return (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill} className="items-center justify-center px-6">
            <View
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                className={`w-full max-w-md overflow-hidden rounded-2xl border bg-white shadow-xl shadow-slate-900/20 ${good ? 'border-emerald-200' : 'border-red-200'}`}
            >
                <View className={`h-1.5 ${good ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <View className="flex-row items-start gap-3 p-4">
                    <View
                        className={`h-10 w-10 items-center justify-center rounded-xl ${good ? 'bg-emerald-100' : 'bg-red-100'}`}
                    >
                        {good ? <CheckCircle2 size={22} color="#059669" /> : <XCircle size={22} color="#dc2626" />}
                    </View>
                    <View className="min-w-0 flex-1 gap-3">
                        <Text className="font-sans-semibold text-sm leading-5 text-slate-700">{toast.message}</Text>
                        {toast.action && (
                            <Pressable
                                onPress={toast.action.onPress}
                                accessibilityRole="button"
                                className="self-start rounded-xl bg-brand px-4 py-2.5"
                            >
                                <Text className="font-sans-bold text-sm text-white">{toast.action.label}</Text>
                            </Pressable>
                        )}
                    </View>
                    <Pressable
                        onPress={onClose}
                        accessibilityRole="button"
                        accessibilityLabel="Close message"
                        hitSlop={10}
                        className="rounded-lg p-1"
                    >
                        <X size={18} color="#94a3b8" />
                    </Pressable>
                </View>
            </View>
        </View>
    );
}
