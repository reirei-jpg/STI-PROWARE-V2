import { Link, usePage } from '@inertiajs/react';
import { LayoutDashboard, Search, ShoppingCart } from 'lucide-react';
import type { ReactNode } from 'react';
import {
    MicrosoftLogo,
    SignInPromptProvider,
    useSignInPrompt,
} from '@/components/sign-in-prompt';
import { dashboard, home } from '@/routes';

/**
 * The public storefront layout: anyone can browse without signing in.
 * It has its own open look (no staff sidebar) in PROWARE's colours.
 */
export default function StorefrontLayout({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <SignInPromptProvider>
            <div className="min-h-screen bg-[#F3F7FA]">
                <StorefrontTopBar />

                <main className="mx-auto max-w-7xl px-4 pt-6 pb-16 md:px-8">
                    {children}
                </main>

                <footer className="border-t border-slate-200 bg-white">
                    <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-6 text-sm text-slate-500 md:flex-row md:justify-between md:px-8">
                        <p className="font-bold text-slate-700">STI PROWARE</p>
                        <p>Official STI merchandise</p>
                    </div>
                </footer>
            </div>
        </SignInPromptProvider>
    );
}

function StorefrontTopBar() {
    const { auth } = usePage().props;
    const openSignIn = useSignInPrompt();

    return (
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
            <div className="mx-auto flex h-18 max-w-7xl items-center gap-3 px-4 md:gap-6 md:px-8">
                <Link
                    href={home()}
                    className="flex shrink-0 items-center gap-3"
                >
                    <img
                        src="/images/sti-logo.png"
                        alt="STI College"
                        className="h-11 w-11 rounded-xl object-cover shadow-sm"
                    />
                    <span className="hidden text-xl font-black tracking-tight text-[#0D6EFD] sm:block">
                        PROWARE
                    </span>
                </Link>

                <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 text-slate-400 focus-within:border-blue-300 focus-within:bg-white">
                    <Search size={18} className="shrink-0" />
                    <input
                        type="search"
                        placeholder="Search merchandise"
                        className="w-full min-w-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                        aria-label="Search merchandise"
                    />
                </label>

                <button
                    type="button"
                    onClick={auth.user ? undefined : openSignIn}
                    className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
                    aria-label="Cart"
                >
                    <ShoppingCart size={20} />
                </button>

                {auth.user ? (
                    <Link
                        href={dashboard()}
                        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[#0D6EFD] px-4 text-sm font-black text-white transition hover:bg-blue-700"
                    >
                        <LayoutDashboard size={17} />
                        <span className="hidden sm:inline">My Dashboard</span>
                    </Link>
                ) : (
                    <button
                        type="button"
                        onClick={openSignIn}
                        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-800 transition hover:bg-slate-50"
                    >
                        <MicrosoftLogo className="h-4 w-4" />
                        <span className="hidden sm:inline">Sign in</span>
                    </button>
                )}
            </div>
        </header>
    );
}
