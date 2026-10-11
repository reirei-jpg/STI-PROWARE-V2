import { Link } from '@inertiajs/react';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

/**
 * The sign-in pages (log in, forgot and reset password, two-factor), as on
 * V1: blue and yellow shapes in STI's colors around a white card with
 * the STI badge, the page's title and its description.
 */
export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    return (
        <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-white px-5 py-10">
            {/* STI blue and yellow shapes, for decoration only. */}
            <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-20 bg-[#0D6EFD] sm:h-28"
            />
            <div
                aria-hidden="true"
                className="absolute top-14 right-0 hidden h-72 w-32 rounded-l-[3rem] bg-yellow-400 md:block lg:w-44"
            />
            <div
                aria-hidden="true"
                className="absolute top-104 right-0 hidden h-40 w-32 bg-[#0D6EFD] md:block lg:w-44"
            />
            <div
                aria-hidden="true"
                className="absolute bottom-32 left-0 hidden h-44 w-28 bg-[#0D6EFD] md:block lg:w-36"
            />
            <div
                aria-hidden="true"
                className="absolute -bottom-16 left-24 hidden h-48 w-md rounded-t-[4rem] bg-yellow-400 md:block"
            />
            <div
                aria-hidden="true"
                className="absolute right-0 -bottom-20 hidden h-52 w-100 rounded-tl-[4rem] bg-[#0D6EFD] md:block"
            />

            <section className="relative z-10 w-full max-w-md rounded-3xl border border-slate-100 bg-white px-6 py-8 shadow-[0_30px_70px_rgba(0,0,0,.12)] sm:px-10">
                <div className="w-full">
                    <div className="text-center">
                        <Link
                            href={home()}
                            className="inline-flex items-center justify-center gap-3"
                        >
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400 text-xs font-black text-blue-700 shadow-md">
                                STI
                            </span>
                            <span className="text-xl font-bold text-slate-950">
                                PROWARE
                            </span>
                        </Link>

                        {title && (
                            <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-950">
                                {title}
                            </h1>
                        )}
                        {description && (
                            <p className="mt-1 text-sm text-slate-500">
                                {description}
                            </p>
                        )}
                    </div>

                    <div className="mt-6">{children}</div>
                </div>
            </section>
        </main>
    );
}
