import { Tabs } from 'expo-router';
import { Boxes, ClipboardList, Package, Truck, UserRound } from 'lucide-react-native';

const BRAND_BLUE = '#0D6EFD';
const INACTIVE = '#94a3b8';

/**
 * The PROWARE Specialist's tabs: the To-do list (the website dashboard),
 * students' Orders, Deliveries (record what arrived), the Stock lookup, and
 * Profile.
 */
export default function StaffTabsLayout() {
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
                name="todo"
                options={{
                    title: 'To-do',
                    tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="staff-orders"
                options={{
                    title: 'Orders',
                    tabBarIcon: ({ color, size }) => <Package color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="staff-deliveries"
                options={{
                    title: 'Deliveries',
                    tabBarIcon: ({ color, size }) => <Truck color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="staff-stock"
                options={{
                    title: 'Stock',
                    tabBarIcon: ({ color, size }) => <Boxes color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="account"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} />,
                }}
            />
        </Tabs>
    );
}
