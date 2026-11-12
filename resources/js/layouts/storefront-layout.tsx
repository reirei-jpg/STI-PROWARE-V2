import { Link, router, usePage } from '@inertiajs/react';
import {
    CalendarClock,
    ChevronDown,
    LayoutDashboard,
    LogOut,
    Package,
    Search,
    ShoppingCart,
    UserRound,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import CartController from '@/actions/App/Http/Controllers/CartController';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import StudentOrderController from '@/actions/App/Http/Controllers/StudentOrderController';
import StudentPreorderController from '@/actions/App/Http/Controllers/StudentPreorderController';
import { AddToCartProvider } from '@/components/add-to-cart-dialog';
import NotificationBell from '@/components/notification-bell';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useInitials } from '@/hooks/use-initials';
import { PreorderProvider } from '@/components/preorder-dialog';
import {
    MicrosoftLogo,
    SignInPromptProvider,
    useSignInPrompt,
} from '@/components/sign-in-prompt';
import { dashboard, home, logout } from '@/routes';
import type { StorefrontFilters } from '@/types';
import { isBuyer } from '@/lib/roles';

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

/**
 * The store's top bar, like an online shop's: the logo, a wide search, then
 * only icons: the cart with its count, the bell, and the buyer's name with
 * a menu (My Orders, My Preorders, My Account, Log out).
 */
function StorefrontTopBar() {
    const { auth, cart_count: cartCount } = usePage().props;
    const openSignIn = useSignInPrompt();
    const isStudent = isBuyer(auth.user);
    const iconButton =
        'relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700';

    return (
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
            <div className="mx-auto flex h-18 max-w-7xl items-center gap-2 px-4 sm:gap-3 md:gap-5 md:px-8">
                <Link
                    href={home()}
                    className="flex shrink-0 items-center gap-3"
                >
                    <img
                        src="/images/sti-logo.png"
                        alt="STI College"
                        className="h-11 w-11 rounded-xl object-cover shadow-sm"
                    />
                    <span className="hidden text-xl font-black tracking-tight text-[#0D6EFD] md:block">
                        PROWARE
                    </span>
                </Link>

                <StorefrontSearch />

                {isStudent ? (
                    <Link
                        href={CartController.index()}
                        className={iconButton}
                        aria-label="Cart"
                        title="Cart"
                    >
                        <ShoppingCart size={19} />
                        {cartCount !== null && cartCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-black text-white ring-2 ring-white">
                                {cartCount > 99 ? '99+' : cartCount}
                            </span>
                        )}
                    </Link>
                ) : (
                    // The Specialist and the School Admin do not buy, so they get no Cart (My Dashboard instead).
                    auth.user === null && (
                        <button
                            type="button"
                            onClick={openSignIn}
                            className={iconButton}
                            aria-label="Cart"
                            title="Cart"
                        >
                            <ShoppingCart size={19} />
                        </button>
                    )
                )}

                {isStudent && <NotificationBell />}

                {isStudent ? (
                    <BuyerMenu />
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
 * The buyer's name in the top bar, opening a menu with their orders,
 * preorders, account and Log out.
 */
function BuyerMenu() {
    const { auth } = usePage().props;
    const getInitials = useInitials();
    const item =
        'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 focus:bg-blue-50 focus:text-blue-700';

    if (auth.user === null) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pr-2 pl-1 transition outline-none hover:border-blue-200 hover:bg-blue-50/50 focus-visible:ring-2 focus-visible:ring-blue-300"
                    aria-label="Your account"
                >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0D6EFD] text-xs font-black text-white">
                        {getInitials(auth.user.name)}
                    </span>
                    <span className="hidden max-w-28 truncate text-sm font-bold text-slate-800 lg:block">
                        {auth.user.name.split(' ')[0]}
                    </span>
                    <ChevronDown size={15} className="text-slate-400" />
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align="end"
                className="w-64 overflow-hidden rounded-2xl border-slate-200 p-0 shadow-xl shadow-slate-900/10"
            >
                <div className="border-b border-slate-100 px-4 py-3">
                    <p className="truncate text-sm font-black text-slate-900">
                        {auth.user.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                        {auth.user.email}
                    </p>
                </div>
                <div className="p-2">
                    <DropdownMenuItem asChild>
                        <Link
                            href={StudentOrderController.index()}
                            className={item}
                        >
                            <Package size={17} />
                            My Orders
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link
                            href={StudentPreorderController.index()}
                            className={item}
                        >
                            <CalendarClock size={17} />
                            My Preorders
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href={ProfileController.edit()} className={item}>
                            <UserRound size={17} />
                            My Account
                        </Link>
                    </DropdownMenuItem>
                </div>
                <div className="border-t border-slate-100 p-2">
                    <DropdownMenuItem asChild>
                        <Link
                            href={logout()}
                            method="post"
                            as="button"
                            onClick={() => router.flushAll()}
                            className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 focus:bg-red-50 focus:text-red-600"
                        >
                            <LogOut size={17} />
                            Log out
                        </Link>
                    </DropdownMenuItem>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
/**
 * The one merchandise search, in the top bar. On the storefront it filters
 * every section as the visitor types; on other pages (Cart, My Orders)
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
        const find = page.props.filters?.find ?? null;
        const query: Record<string, string> = {
            ...(trimmed !== '' ? { search: trimmed } : {}),
            ...(onStorefront && find ? { find } : {}),
            ...(onStorefront && show ? { show } : {}),
        };

        if (!onStorefront) {
            router.get(home().url, query);

            return;
        }

        router.get(home().url, query, {
            only: [
                'comingSoon',
                'onSale',
                'uniformSets',
                'merchandise',
                'filters',
            ],
            reset: ['merchandise'],
            preserveState: true,
            preserveScroll: true,
            replace: true,
            onSuccess: () => {
                // The results start at the top of the page.
                if (trimmed !== '') {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else if (options.scroll) {
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
                maxLength={120}
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Search merchandise"
                className="w-full min-w-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                aria-label="Search merchandise"
            />
        </form>
    );
}
