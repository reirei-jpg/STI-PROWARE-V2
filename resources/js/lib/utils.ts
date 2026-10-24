import type { InertiaLinkProps } from '@inertiajs/react';
import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function toUrl(url: NonNullable<InertiaLinkProps['href']>): string {
    return typeof url === 'string' ? url : url.url;
}

/**
 * Whether the typed search is the one the list already shows ("#30801" and
 * "30801" count as the same). Search-as-you-type only reloads the list when
 * they differ, so opening a page (e.g. Next) never resets it to page 1.
 */
export function isSameSearch(typed: string, current: string | null): boolean {
    const normalize = (value: string) => value.trim().replace(/^#/, '').trim();

    return normalize(typed) === normalize(current ?? '');
}
