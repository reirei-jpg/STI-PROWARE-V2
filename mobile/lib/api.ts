import { getApiUrl } from './config';

/**
 * A failed request, in words a student can read.
 * status 0 means the server could not be reached at all.
 */
export class ApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
    }
}

/**
 * What to say when something could not be loaded: the connection problem
 * itself (offline, too slow) or not allowed, else the screen's own words.
 */
export function loadErrorMessage(caught: unknown, fallback: string): string {
    return caught instanceof ApiError && (caught.status === 0 || caught.status === 403)
        ? caught.message
        : fallback;
}

/** A request with no answer after this long is stopped, not left spinning. */
const TIMEOUT_MS = 30_000;

/** Said when the server could not be reached at all. */
export const OFFLINE_MESSAGE =
    'PROWARE could not be reached. Check your internet connection and try again.';

/** Said when the server took too long to answer. */
export const TOO_SLOW_MESSAGE =
    'PROWARE took too long to respond. Check your internet connection and try again.';

type RequestOptions = {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: Record<string, unknown>;
    token?: string | null;
};

type ErrorBody = {
    message?: string;
    errors?: Record<string, string[]>;
};

export async function apiRequest<T>(
    path: string,
    { method = 'GET', body, token }: RequestOptions = {},
): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, TIMEOUT_MS);

    try {
        return await send<T>(path, { method, body, token }, controller.signal);
    } catch (caught) {
        if (caught instanceof ApiError) {
            throw caught;
        }

        throw new ApiError(timedOut ? TOO_SLOW_MESSAGE : OFFLINE_MESSAGE, 0);
    } finally {
        clearTimeout(timer);
    }
}

async function send<T>(
    path: string,
    { method = 'GET', body, token }: RequestOptions,
    signal: AbortSignal,
): Promise<T> {
    const response = await fetch(`${getApiUrl()}${path}`, {
        method,
        signal,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    if (response.ok) {
        return (await response.json()) as T;
    }

    const error = (await response.json().catch(() => ({}))) as ErrorBody;

    if (response.status === 429) {
        const seconds = Number(response.headers.get('Retry-After'));

        throw new ApiError(
            seconds > 0
                ? `Too many login attempts. Try again in ${seconds} seconds.`
                : 'Too many login attempts. Try again in a minute.',
            429,
        );
    }

    // Laravel puts the useful message under the field name (usually "email").
    const fieldMessage = error.errors
        ? Object.values(error.errors)[0]?.[0]
        : undefined;

    // A refusal without words (e.g. a 403) still says what happened.
    const fallback =
        response.status === 403
            ? 'Your account cannot open this.'
            : 'Something went wrong. Try again.';

    throw new ApiError(fieldMessage || error.message || fallback, response.status);
}
