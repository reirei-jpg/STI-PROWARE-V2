import { Server } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import {
    checkServer,
    DEFAULT_API_URL,
    describeServer,
    getApiUrl,
    normalizeServerAddress,
    saveServerAddress,
} from '@/lib/config';

/**
 * A small setting on the login screen for where the PROWARE server is. It lets
 * the app be used on a different Wi-Fi (the laptop has a new address there)
 * without building the app again.
 */
export default function ServerAddressSetting() {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState('');
    const [current, setCurrent] = useState(getApiUrl());
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{
        kind: 'good' | 'bad';
        text: string;
    } | null>(null);

    const toggle = (): void => {
        setOpen((shown) => !shown);
        setText(describeServer(current));
        setMessage(null);
    };

    const save = async (): Promise<void> => {
        const apiUrl = normalizeServerAddress(text);

        if (apiUrl === null) {
            setMessage({
                kind: 'bad',
                text: 'That is not an address. Type it like 192.168.8.42:8001.',
            });

            return;
        }

        setBusy(true);
        setMessage(null);

        const result = await checkServer(apiUrl);

        if (result === 'ok') {
            await saveServerAddress(apiUrl);
            setCurrent(apiUrl);
            setMessage({
                kind: 'good',
                text: `Connected. The app will use ${describeServer(apiUrl)}.`,
            });
        } else {
            setMessage({
                kind: 'bad',
                text:
                    result === 'unreachable'
                        ? 'Cannot reach that address. Check that your phone and the laptop are on the same Wi-Fi and that the server is running. The address was not saved.'
                        : 'Something answered, but it is not the PROWARE server. The address was not saved.',
            });
        }

        setBusy(false);
    };

    const reset = async (): Promise<void> => {
        await saveServerAddress(null);
        setCurrent(DEFAULT_API_URL);
        setText(describeServer(DEFAULT_API_URL));
        setMessage({
            kind: 'good',
            text: `Back to the built-in address: ${describeServer(DEFAULT_API_URL)}.`,
        });
    };

    return (
        <View className="items-center gap-3">
            <Pressable
                onPress={toggle}
                accessibilityRole="button"
                accessibilityLabel="Change server address"
                hitSlop={8}
                className="flex-row items-center gap-1.5"
            >
                <Server size={13} color="#94a3b8" />

                <Text className="font-sans text-xs text-slate-400">
                    Server: {describeServer(current)} ·{' '}
                    <Text className="font-sans-semibold text-brand">
                        {open ? 'Close' : 'Change'}
                    </Text>
                </Text>
            </Pressable>

            {open && (
                <View className="w-full gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <Text className="font-sans-semibold text-xs leading-5 text-slate-600">
                        The server's address on this Wi-Fi, for example
                        192.168.8.42:8001. It changes on every network.
                    </Text>

                    <TextInput
                        value={text}
                        onChangeText={(value) => {
                            setText(value);
                            setMessage(null);
                        }}
                        placeholder="192.168.8.42:8001"
                        placeholderTextColor="#94a3b8"
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        editable={!busy}
                        accessibilityLabel="Server address"
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-sans-medium text-sm text-slate-900"
                    />

                    {message && (
                        <Text
                            className={`font-sans-semibold text-xs leading-5 ${message.kind === 'good' ? 'text-green-700' : 'text-red-700'}`}
                        >
                            {message.text}
                        </Text>
                    )}

                    <View className="flex-row gap-2">
                        <Pressable
                            onPress={() => void save()}
                            disabled={busy}
                            accessibilityRole="button"
                            className="flex-1 flex-row items-center justify-center gap-2 rounded-full bg-brand py-2.5"
                        >
                            {busy && (
                                <ActivityIndicator size="small" color="#ffffff" />
                            )}

                            <Text className="font-sans-bold text-sm text-white">
                                Test and save
                            </Text>
                        </Pressable>

                        <Pressable
                            onPress={() => void reset()}
                            disabled={busy}
                            accessibilityRole="button"
                            className="items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5"
                        >
                            <Text className="font-sans-bold text-sm text-slate-700">
                                Reset
                            </Text>
                        </Pressable>
                    </View>
                </View>
            )}
        </View>
    );
}
