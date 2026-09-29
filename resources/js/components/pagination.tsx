import { Link } from '@inertiajs/react';
import type { Paginated } from '@/types';

const buttonClasses =
    'rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50';

/**
 * V1's page controls: "Showing 1 to 20 of 45 …", Previous / Page x of y / Next.
 * Hidden when everything fits on one page.
 */
export default function Pagination<T>({
    pagination,
    itemName,
}: {
    pagination: Paginated<T>;
    itemName: string;
}) {
    if (pagination.last_page <= 1) {
        return null;
    }

    return (
        <div className="flex flex-col gap-4 border-t border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
                Showing <strong>{pagination.from ?? 0}</strong> to{' '}
                <strong>{pagination.to ?? 0}</strong> of{' '}
                <strong>{pagination.total}</strong> {itemName}
            </p>

            <div className="flex items-center gap-2">
                {pagination.prev_page_url ? (
                    <Link
                        href={pagination.prev_page_url}
                        preserveScroll
                        className={buttonClasses}
                    >
                        Previous
                    </Link>
                ) : (
                    <span
                        className={`${buttonClasses} cursor-not-allowed opacity-40`}
                    >
                        Previous
                    </span>
                )}

                <span className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">
                    Page {pagination.current_page} of {pagination.last_page}
                </span>

                {pagination.next_page_url ? (
                    <Link
                        href={pagination.next_page_url}
                        preserveScroll
                        className={buttonClasses}
                    >
                        Next
                    </Link>
                ) : (
                    <span
                        className={`${buttonClasses} cursor-not-allowed opacity-40`}
                    >
                        Next
                    </span>
                )}
            </div>
        </div>
    );
}
