import { Check, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ServerAddressSetting from '@/components/ServerAddressSetting';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * Signing in with the student's STI email and password (the same account as
 * the website). Microsoft 365 sign-in comes later.
 */
export default function Login() {
    const insets = useSafeAreaInsets();
    const { signIn } = useAuth();

    const passwordInput = useRef<TextInput>(null);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [remember, setRemember] = useState(true);
    const [focused, setFocused] = useState<'email' | 'password' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    const submit = async (): Promise<void> => {
        if (processing) {
            return;
        }

        setError(null);
        setProcessing(true);

        try {
            await signIn(email.trim(), password, remember);
        } catch (caught) {
            setError(
                caught instanceof ApiError
                    ? caught.message
                    : 'Something went wrong. Please try again.',
            );
            setProcessing(false);
        }
    };

    // Like the website, only the email box turns red when the login fails.
    const borderClass = (field: 'email' | 'password'): string =>
        field === 'email' && error
            ? 'border-red-400'
            : focused === field
              ? 'border-brand'
              : 'border-slate-300';

    return (
        <KeyboardAvoidingView
            className="flex-1 bg-page"
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                    flexGrow: 1,
                    justifyContent: 'center',
                    paddingTop: insets.top + 24,
                    paddingBottom: insets.bottom + 24,
                    paddingHorizontal: 20,
                }}
            >
                <View className="rounded-[2.5rem] border border-slate-100 bg-white px-6 py-10 shadow-xl shadow-slate-300/40">
                    <View className="items-center">
                        <Image
                            source={require('../assets/icon.png')}
                            className="h-20 w-20 rounded-2xl"
                        />

                        <Text className="mt-6 font-sans-bold text-4xl tracking-tight text-slate-950">
                            STI PROWARE
                        </Text>

                        <Text className="mt-3 text-center font-sans text-sm leading-6 text-slate-500">
                            Official STI merchandise. Sign in with your STI
                            email to order.
                        </Text>
                    </View>

                    <View className="mt-8 gap-6">
                        <View>
                            <View className="justify-center">
                                <View className="absolute left-5 z-10">
                                    <Mail size={19} color="#64748b" />
                                </View>

                                <TextInput
                                    value={email}
                                    onChangeText={setEmail}
                                    onFocus={() => setFocused('email')}
                                    onBlur={() => setFocused(null)}
                                    onSubmitEditing={() =>
                                        passwordInput.current?.focus()
                                    }
                                    placeholder="STI email"
                                    placeholderTextColor="#94a3b8"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoComplete="email"
                                    autoCorrect={false}
                                    returnKeyType="next"
                                    className={`w-full rounded-full border bg-white py-4 pl-14 pr-5 font-sans-medium text-base text-slate-900 ${borderClass('email')}`}
                                />
                            </View>

                            {error && (
                                <Text className="mt-2 px-4 font-sans text-sm text-red-600">
                                    {error}
                                </Text>
                            )}
                        </View>

                        <View className="justify-center">
                            <View className="absolute left-5 z-10">
                                <LockKeyhole size={19} color="#64748b" />
                            </View>

                            <TextInput
                                ref={passwordInput}
                                value={password}
                                onChangeText={setPassword}
                                onFocus={() => setFocused('password')}
                                onBlur={() => setFocused(null)}
                                onSubmitEditing={submit}
                                placeholder="Password"
                                placeholderTextColor="#94a3b8"
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                autoComplete="current-password"
                                autoCorrect={false}
                                returnKeyType="go"
                                className={`w-full rounded-full border bg-white py-4 pl-14 pr-14 font-sans-medium text-base text-slate-900 ${borderClass('password')}`}
                            />

                            <Pressable
                                onPress={() => setShowPassword((shown) => !shown)}
                                accessibilityRole="button"
                                accessibilityLabel={
                                    showPassword
                                        ? 'Hide password'
                                        : 'Show password'
                                }
                                hitSlop={12}
                                className="absolute right-5 z-10"
                            >
                                {showPassword ? (
                                    <EyeOff size={19} color="#64748b" />
                                ) : (
                                    <Eye size={19} color="#64748b" />
                                )}
                            </Pressable>
                        </View>

                        <Pressable
                            onPress={() => setRemember((value) => !value)}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: remember }}
                            className="flex-row items-center gap-2 px-1"
                        >
                            <View
                                className={`h-5 w-5 items-center justify-center rounded border ${remember ? 'border-brand bg-brand' : 'border-slate-300 bg-white'}`}
                            >
                                {remember && <Check size={14} color="#ffffff" />}
                            </View>

                            <Text className="font-sans-medium text-sm text-slate-600">
                                Keep me signed in on this phone
                            </Text>
                        </Pressable>

                        <Pressable
                            onPress={submit}
                            disabled={processing}
                            accessibilityRole="button"
                            className={`flex-row items-center justify-center gap-2 rounded-full bg-brand py-4 ${processing ? 'opacity-60' : ''}`}
                        >
                            {processing && (
                                <ActivityIndicator size="small" color="#ffffff" />
                            )}

                            <Text className="font-sans-bold text-base text-white">
                                {processing ? 'Signing in...' : 'Sign in'}
                            </Text>
                        </Pressable>
                    </View>

                    <View className="mt-8">
                        <ServerAddressSetting />
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
