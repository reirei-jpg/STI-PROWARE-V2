import '../global.css';

import {
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
    useFonts,
} from '@expo-google-fonts/instrument-sans';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/lib/auth';

/**
 * Signed-in students see the tabs; everyone else sees the login.
 */
function RootNavigator() {
    const { user, restoring } = useAuth();
    const isSignedIn = user !== null;

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
            <Stack.Protected guard={isSignedIn}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="product/[id]" />
            </Stack.Protected>

            <Stack.Protected guard={!isSignedIn}>
                <Stack.Screen name="login" />
            </Stack.Protected>
        </Stack>
    );
}

export default function RootLayout() {
    const [fontsLoaded] = useFonts({
        InstrumentSans_400Regular,
        InstrumentSans_500Medium,
        InstrumentSans_600SemiBold,
        InstrumentSans_700Bold,
    });

    if (!fontsLoaded) {
        return null;
    }

    return (
        <SafeAreaProvider>
            <StatusBar style="dark" />

            <AuthProvider>
                <RootNavigator />
            </AuthProvider>
        </SafeAreaProvider>
    );
}
