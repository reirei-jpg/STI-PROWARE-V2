import '../global.css';

import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/lib/auth';
import { CartProvider } from '@/lib/cart';
import { NotificationsProvider } from '@/lib/notifications';
import PushHandler from '@/lib/push';
import { useKeyboardHeight } from '@/lib/use-keyboard-height';

/**
 * The app opens on the store: anyone can browse, and signing in is asked
 * for at Add to Cart, Preorder, Cart, Orders and Profile (the login opens
 * on top and closes back to where the student was). A signed-in student
 * also has their orders and slips; the PROWARE Specialist sees their
 * To-do, Orders and Stock instead of the store.
 */
function RootNavigator() {
    const { user, restoring, signInNotice } = useAuth();
    const isSignedIn = user !== null;
    // Students and STI staff (teachers and employees) buy.
    const isStudent = user?.role === 'student' || user?.role === 'employee';
    const isSpecialist = user?.role === 'specialist';

    // A sign-in that expired opens the sign-in screen, which says why. It
    // waits until signing out has moved the app back to the store, which
    // would otherwise close it again.
    useEffect(() => {
        if (restoring || user !== null || signInNotice === null) {
            return;
        }

        const timer = setTimeout(() => router.push('/login'), 700);

        return () => clearTimeout(timer);
    }, [restoring, user, signInNotice]);

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
            <Stack.Protected guard={!isSpecialist}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="product/[id]" />
            </Stack.Protected>

            <Stack.Protected guard={isStudent}>
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
                <Stack.Screen name="login" options={{ presentation: 'modal' }} />
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

    // Every screen ends above the keyboard while it is open, so the box
    // being typed in is never under it (bottom sheets do the same).
    const keyboardHeight = useKeyboardHeight();

    if (!fontsLoaded) {
        return null;
    }

    return (
        <SafeAreaProvider>
            <StatusBar style="dark" />

            <AuthProvider>
                <CartProvider>
                    <NotificationsProvider>
                        <View style={{ flex: 1, paddingBottom: keyboardHeight }}>
                            <RootNavigator />
                        </View>
                        <PushHandler />
                    </NotificationsProvider>
                </CartProvider>
            </AuthProvider>
        </SafeAreaProvider>
    );
}
