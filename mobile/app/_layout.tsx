import '../global.css';

import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/lib/auth';
import { CartProvider } from '@/lib/cart';
import { NotificationsProvider } from '@/lib/notifications';
import PushHandler from '@/lib/push';

/**
 * A signed-in student sees the shop; the PROWARE Specialist sees their
 * To-do, Orders and Stock; everyone else sees the login.
 */
function RootNavigator() {
    const { user, restoring } = useAuth();
    const isSignedIn = user !== null;
    const isStudent = user?.role === 'student';
    const isSpecialist = user?.role === 'specialist';

    if (restoring) {
        return null;
    }

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#F3F7FA' },
            }}
        >
            <Stack.Protected guard={isStudent}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="product/[id]" />
                <Stack.Screen name="order/[id]" />
                <Stack.Screen name="slip/[id]" />
            </Stack.Protected>

            <Stack.Protected guard={isSpecialist}>
                <Stack.Screen name="(staff)" />
                <Stack.Screen name="staff-order/[id]" />
                <Stack.Screen name="scan-slip" />
                <Stack.Screen name="slip-check" />
                <Stack.Screen name="stock/[id]" />
                <Stack.Screen name="record-delivery" />
            </Stack.Protected>

            <Stack.Protected guard={isSignedIn}>
                <Stack.Screen name="notifications" />
            </Stack.Protected>

            <Stack.Protected guard={!isSignedIn}>
                <Stack.Screen name="login" />
            </Stack.Protected>
        </Stack>
    );
}

export default function RootLayout() {
    // Aptos, the Microsoft 365 font (regular and bold), as in global.css.
    const [fontsLoaded] = useFonts({
        Aptos: require('../assets/fonts/Aptos-Regular.ttf'),
        'Aptos-Bold': require('../assets/fonts/Aptos-Bold.ttf'),
    });

    if (!fontsLoaded) {
        return null;
    }

    return (
        <SafeAreaProvider>
            <StatusBar style="dark" />

            <AuthProvider>
                <CartProvider>
                    <NotificationsProvider>
                        <RootNavigator />
                        <PushHandler />
                    </NotificationsProvider>
                </CartProvider>
            </AuthProvider>
        </SafeAreaProvider>
    );
}
