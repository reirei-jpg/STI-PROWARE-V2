import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { askBeforeLeaving } from '@/lib/unsaved-changes';
import { useKeyboardHeight } from '@/lib/use-keyboard-height';

/**
 * A panel that slides up from the bottom (like TikTok Shop's picker): a
 * title with Close, the content (scrolls when long), and a footer that
 * always stays visible. Tapping the dimmed area or Back closes it; while
 * typing, Back first only hides the keyboard, so what was typed is kept.
 * With unsaved, closing asks first, "Leave without saving?".
 */
export default function BottomSheet({
    open,
    onClose,
    title,
    subtitle,
    icon,
    footer,
    children,
    unsaved = false,
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    icon?: ReactNode;
    footer: ReactNode;
    children: ReactNode;
    /** Something was typed and not saved: closing asks first. */
    unsaved?: boolean;
}) {
    const insets = useSafeAreaInsets();
    // The sheet is its own window, so it moves up for the keyboard itself.
    const keyboardHeight = useKeyboardHeight();

    const close = (): void => (unsaved ? askBeforeLeaving(onClose) : onClose());

    const onBack = (): void => {
        if (Keyboard.isVisible()) {
            Keyboard.dismiss();

            return;
        }

        close();
    };

    return (
        <Modal
            visible={open}
            transparent
            animationType="slide"
            onRequestClose={onBack}
            statusBarTranslucent
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ paddingBottom: keyboardHeight }}
                className="flex-1 justify-end"
            >
                <Pressable
                    onPress={close}
                    accessibilityLabel="Close"
                    className="absolute inset-0 bg-black/40"
                />

                <View className="max-h-[88%] rounded-t-3xl bg-white">
                    <View className="flex-row items-center gap-3 border-b border-slate-100 px-5 py-4">
                        {icon && (
                            <View className="h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                                {icon}
                            </View>
                        )}
                        <View className="flex-1">
                            <Text className="font-sans-bold text-lg text-slate-900">
                                {title}
                            </Text>
                            {subtitle && (
                                <Text
                                    numberOfLines={1}
                                    className="font-sans text-sm text-slate-500"
                                >
                                    {subtitle}
                                </Text>
                            )}
                        </View>
                        <Pressable
                            onPress={close}
                            accessibilityRole="button"
                            accessibilityLabel="Close"
                            hitSlop={8}
                            className="h-10 w-10 items-center justify-center rounded-xl bg-slate-100"
                        >
                            <X size={20} color="#475569" />
                        </Pressable>
                    </View>

                    <ScrollView
                        contentContainerStyle={{ padding: 20, gap: 20 }}
                        keyboardShouldPersistTaps="handled"
                    >
                        {children}
                    </ScrollView>

                    <View
                        style={{ paddingBottom: insets.bottom + 12 }}
                        className="border-t border-slate-100 px-5 pt-3"
                    >
                        {footer}
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
