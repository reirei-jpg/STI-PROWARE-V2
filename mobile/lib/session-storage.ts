import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'prowareToken';
const DEVICE_KEY = 'prowareDeviceId';

/*
 * The login token lives in the phone's protected storage, never in plain
 * files. "Remember me" off means the token is only kept in memory, so the
 * student signs in again after closing the app.
 */

export async function readToken(): Promise<string | null> {
    try {
        return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
        return null;
    }
}

export async function saveToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
    try {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
        // Nothing stored, nothing to clear.
    }
}

/**
 * A random name for this phone, so each phone gets its own login token and
 * signing in on a second phone does not sign out the first.
 */
export async function deviceName(): Promise<string> {
    let id: string | null = null;

    try {
        id = await SecureStore.getItemAsync(DEVICE_KEY);

        if (!id) {
            id = Math.random().toString(36).slice(2, 10);
            await SecureStore.setItemAsync(DEVICE_KEY, id);
        }
    } catch {
        id = 'unknown';
    }

    return `Android app ${id}`;
}
