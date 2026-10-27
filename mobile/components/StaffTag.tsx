import { Text, View } from 'react-native';

/**
 * The small "Staff" tag beside a buyer's name on the Specialist's screens,
 * for orders by STI staff (teachers and employees) instead of students (the
 * website's StaffTag).
 */
export default function StaffTag() {
    return (
        <View className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5">
            <Text className="font-sans-bold text-[10px] uppercase tracking-wide text-slate-700">Staff</Text>
        </View>
    );
}
