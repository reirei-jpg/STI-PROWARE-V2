import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';

/**
 * How tall the keyboard is while it is open on Android (0 when closed).
 *
 * The app draws edge to edge, so Android no longer shrinks the screen for
 * the keyboard by itself, and KeyboardAvoidingView does not either. A
 * screen (or a bottom sheet) leaves this much room at its bottom instead,
 * so the box being typed in stays above the keyboard. iOS keeps
 * KeyboardAvoidingView, so this is 0 there.
 */
export function useKeyboardHeight(): number {
    const [height, setHeight] = useState(0);

    useEffect(() => {
        if (Platform.OS !== 'android') {
            return;
        }

        // From the keyboard's top edge to the bottom of the screen: its
        // reported height leaves out the navigation bar it also covers.
        const shown = Keyboard.addListener('keyboardDidShow', (event) =>
            setHeight(Math.max(0, Dimensions.get('screen').height - event.endCoordinates.screenY)),
        );
        const hidden = Keyboard.addListener('keyboardDidHide', () => setHeight(0));

        return () => {
            shown.remove();
            hidden.remove();
        };
    }, []);

    return height;
}
