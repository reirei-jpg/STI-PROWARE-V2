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
    let response: Response;

    try {
        response = await fetch(`${getApiUrl()}${path}`, {
            method,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
    } catch {
        throw new ApiError(
            'Cannot reach the PROWARE server. Check your connection and try again.',
            0,
        );
    }

    if (response.ok) {
        return (await response.json()) as T;
    }

    const error = (await response.json().catch(() => ({}))) as ErrorBody;

    if (response.status === 429) {
        const seconds = Number(response.headers.get('Retry-After'));

        throw new ApiError(
            seconds > 0
                ? `Too many login attempts. Please try again in ${seconds} seconds.`
                : 'Too many login attempts. Please try again in a minute.',
            429,
        );
    }

    // Laravel puts the useful message under the field name (usually "email").
    const fieldMessage = error.errors
        ? Object.values(error.errors)[0]?.[0]
        : undefined;

    throw new ApiError(
        fieldMessage ?? error.message ?? 'Something went wrong. Please try again.',
        response.status,
    );
}
