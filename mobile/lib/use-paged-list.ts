import { useCallback, useRef, useState } from 'react';

import { ApiError } from './api';
import { useAuth } from './auth';
import type { Page } from './types';

/**
 * A long list from the server, 20 at a time: the first page, more as the
 * student scrolls, and a reload (pull down, or coming back to the screen).
 */
export function usePagedList<T extends { id: number | string }, Extra = Record<string, never>>(
    path: string,
) {
    const { request } = useAuth();
    const [items, setItems] = useState<T[] | null>(null);
    /** Anything else the server sent with the latest page (e.g. counts). */
    const [extra, setExtra] = useState<Extra | null>(null);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const latestRequest = useRef(0);

    const load = useCallback(
        async (pageToLoad: number) => {
            const requestNumber = ++latestRequest.current;
            const result = await request<Page<T> & Extra>(
                `${path}${path.includes('?') ? '&' : '?'}page=${pageToLoad}`,
            );

            // A reload started after this one wins.
            if (requestNumber !== latestRequest.current) {
                return;
            }

            setItems((current) =>
                pageToLoad === 1 ? result.data : [...(current ?? []), ...result.data],
            );
            setPage(result.current_page);
            setLastPage(result.last_page);
            setExtra(result);
        },
        [path, request],
    );

    const reload = useCallback(async () => {
        try {
            await load(1);
            setError(null);
        } catch (caught) {
            setError(
                caught instanceof ApiError
                    ? caught.message
                    : 'The list could not be loaded. Pull down to try again.',
            );
        }
    }, [load]);

    const loadMore = useCallback(async () => {
        if (loadingMore || page >= lastPage) {
            return;
        }

        setLoadingMore(true);

        try {
            await load(page + 1);
        } catch {
            // Scrolling again will retry.
        } finally {
            setLoadingMore(false);
        }
    }, [load, loadingMore, page, lastPage]);

    /** Show a row the server just answered with (after Cancel). */
    const replaceItem = useCallback((item: T) => {
        setItems((current) =>
            current?.map((existing) => (existing.id === item.id ? item : existing)) ?? null,
        );
    }, []);

    return { items, extra, error, loadingMore, reload, loadMore, replaceItem };
}
