import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';

import { useAuth } from './auth';
import type { CartView } from './types';

type CartContextValue = {
    /** Null until it has loaded once. */
    cart: CartView | null;
    /** Load the cart again from the server. */
    refresh: () => Promise<void>;
    /** Show a cart the server just answered with. */
    replace: (cart: CartView) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

/**
 * The student's cart, shared by the Cart tab (and its badge) and the
 * product page, so adding an item shows up everywhere at once.
 */
export function CartProvider({ children }: { children: ReactNode }) {
    const { user, request } = useAuth();
    const [cart, setCart] = useState<CartView | null>(null);

    const refresh = useCallback(async () => {
        setCart(await request<CartView>('/cart'));
    }, [request]);

    useEffect(() => {
        // Only students have a cart.
        if (user === null || user.role !== 'student') {
            setCart(null);

            return;
        }

        refresh().catch(() => undefined);
    }, [user, refresh]);

    const value = useMemo(() => ({ cart, refresh, replace: setCart }), [cart, refresh]);

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
    const context = useContext(CartContext);

    if (!context) {
        throw new Error('useCart must be used inside <CartProvider>.');
    }

    return context;
}
