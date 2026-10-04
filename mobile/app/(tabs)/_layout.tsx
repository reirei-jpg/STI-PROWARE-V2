import { Tabs } from 'expo-router';
import { Home, UserRound } from 'lucide-react-native';

const BRAND_BLUE = '#0D6EFD';
const INACTIVE = '#94a3b8';

/**
 * The bottom tabs. Cart, Orders and Preorders are added as they are built.
 */
export default function TabsLayout() {
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
