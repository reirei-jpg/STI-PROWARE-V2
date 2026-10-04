import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useAuth } from './auth';
import { useNotifications } from './notifications';

type NotificationsModule = typeof import('expo-notifications');

/** The Android notification channel the server names in every push. */
const CHANNEL_ID = 'orders';

/*
 * Push needs our own build of the app; Expo Go on Android cannot receive it
 * (and complains when the module is even touched), so everything here is
 * skipped there.
 */
const runsInExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

async function loadNotifications(): Promise<NotificationsModule | null> {
    if (runsInExpoGo || Platform.OS !== 'android') {
        return null;
    }

    return import('expo-notifications');
}

/** Asks for permission (Android 13+ shows a prompt) and returns whether it was given. */
async function ensurePermission(Notifications: NotificationsModule): Promise<boolean> {
    const current = await Notifications.getPermissionsAsync();

    if (current.granted) {
        return true;
    }

    return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * Opens what a tapped push is about, like tapping it in Notifications: the
 * order (ready, cancelled) or the item that arrived.
 */
function openFrom(response: {
    notification: { request: { content: { data?: Record<string, unknown> } } };
}): void {
    const data = response.notification.request.content.data ?? {};
    const orderId = Number(data.order_id);
    const productId = Number(data.product_id);

    if (Number.isInteger(orderId) && orderId > 0) {
        router.push(`/order/${orderId}`);
    } else if (Number.isInteger(productId) && productId > 0) {
        router.push(`/product/${productId}`);
    } else {
        router.push('/notifications');
    }
}

/**
 * Renders nothing (copied from V1). While a student is signed in it asks
 * for notification permission, gives the server this phone's Firebase
 * token, refreshes the bell's count when a push arrives, and opens the
 * right screen when one is tapped. Signing out ends the phone's sign-in on
 * the server, which also stops its pushes.
 */
export default function PushHandler() {
    const { user, request } = useAuth();
    const { refresh: refreshUnread } = useNotifications();

    // A tap can be reported twice (cold start and listener): open it once.
    const handled = useRef<string | null>(null);

    useEffect(() => {
        if (!user) {
            return;
        }

        let cancelled = false;
        const cleanups: (() => void)[] = [];

        const registerToken = async (token: string): Promise<void> => {
            try {
                await request('/device-token', {
                    method: 'PUT',
                    body: { token, device_name: Device.deviceName ?? Device.modelName },
                });
            } catch {
                // Push is a convenience; Notifications still works without it.
            }
        };

        void (async () => {
            const Notifications = await loadNotifications();

            if (!Notifications || cancelled) {
                return;
            }

            try {
                Notifications.setNotificationHandler({
                    handleNotification: async () => ({
                        shouldShowBanner: true,
                        shouldShowList: true,
                        shouldPlaySound: true,
                        shouldSetBadge: false,
                    }),
                });

                await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
                    name: 'Order updates',
                    importance: Notifications.AndroidImportance.HIGH,
                });

                const received = Notifications.addNotificationReceivedListener(
                    () => void refreshUnread().catch(() => undefined),
                );
                const tapped = Notifications.addNotificationResponseReceivedListener((response) => {
                    const id = response.notification.request.identifier;

                    if (handled.current !== id) {
                        handled.current = id;
                        openFrom(response);
                    }
                });
                const refreshed = Notifications.addPushTokenListener(
                    (token) => void registerToken(String(token.data)),
                );

                cleanups.push(
                    () => received.remove(),
                    () => tapped.remove(),
                    () => refreshed.remove(),
                );

                // The app was closed and a push opened it.
                const last = await Notifications.getLastNotificationResponseAsync();

                if (last && handled.current !== last.notification.request.identifier) {
                    handled.current = last.notification.request.identifier;
                    openFrom(last);
                }

                if (await ensurePermission(Notifications)) {
                    const token = await Notifications.getDevicePushTokenAsync();

                    await registerToken(String(token.data));
                }
            } catch (caught) {
                // No Firebase in this build, or the phone refused: carry on
                // without push rather than disturb the student.
                console.log('Push notifications are not available:', caught);
            }
        })();

        return () => {
            cancelled = true;
            cleanups.forEach((cleanup) => cleanup());
        };
    }, [user, request, refreshUnread]);

    return null;
}
