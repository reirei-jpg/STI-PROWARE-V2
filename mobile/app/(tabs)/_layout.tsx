import { Tabs } from 'expo-router';
import { Home, ShoppingCart, UserRound } from 'lucide-react-native';

import { useCart } from '@/lib/cart';

const BRAND_BLUE = '#0D6EFD';
const INACTIVE = '#94a3b8';

/**
 * The bottom tabs. The Cart tab shows how many items are in the cart.
 * Orders and Preorders are added as they are built.
 */
export default function TabsLayout() {
    const { cart } = useCart();
    const inCart = cart?.lines.length ?? 0;

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: BRAND_BLUE,
                tabBarInactiveTintColor: INACTIVE,
                tabBarLabelStyle: {
                    fontFamily: 'InstrumentSans_600SemiBold',
                    fontSize: 11,
                },
                tabBarStyle: {
                    backgroundColor: '#ffffff',
                    borderTopColor: '#e2e8f0',
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color, size }) => (
                        <Home color={color} size={size} />
                    ),
                }}
            />

            <Tabs.Screen
                name="cart"
                options={{
                    title: 'Cart',
                    tabBarIcon: ({ color, size }) => (
                        <ShoppingCart color={color} size={size} />
                    ),
                    tabBarBadge: inCart > 0 ? inCart : undefined,
                    tabBarBadgeStyle: {
                        backgroundColor: '#ef4444',
                        fontFamily: 'InstrumentSans_700Bold',
                        fontSize: 11,
                    },
                }}
            />

            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color, size }) => (
                        <UserRound color={color} size={size} />
                    ),
                }}
            />
        </Tabs>
    );
}
