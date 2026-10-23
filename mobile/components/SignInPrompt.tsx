import { router } from 'expo-router';
import { LogIn } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * In place of a tab that needs an account (Cart, Orders, Profile) while no
 * one is signed in: what the tab is for, and Sign in. Browsing the store
 * needs no sign-in.
 */
export default function SignInPrompt({
    title,
    icon,
    children,
}: {
    title: string;
    icon: ReactNode;
    children: ReactNode;
}) {
    const insets = useSafeAreaInsets();

    return (
        <View className="flex-1 bg-page px-5" style={{ paddingTop: insets.top + 24 }}>
            <Text className="font-sans-bold text-2xl text-slate-900">{title}</Text>

            <View className="mt-5 items-center gap-3 rounded-3xl border border-slate-200 bg-white px-6 py-10">
                <View className="h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
                    {icon}
                </View>
                <Text className="text-center font-sans text-sm leading-6 text-slate-600">
                    {children}
                </Text>
                <Pressable
                    onPress={() => router.push('/login')}
                    accessibilityRole="button"
                    className="mt-2 flex-row items-center justify-center gap-2 self-stretch rounded-2xl bg-brand py-4"
                >
                    <LogIn size={18} color="#ffffff" />
                    <Text className="font-sans-bold text-base text-white">Sign in</Text>
                </Pressable>
            </View>
        </View>
    );
}
