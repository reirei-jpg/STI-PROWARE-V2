import { Link, router, usePage } from '@inertiajs/react';
import {
    CalendarClock,
    LayoutDashboard,
    LogOut,
    Package,
    Search,
    ShoppingCart,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import CartController from '@/actions/App/Http/Controllers/CartController';
import StudentOrderController from '@/actions/App/Http/Controllers/StudentOrderController';
import StudentPreorderController from '@/actions/App/Http/Controllers/StudentPreorderController';
import { AddToCartProvider } from '@/components/add-to-cart-dialog';
import NotificationBell from '@/components/notification-bell';
import { PreorderProvider } from '@/components/preorder-dialog';
import {
    MicrosoftLogo,
    SignInPromptProvider,
    useSignInPrompt,
} from '@/components/sign-in-prompt';
import { dashboard, home, logout } from '@/routes';
import type { StorefrontFilters } from '@/types';

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
            <PreorderProvider>
                <AddToCartProvider>
                    <div className="min-h-screen bg-[#F3F7FA]">
                        <StorefrontTopBar />

                        <main className="mx-auto max-w-7xl px-4 pt-6 pb-16 md:px-8">
                            {children}
                        </main>

                        <footer className="border-t border-slate-200 bg-white">
                            <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-6 text-sm text-slate-500 md:flex-row md:justify-between md:px-8">
                                <p className="font-bold text-slate-700">
                                    STI PROWARE
                                </p>
                                <p>Official STI merchandise</p>
                            </div>
                        </footer>
                    </div>
                </AddToCartProvider>
            </PreorderProvider>
        </SignInPromptProvider>
    );
}

function StorefrontTopBar() {
    const { auth, cart_count: cartCount } = usePage().props;
    const openSignIn = useSignInPrompt();
    const isStudent = auth.user?.role === 'student';

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

                <StorefrontSearch />

                {isStudent ? (
                    <Link
                        href={CartController.index()}
                        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
                        aria-label="Cart"
                        title="Cart"
                    >
                        <ShoppingCart size={20} />
                        {cartCount !== null && cartCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-black text-white">
                                {cartCount > 99 ? '99+' : cartCount}
                            </span>
                        )}
                    </Link>
                ) : (
                    <button
                        type="button"
                        onClick={auth.user ? undefined : openSignIn}
                        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
                        aria-label="Cart"
                    >
                        <ShoppingCart size={20} />
                    </button>
                )}

                {isStudent && <NotificationBell />}

                {auth.user?.role === 'student' ? (
                    <>
                        <Link
                            href={StudentOrderController.index()}
                            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[#0D6EFD] px-4 text-sm font-black text-white transition hover:bg-blue-700"
                        >
                            <Package size={17} />
                            <span className="hidden sm:inline">My Orders</span>
                        </Link>
                        <Link
                            href={StudentPreorderController.index()}
                            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-black text-amber-950 transition hover:bg-amber-300"
                        >
                            <CalendarClock size={17} />
                            <span className="hidden sm:inline">
                                My Preorders
                            </span>
                        </Link>
                        <Link
                            href={logout()}
                            method="post"
                            as="button"
                            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                            title={`Signed in as ${auth.user.name}`}
                        >
                            <LogOut size={17} />
                            <span className="hidden sm:inline">Log out</span>
                        </Link>
                    </>
                ) : auth.user ? (
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

/**
 * The one merchandise search, in the top bar. On the storefront it filters
 * All Merchandise as the visitor types; on other pages (Cart, My Orders)
 * pressing Enter opens the storefront with the results.
 */
function StorefrontSearch() {
    const page = usePage<{ filters?: StorefrontFilters }>();
    const onStorefront = page.component === 'storefront/home';
    const current = onStorefront ? (page.props.filters?.search ?? '') : '';
    const [term, setTerm] = useState(current);
    const firstRender = useRef(true);

    const search = (value: string, options: { scroll: boolean }) => {
        const trimmed = value.trim();
        const show = page.props.filters?.show ?? null;
        const query: Record<string, string> = {
            ...(trimmed !== '' ? { search: trimmed } : {}),
            ...(onStorefront && show ? { show } : {}),
        };

        if (!onStorefront) {
            router.get(home().url, query);

            return;
        }

        router.get(home().url, query, {
            only: ['merchandise', 'filters'],
            reset: ['merchandise'],
            preserveState: true,
            preserveScroll: true,
            replace: true,
            onSuccess: () => {
                if (options.scroll) {
                    document
                        .getElementById('all-merchandise')
                        ?.scrollIntoView({ behavior: 'smooth' });
                }
            },
        });
    };

    // The search was cleared or changed on the page (e.g. Show all).
    useEffect(() => {
        setTerm((typed) => (typed.trim() === current ? typed : current));
    }, [current]);

    // On the storefront, search as the visitor types, after a short pause.
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;

            return;
        }

        if (!onStorefront || term.trim() === current) {
            return;
        }

        const timer = window.setTimeout(
            () => search(term, { scroll: false }),
            400,
        );

        return () => window.clearTimeout(timer);
        // Only the typed text should trigger a search.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [term]);

    return (
        <form
            role="search"
            onSubmit={(event) => {
                event.preventDefault();
                search(term, { scroll: true });
            }}
            className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 text-slate-400 transition focus-within:border-blue-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100"
        >
            <Search size={18} className="shrink-0" />
            <input
                type="search"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Search merchandise"
                className="w-full min-w-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                aria-label="Search merchandise"
            />
        </form>
    );
}
