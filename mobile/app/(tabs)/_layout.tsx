import { Tabs } from 'expo-router';
import { Home, Package, ShoppingCart, UserRound } from 'lucide-react-native';

import { useCart } from '@/lib/cart';
import { cartRows } from '@/lib/cart-rows';

const BRAND_BLUE = '#0D6EFD';
const INACTIVE = '#94a3b8';

/**
 * The bottom tabs. The Cart tab shows how many items are in the cart;
 * Orders holds both My Orders and My Preorders.
 */
export default function TabsLayout() {
    const { cart } = useCart();
    // A uniform set's two lines count as one.
    const inCart = cartRows(cart?.lines ?? []).length;

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: BRAND_BLUE,
                tabBarInactiveTintColor: INACTIVE,
                tabBarLabelStyle: {
                    fontFamily: 'Aptos-Bold',
                    fontSize: 12,
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
                        fontFamily: 'Aptos-Bold',
                        fontSize: 12,
                    },
                }}
            />

            <Tabs.Screen
                name="orders"
                options={{
                    title: 'Orders',
                    tabBarIcon: ({ color, size }) => (
                        <Package color={color} size={size} />
                    ),
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
