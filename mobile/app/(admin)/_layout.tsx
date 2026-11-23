import { Tabs } from 'expo-router';
import { ClipboardList, LayoutDashboard, ReceiptText, Truck, UserRound } from 'lucide-react-native';

const BRAND_BLUE = '#0D6EFD';
const INACTIVE = '#94a3b8';

/**
 * The School Admin's tabs (view only, like the website): the Dashboard, the
 * eStore Orders by what has arrived, Stock In, the cashier's Payments, and
 * Profile.
 */
export default function AdminTabsLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: BRAND_BLUE,
                tabBarInactiveTintColor: INACTIVE,
                tabBarLabelStyle: { fontFamily: 'Aptos-Bold', fontSize: 12 },
                tabBarStyle: { backgroundColor: '#ffffff', borderTopColor: '#e2e8f0' },
            }}
        >
            <Tabs.Screen
                name="admin-home"
                options={{ title: 'Dashboard', tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} /> }}
            />
            <Tabs.Screen
                name="admin-orders"
                options={{ title: 'Orders', tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} /> }}
            />
            <Tabs.Screen
                name="admin-stock-in"
                options={{ title: 'Stock In', tabBarIcon: ({ color, size }) => <Truck color={color} size={size} /> }}
            />
            <Tabs.Screen
                name="admin-payments"
                options={{ title: 'Payments', tabBarIcon: ({ color, size }) => <ReceiptText color={color} size={size} /> }}
            />
            <Tabs.Screen
                name="admin-account"
                options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} /> }}
            />
        </Tabs>
    );
}
