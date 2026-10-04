import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';

/*
 * Where the app finds the PROWARE server.
 *
 * The address the app starts with comes from EXPO_PUBLIC_API_URL when the app
 * is built (for example the online server, or the laptop's Wi-Fi address).
 * The student can change it on the login screen (saved on the phone), which
 * is what makes the app usable on a different Wi-Fi without rebuilding it.
 *
 * Without EXPO_PUBLIC_API_URL, during development:
 * - the Android emulator reaches the laptop it runs on as 10.0.2.2;
 * - a real phone plugged in by USB reaches the laptop as "localhost" once
 *   `adb reverse tcp:8000 tcp:8000` has been run.
 */
const DEVELOPMENT_URL = Device.isDevice
    ? 'http://localhost:8000/api/v1'
    : 'http://10.0.2.2:8000/api/v1';

export const DEFAULT_API_URL: string =
    process.env.EXPO_PUBLIC_API_URL ?? DEVELOPMENT_URL;

const STORAGE_KEY = 'proware_server_address';

let currentApiUrl: string = DEFAULT_API_URL;

/** The address every request goes to (ends with /api/v1). */
export function getApiUrl(): string {
    return currentApiUrl;
}

/** The server's own address (no /api/v1). */
export function getServerUrl(): string {
    return currentApiUrl.replace(/\/api\/v1\/?$/, '');
}

/** The address as a person reads it, without http:// and /api/v1. */
export function describeServer(apiUrl: string = currentApiUrl): string {
    return apiUrl.replace(/^https?:\/\//, '').replace(/\/api\/v1\/?$/, '');
}

/**
 * Turns what a person typed ("192.168.8.42:8001", "http://192.168.8.42:8001",
 * "https://prowareapp.example") into the API address, or null when it is not
 * an address. http:// is assumed when no scheme is typed.
 */
export function normalizeServerAddress(input: string): string | null {
    const text = input.trim();

    if (text === '') {
        return null;
    }

    const withScheme = /^https?:\/\//i.test(text) ? text : `http://${text}`;
    const match = withScheme.match(
        /^(https?):\/\/([A-Za-z0-9.-]+)(?::(\d{1,5}))?(\/[^\s?#]*)?$/i,
    );

    if (!match) {
        return null;
    }

    const [, scheme, host, port, rawPath] = match;
    const path = (rawPath ?? '').replace(/\/+$/, '');

    return `${scheme.toLowerCase()}://${host}${port ? `:${port}` : ''}${
        path.endsWith('/api/v1') ? path : `${path}/api/v1`
    }`;
}

/** Loads the address saved on this phone, if there is one. Call once at start. */
export async function loadSavedServerAddress(): Promise<void> {
    try {
        const saved = await SecureStore.getItemAsync(STORAGE_KEY);

        if (saved) {
            currentApiUrl = saved;
        }
    } catch {
        // Keep the built-in address.
    }
}

/** Uses and remembers a new address (already normalized), or forgets it with null. */
export async function saveServerAddress(apiUrl: string | null): Promise<void> {
    currentApiUrl = apiUrl ?? DEFAULT_API_URL;

    try {
        if (apiUrl) {
            await SecureStore.setItemAsync(STORAGE_KEY, apiUrl);
        } else {
            await SecureStore.deleteItemAsync(STORAGE_KEY);
        }
    } catch {
        // The address still works for this session.
    }
}

export type ServerCheck = 'ok' | 'unreachable' | 'not-proware';

/**
 * Asks the address something harmless. Any JSON answer (even "please sign in")
 * means a PROWARE server is there.
 */
export async function checkServer(apiUrl: string): Promise<ServerCheck> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);

    try {
        const response = await fetch(`${apiUrl}/storefront`, {
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        });

        return (response.headers.get('content-type') ?? '').includes(
            'application/json',
        )
            ? 'ok'
            : 'not-proware';
    } catch {
        return 'unreachable';
    } finally {
        clearTimeout(timer);
    }
}
