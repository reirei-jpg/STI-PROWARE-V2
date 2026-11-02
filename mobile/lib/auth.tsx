import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';

import { ApiError, apiRequest } from './api';
import { loadSavedServerAddress } from './config';
import {
    clearToken,
    deviceName,
    readToken,
    saveToken,
} from './session-storage';

/** The signed-in student or PROWARE Specialist. */
export type SessionUser = {
    id: number;
    name: string;
    email: string;
    /** Decides whether the app shows the shop or the Specialist's screens. */
    role: 'student' | 'employee' | 'specialist';
};

type LoginResponse = { token: string; user: SessionUser };

type MeResponse = { user: SessionUser };

type RequestFunction = <T>(
    path: string,
    options?: {
        method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
        body?: Record<string, unknown>;
    },
) => Promise<T>;

/** Said on the sign-in screen after the server stopped accepting the login. */
const EXPIRED_NOTICE =
    'Your session has expired, so you were signed out. Sign back in; your cart and orders are saved.';

type AuthContextValue = {
    user: SessionUser | null;
    /** Why the sign-in screen opened by itself (an expired sign-in), if it did. */
    signInNotice: string | null;
    /** Calls the server as the signed-in student; a refused token signs out. */
    request: RequestFunction;
    /** True until the saved login (if any) has been checked. */
    restoring: boolean;
    signIn: (
        email: string,
        password: string,
        remember: boolean,
    ) => Promise<void>;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * The student's login on this phone. The token is kept in the phone's
 * protected storage when "Remember me" is ticked; otherwise only in memory.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<SessionUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [restoring, setRestoring] = useState(true);
    const [signInNotice, setSignInNotice] = useState<string | null>(null);

    // On start, sign back in with the saved token if the server still
    // accepts it.
    useEffect(() => {
        let cancelled = false;

        (async () => {
            // The server address chosen on this phone comes before any request.
            await loadSavedServerAddress();

            const saved = await readToken();

            if (saved) {
                try {
                    const me = await apiRequest<MeResponse>('/auth/me', {
                        token: saved,
                    });

                    if (!cancelled) {
                        setToken(saved);
                        setUser(me.user);
                    }
                } catch (caught) {
                    // A refused token is dead. A network problem keeps it,
                    // so the student is not signed out just for being offline.
                    if (caught instanceof ApiError && caught.status === 401) {
                        await clearToken();

                        if (!cancelled) {
                            setSignInNotice(EXPIRED_NOTICE);
                        }
                    }
                }
            }

            if (!cancelled) {
                setRestoring(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    const signIn = useCallback(
        async (email: string, password: string, remember: boolean) => {
            const response = await apiRequest<LoginResponse>('/auth/login', {
                method: 'POST',
                body: {
                    email,
                    password,
                    device_name: await deviceName(),
                },
            });

            if (remember) {
                await saveToken(response.token);
            } else {
                await clearToken();
            }

            setToken(response.token);
            setUser(response.user);
            setSignInNotice(null);
        },
        [],
    );

    const signOut = useCallback(async () => {
        const current = token;

        setUser(null);
        setToken(null);
        await clearToken();

        // Tell the server too, but never block signing out on it.
        if (current) {
            apiRequest('/auth/logout', {
                method: 'POST',
                token: current,
            }).catch(() => undefined);
        }
    }, [token]);

    const request = useCallback<RequestFunction>(
        async (path, options = {}) => {
            try {
                return await apiRequest(path, { ...options, token });
            } catch (caught) {
                // The server no longer accepts this login: say why on the
                // sign-in screen instead of signing out without a word.
                if (caught instanceof ApiError && caught.status === 401 && token) {
                    setSignInNotice(EXPIRED_NOTICE);
                    void signOut();
                }

                throw caught;
            }
        },
        [token, signOut],
    );

    const value = useMemo(
        () => ({ user, signInNotice, request, restoring, signIn, signOut }),
        [user, signInNotice, request, restoring, signIn, signOut],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth must be used inside <AuthProvider>.');
    }

    return context;
}
