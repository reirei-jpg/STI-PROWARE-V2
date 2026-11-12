import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';

/**
 * Back from an order or its issuance slip: once the order is released there
 * is nothing left to track, so it goes to the store (Home); otherwise back
 * to where the buyer came from. The phone's own back button does the same.
 */
export function useBackFromOrder(released: boolean): () => void {
    const goBack = useCallback(() => {
        if (!released) {
            router.back();

            return;
        }

        if (router.canDismiss()) {
            router.dismissAll();
        }

        router.navigate('/');
    }, [released]);

    useFocusEffect(
        useCallback(() => {
            if (!released) {
                return;
            }

            const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
                goBack();

                return true;
            });

            return () => subscription.remove();
        }, [released, goBack]),
    );

    return goBack;
}
