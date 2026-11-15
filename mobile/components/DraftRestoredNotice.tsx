import { History } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

/**
 * Said at the top of a long form when what was typed before (and not yet
 * saved) was brought back, with a way to start over instead (the website's
 * DraftRestoredNotice).
 */
export default function DraftRestoredNotice({ onDiscard }: { onDiscard: () => void }) {
    return (
        <View className="flex-row items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-3.5 py-3">
            <History size={20} color="#2563eb" />
            <View className="flex-1">
                <Text className="font-sans-bold text-sm text-blue-900">Your unsaved changes were restored.</Text>
                <Text className="font-sans text-xs text-blue-900">Review them, then save.</Text>
            </View>
            <Pressable
                onPress={onDiscard}
                accessibilityRole="button"
                className="rounded-xl border border-blue-200 bg-white px-3 py-2"
            >
                <Text className="font-sans-bold text-xs text-blue-700">Discard changes</Text>
            </Pressable>
        </View>
    );
}
