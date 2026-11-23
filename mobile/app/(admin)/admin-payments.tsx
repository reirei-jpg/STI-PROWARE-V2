import { router } from 'expo-router';
import { ChevronRight, ReceiptText, Wallet } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Payments on the School Admin's phone (view only, like the website): the
 * cashier's Payment History and Collections, the same screens the cashier
 * has.
 */
export default function AdminPaymentsScreen() {
    const insets = useSafeAreaInsets();

    return (
        <ScrollView
            className="flex-1 bg-page"
            contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32, paddingHorizontal: 16, gap: 14 }}
        >
            <View>
                <Text className="font-sans-bold text-2xl text-slate-900">Payments</Text>
                <Text className="mt-1 font-sans text-sm text-slate-500">What the cashier collected and the receipts given. View only.</Text>
            </View>

            <View className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                <MenuLink
                    icon={<ReceiptText size={18} color="#1d4ed8" />}
                    label="Payment History"
                    detail="Every Payment Receipt, with filters"
                    onPress={() => router.push('/cashier-history')}
                    first
                />
                <MenuLink
                    icon={<Wallet size={18} color="#1d4ed8" />}
                    label="Collections"
                    detail="The money collected by day or month"
                    onPress={() => router.push('/cashier-collections')}
                />
            </View>
        </ScrollView>
    );
}

function MenuLink({ icon, label, detail, onPress, first = false }: { icon: ReactNode; label: string; detail: string; onPress: () => void; first?: boolean }) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            className={`flex-row items-center gap-3 px-4 py-4 ${first ? '' : 'border-t border-slate-100'}`}
        >
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-blue-50">{icon}</View>
            <View className="flex-1">
                <Text className="font-sans-bold text-base text-slate-900">{label}</Text>
                <Text className="font-sans text-xs text-slate-500">{detail}</Text>
            </View>
            <ChevronRight size={18} color="#94a3b8" />
        </Pressable>
    );
}
