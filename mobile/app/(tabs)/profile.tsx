import Constants from 'expo-constants';
import { LogOut, Mail, Server, UserRound } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { describeServer } from '@/lib/config';

/**
 * The student's account on this phone, and Log out.
 */
export default function ProfileScreen() {
    const insets = useSafeAreaInsets();
    const { user, signOut } = useAuth();
    const [signingOut, setSigningOut] = useState(false);

    const confirmSignOut = (): void => {
        Alert.alert('Log out?', 'You will need to sign in again on this phone.', [
            { text: 'Stay signed in', style: 'cancel' },
            {
                text: 'Log out',
                style: 'destructive',
                onPress: () => {
                    setSigningOut(true);
                    void signOut();
                },
            },
        ]);
    };

    return (
        <View
            className="flex-1 bg-page px-5"
            style={{ paddingTop: insets.top + 24 }}
        >
            <Text className="font-sans-bold text-2xl text-slate-900">
                Profile
            </Text>

            <View className="mt-5 gap-4 rounded-3xl border border-slate-200 bg-white p-5">
                <Row icon={<UserRound size={18} color="#2563eb" />} label="Name">
                    {user?.name}
                </Row>
                <Row icon={<Mail size={18} color="#2563eb" />} label="STI email">
                    {user?.email}
                </Row>
                <Row icon={<Server size={18} color="#2563eb" />} label="Server">
                    {describeServer()}
                </Row>
            </View>

            <Pressable
                onPress={confirmSignOut}
                disabled={signingOut}
                accessibilityRole="button"
                className={`mt-6 flex-row items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 py-4 ${signingOut ? 'opacity-60' : ''}`}
            >
                <LogOut size={18} color="#b91c1c" />
                <Text className="font-sans-bold text-base text-red-700">
                    Log out
                </Text>
            </Pressable>

            <Text className="mt-6 text-center font-sans text-xs text-slate-400">
                STI PROWARE V2 · version {Constants.expoConfig?.version ?? '2.0.0'}
            </Text>
        </View>
    );
}

function Row({
    icon,
    label,
    children,
}: {
    icon: ReactNode;
    label: string;
    children: ReactNode;
}) {
    return (
        <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                {icon}
            </View>
            <View className="flex-1">
                <Text className="font-sans text-xs text-slate-500">{label}</Text>
                <Text className="font-sans-semibold text-base text-slate-900">
                    {children}
                </Text>
            </View>
        </View>
    );
}
