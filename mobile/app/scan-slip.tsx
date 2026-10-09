import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, Camera, Search } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The Specialist scans a student's issuance slip with the phone's camera
 * (on the student's phone or printed), or types its order number when there
 * is nothing to scan. Either opens the slip with its checks and Release.
 */
export default function ScanSlipScreen() {
    const insets = useSafeAreaInsets();
    const [permission, requestPermission] = useCameraPermissions();
    const [focused, setFocused] = useState(false);
    const [typed, setTyped] = useState('');
    // One scan opens one slip; the camera keeps seeing the QR meanwhile.
    const opening = useRef(false);

    // The camera runs only while this screen is showing; coming back scans again.
    useFocusEffect(
        useCallback(() => {
            opening.current = false;
            setFocused(true);

            return () => setFocused(false);
        }, []),
    );

    const open = (code: string): void => {
        const trimmed = code.trim();

        if (trimmed === '' || opening.current) {
            return;
        }

        opening.current = true;
        router.push({ pathname: '/slip-check', params: { code: trimmed } });
    };

    return (
        <ScrollView
            className="flex-1 bg-page"
            contentContainerStyle={{
                paddingTop: insets.top + 12,
                paddingBottom: insets.bottom + 32,
                paddingHorizontal: 16,
                gap: 16,
            }}
            keyboardShouldPersistTaps="handled"
        >
            <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                className="flex-row items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
                <ArrowLeft size={17} color="#334155" />
                <Text className="font-sans-bold text-sm text-slate-700">Back</Text>
            </Pressable>

            <View>
                <Text className="font-sans-bold text-2xl text-slate-900">Scan Issuance Slip</Text>
                <Text className="mt-1 font-sans text-sm text-slate-500">
                    Point the camera at the QR on the student&apos;s slip.
                </Text>
            </View>

            <View className="aspect-square w-full overflow-hidden rounded-3xl bg-slate-900">
                {permission === null ? (
                    <ActivityIndicator color="#ffffff" className="flex-1" />
                ) : !permission.granted ? (
                    <View className="flex-1 items-center justify-center gap-3 px-6">
                        <Camera size={40} color="#cbd5e1" />
                        <Text className="text-center font-sans-semibold text-sm leading-5 text-white">
                            PROWARE needs the camera to scan issuance slips.
                        </Text>
                        <Pressable
                            onPress={() =>
                                permission.canAskAgain ? void requestPermission() : void Linking.openSettings()
                            }
                            accessibilityRole="button"
                            className="rounded-2xl bg-brand px-6 py-3"
                        >
                            <Text className="font-sans-bold text-sm text-white">
                                {permission.canAskAgain ? 'Allow the camera' : 'Open phone settings'}
                            </Text>
                        </Pressable>
                    </View>
                ) : focused ? (
                    <>
                        <CameraView
                            style={{ flex: 1 }}
                            facing="back"
                            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                            onBarcodeScanned={(result) => open(result.data)}
                        />
                        <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
                            <View className="h-3/5 w-3/5 rounded-3xl border-4 border-white/80" />
                        </View>
                    </>
                ) : null}
            </View>

            <View className="gap-2 rounded-3xl border border-slate-200 bg-white p-4">
                <Text className="font-sans-bold text-sm text-slate-700">Nothing to scan?</Text>
                <Text className="font-sans text-xs text-slate-500">
                    Type the order number from the slip, or find the student under Orders.
                </Text>
                <View className="flex-row items-center gap-2">
                    <TextInput
                        value={typed}
                        onChangeText={setTyped}
                        placeholder="e.g. PW-0042"
                        placeholderTextColor="#94a3b8"
                        autoCapitalize="characters"
                        autoCorrect={false}
                        returnKeyType="search"
                        onSubmitEditing={() => open(typed)}
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3 font-sans-semibold text-sm text-slate-900"
                    />
                    <Pressable
                        onPress={() => open(typed)}
                        disabled={typed.trim() === ''}
                        accessibilityRole="button"
                        className={`flex-row items-center gap-2 rounded-xl bg-brand px-4 py-3 ${typed.trim() === '' ? 'opacity-50' : ''}`}
                    >
                        <Search size={16} color="#ffffff" />
                        <Text className="font-sans-bold text-sm text-white">Find</Text>
                    </Pressable>
                </View>
            </View>
        </ScrollView>
    );
}
