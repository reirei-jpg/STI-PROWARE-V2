import { Store } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';

/**
 * Home. For now it confirms the student is signed in to V2; the storefront
 * (Coming Soon, On Sale, All Merchandise) is the next step.
 */
export default function HomeScreen() {
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const firstName = user?.name.split(' ')[0] ?? '';

    return (
        <View
            className="flex-1 bg-page px-5"
            style={{ paddingTop: insets.top + 24 }}
        >
            <View className="rounded-3xl bg-brand px-6 py-8">
                <Text className="font-sans-semibold text-sm uppercase tracking-wide text-blue-100">
                    STI PROWARE
                </Text>
                <Text className="mt-1 font-sans-bold text-2xl text-white">
                    Hi, {firstName}
                </Text>
                <Text className="mt-2 font-sans text-sm leading-6 text-blue-50">
                    You are signed in to PROWARE V2.
                </Text>
            </View>

            <View className="mt-6 items-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12">
                <Store size={40} color="#cbd5e1" />
                <Text className="mt-3 text-center font-sans-bold text-lg text-slate-800">
                    The store is coming next
                </Text>
                <Text className="mt-1 text-center font-sans text-sm leading-6 text-slate-500">
                    Coming Soon, On Sale and All Merchandise will show here.
                </Text>
            </View>
        </View>
    );
}
