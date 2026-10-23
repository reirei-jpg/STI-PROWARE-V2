import { Head, InfiniteScroll, router, usePage } from '@inertiajs/react';
import {
    Clock,
    Flame,
    Search,
    Shirt,
    ShoppingBag,
    Store,
    X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import StorefrontController from '@/actions/App/Http/Controllers/StorefrontController';
import StorefrontProductDialog from '@/components/storefront-product-dialog';
import StorefrontTile, { PlaceholderTile } from '@/components/storefront-tile';
import TileCarousel from '@/components/tile-carousel';
import UniformSetSection from '@/components/uniform-set-section';
import { cn } from '@/lib/utils';
import type {
    StorefrontFilters,
    StorefrontTileProduct,
    StorefrontUniformSet,
} from '@/types';

const feedChoices: { value: StorefrontFilters['show']; label: string }[] = [
    { value: null, label: 'All' },
    { value: 'in_stock', label: 'Available' },
    { value: 'sold_out', label: 'Out of Stock' },
];

/** Empty tiles shown where a section has no products yet (approved layout). */
const PLACEHOLDER_COMING_SOON = 5;
/** On Sale shows 4 tiles at a time on a computer. */
const ON_SALE_PER_SET = 4;
const PLACEHOLDER_FEED = 10;
/** Loading tiles shown while the next merchandise loads. */
const LOADING_TILES = 5;

const gridClasses =
    'grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5';

/**
 * The public storefront dashboard: anyone can scroll and browse; signing in
 * is only asked for at Add to Cart or Preorder. A banner with shortcuts to
 * each section, then Coming Soon (Preorder products), On Sale (products
 * being cleared) and All Merchandise (every product that arrived, newest
 * first and out-of-stock ones last). Tapping a tile opens the product's
 * view. The search is the one in the top bar.
 *
 * All three sections always show, as in the approved layout: a section
 * with no products yet keeps its empty tiles and says so. Coming Soon and
 * On Sale are carousels, so many items never make the page long.
 */
export default function StorefrontHome({
    comingSoon,
    onSale,
    uniformSets,
    merchandise,
    filters,
}: {
    comingSoon: StorefrontTileProduct[];
    onSale: StorefrontTileProduct[];
    uniformSets: StorefrontUniformSet[];
    merchandise: { data: StorefrontTileProduct[] };
    filters: StorefrontFilters;
}) {
    const [viewing, setViewing] = useState<StorefrontTileProduct | null>(null);

    return (
        <>
            <Head title="Official STI Merchandise" />

            <div className="space-y-8 md:space-y-10">
                <WelcomeBanner
                    comingSoon={comingSoon.length}
                    onSale={onSale.length}
                    uniformSets={uniformSets.length}
                />

                <ComingSoonCarousel products={comingSoon} onView={setViewing} />

                <OnSaleSection products={onSale} onView={setViewing} />

                <UniformSetSection sets={uniformSets} />

                <MerchandiseFeed
                    merchandise={merchandise}
                    filters={filters}
                    onView={setViewing}
                />
            </div>

            <StorefrontProductDialog
                product={viewing}
                onClose={() => setViewing(null)}
            />
        </>
    );
}

/**
 * The banner at the top: who the store is for, how ordering works, and
 * shortcuts that jump to Coming Soon, On Sale and All Merchandise. A
 * signed-in student is greeted by name.
 */
function WelcomeBanner({
    comingSoon,
    onSale,
    uniformSets,
}: {
    comingSoon: number;
    onSale: number;
    uniformSets: number;
}) {
    const { auth } = usePage().props;
    const firstName =
        auth.user?.role === 'student' ? auth.user.name.split(' ')[0] : null;

    const shortcuts = [
        {
            href: '#coming-soon',
            label: 'Coming Soon',
            count: comingSoon,
            icon: <Clock size={15} />,
        },
        {
            href: '#on-sale',
            label: 'On Sale',
            count: onSale,
            icon: <Flame size={15} />,
        },
        ...(uniformSets > 0
            ? [
                  {
                      href: '#uniform-sets',
                      label: 'Uniform Sets',
                      count: uniformSets,
                      icon: <Shirt size={15} />,
                  },
              ]
            : []),
        {
            href: '#all-merchandise',
            label: 'All Merchandise',
            count: null,
            icon: <Store size={15} />,
        },
    ];

    return (
        <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-[#0D6EFD] via-blue-600 to-blue-800 px-6 py-8 text-white shadow-xl shadow-blue-500/20 md:px-10 md:py-10">
            {/* Soft shapes in STI blue and yellow, for decoration only. */}
            <span
                aria-hidden="true"
                className="absolute -top-16 -right-10 h-56 w-56 rounded-full bg-yellow-300/25 blur-2xl"
            />
            <span
                aria-hidden="true"
                className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-white/10 blur-2xl"
            />
            <ShoppingBag
                aria-hidden="true"
                size={180}
                className="absolute -right-6 -bottom-8 hidden text-white/10 md:block"
            />

            <div className="relative max-w-2xl">
                <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-black tracking-wide text-yellow-200 uppercase">
                    STI PROWARE · Official store
                </p>
                <h1 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">
                    {firstName
                        ? `Hi ${firstName}, welcome back!`
                        : 'Official STI merchandise'}
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-blue-50 md:text-base">
                    {firstName
                        ? 'Order here, pay at the cashier, then pick up at the PROWARE office with your receipt and issuance slip.'
                        : 'Browse freely. You only need to sign in with your STI Microsoft 365 account when you add something to your cart.'}
                </p>

                <nav
                    aria-label="Sections"
                    className="mt-5 flex flex-wrap gap-2"
                >
                    {shortcuts.map((shortcut) => (
                        <a
                            key={shortcut.href}
                            href={shortcut.href}
                            className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-black text-blue-700 shadow-sm transition hover:bg-yellow-100"
                        >
                            {shortcut.icon}
                            {shortcut.label}
                            {shortcut.count !== null && (
                                <span className="rounded-full bg-blue-100 px-2 text-xs">
                                    {shortcut.count}
                                </span>
                            )}
                        </a>
                    ))}
                </nav>
            </div>
        </section>
    );
}

/**
 * A short line under a section that has no products yet.
 */
function EmptyNote({ children }: { children: ReactNode }) {
    return (
        <p className="mt-3 text-center text-sm font-semibold text-slate-500">
            {children}
        </p>
    );
}

function SectionHeading({
    icon,
    title,
    description,
    count,
    actions,
}: {
    icon: ReactNode;
    title: string;
    description: string;
    count?: number;
    actions?: ReactNode;
}) {
    return (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-start gap-3">
                {icon}
                <div>
                    <h2 className="flex items-center gap-2 text-xl font-black text-slate-900 md:text-2xl">
                        {title}
                        {count !== undefined && count > 0 && (
                            <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-black text-slate-600 shadow-sm">
                                {count} {count === 1 ? 'item' : 'items'}
                            </span>
                        )}
                    </h2>
                    <p className="text-sm text-slate-500">{description}</p>
                </div>
            </div>
            {actions}
        </div>
    );
}

/**
 * Preorder products in a carousel: 3 at a time on a phone, 5 on a
 * computer, moving to the next set every 7 seconds.
 */
function ComingSoonCarousel({
    products,
    onView,
}: {
    products: StorefrontTileProduct[];
    onView: (product: StorefrontTileProduct) => void;
}) {
    return (
        <section
            id="coming-soon"
            aria-label="Coming Soon"
            className="scroll-mt-24 rounded-3xl border border-amber-100 bg-linear-to-br from-amber-50 via-yellow-50 to-white p-5 md:p-6"
        >
            <SectionHeading
                icon={
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-amber-950">
                        <Clock size={20} />
                    </span>
                }
                title="Coming Soon"
                description="Ordered from STI Head Office and on the way. Preorder to reserve yours."
                count={products.length}
            />

            <TileCarousel
                label="Coming Soon"
                tiles={
                    products.length === 0
                        ? Array.from(
                              { length: PLACEHOLDER_COMING_SOON },
                              (_, index) => (
                                  <PlaceholderTile
                                      key={`placeholder-${index}`}
                                      comingSoon
                                      className="w-full"
                                  />
                              ),
                          )
                        : products.map((product) => (
                              <StorefrontTile
                                  key={product.id}
                                  product={product}
                                  onView={onView}
                                  className="w-full"
                              />
                          ))
                }
            />
            {products.length === 0 && (
                <EmptyNote>
                    No preorders yet. New items appear here as soon as they are
                    set for preorder.
                </EmptyNote>
            )}
        </section>
    );
}

/**
 * Slow-moving items the Specialist has put on sale so they sell quickly.
 */
function OnSaleSection({
    products,
    onView,
}: {
    products: StorefrontTileProduct[];
    onView: (product: StorefrontTileProduct) => void;
}) {
    return (
        <section
            id="on-sale"
            aria-label="On Sale"
            className="scroll-mt-24 rounded-3xl border border-red-100 bg-linear-to-br from-red-50 via-orange-50 to-white p-5 md:p-6"
        >
            <SectionHeading
                icon={
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500 text-white">
                        <Flame size={20} />
                    </span>
                }
                title="On Sale"
                description="Limited stock at a lower price. Get them while they last."
                count={products.length}
            />

            {/* A carousel, like Coming Soon, so many sale items never make
                the page long. 4 at a time on a computer, 3 on a phone. */}
            <TileCarousel
                label="On Sale"
                perSet={{ phone: 3, computer: ON_SALE_PER_SET }}
                tiles={
                    products.length === 0
                        ? Array.from(
                              { length: ON_SALE_PER_SET },
                              (_, index) => (
                                  <PlaceholderTile
                                      key={`placeholder-${index}`}
                                      sale
                                      className="w-full"
                                  />
                              ),
                          )
                        : products.map((product) => (
                              <StorefrontTile
                                  key={product.id}
                                  product={product}
                                  onView={onView}
                                  className="w-full"
                              />
                          ))
                }
            />
            {products.length === 0 && (
                <EmptyNote>
                    Nothing on sale right now. Check back for lower prices.
                </EmptyNote>
            )}
        </section>
    );
}

/**
 * All merchandise as a dense TikTok Shop style feed that loads more as the
 * visitor scrolls. All / Available / Out of Stock stay at the top while
 * scrolling; the search is the one in the top bar.
 */
function MerchandiseFeed({
    merchandise,
    filters,
    onView,
}: {
    merchandise: { data: StorefrontTileProduct[] };
    filters: StorefrontFilters;
    onView: (product: StorefrontTileProduct) => void;
}) {
    const isFiltered = filters.search !== null || filters.show !== null;
    const grid = useRef<HTMLDivElement>(null);

    const showFeed = (next: StorefrontFilters) => {
        const query: Record<string, string> = {};

        if (next.search) {
            query.search = next.search;
        }

        if (next.show) {
            query.show = next.show;
        }

        router.get(StorefrontController.home().url, query, {
            only: ['merchandise', 'filters'],
            reset: ['merchandise'],
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    return (
        <section
            id="all-merchandise"
            aria-label="All Merchandise"
            className="scroll-mt-24"
        >
            <SectionHeading
                icon={
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0D6EFD] text-white">
                        <Store size={20} />
                    </span>
                }
                title="All Merchandise"
                description="Everything available at the PROWARE store."
            />

            <div className="sticky top-18 z-10 -mx-4 mb-4 flex flex-wrap items-center gap-2 bg-[#F3F7FA]/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
                {feedChoices.map((choice) => (
                    <button
                        key={choice.label}
                        type="button"
                        onClick={() =>
                            showFeed({ ...filters, show: choice.value })
                        }
                        aria-pressed={filters.show === choice.value}
                        className={cn(
                            'h-10 rounded-full px-5 text-sm font-black transition',
                            filters.show === choice.value
                                ? 'bg-[#0D6EFD] text-white shadow-md shadow-blue-500/25'
                                : 'bg-white text-slate-600 shadow-sm hover:bg-blue-50 hover:text-blue-700',
                        )}
                    >
                        {choice.label}
                    </button>
                ))}

                {filters.search && (
                    <button
                        type="button"
                        onClick={() => showFeed({ ...filters, search: null })}
                        className="inline-flex h-10 items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700 transition hover:bg-blue-100"
                    >
                        <Search size={15} />
                        &ldquo;{filters.search}&rdquo;
                        <X size={15} />
                        <span className="sr-only">Clear the search</span>
                    </button>
                )}
            </div>

            {merchandise.data.length === 0 && !isFiltered ? (
                <>
                    <div className={gridClasses}>
                        {Array.from(
                            { length: PLACEHOLDER_FEED },
                            (_, index) => (
                                <PlaceholderTile key={index} />
                            ),
                        )}
                    </div>
                    <EmptyNote>
                        No merchandise yet. New items appear here as soon as
                        they arrive at the PROWARE store.
                    </EmptyNote>
                </>
            ) : merchandise.data.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                    <Store size={40} className="mx-auto text-slate-300" />
                    <h3 className="mt-3 text-lg font-black text-slate-800">
                        No merchandise matches your search
                    </h3>
                    <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                        Try another name, or show all merchandise.
                    </p>
                    <button
                        type="button"
                        onClick={() => showFeed({ search: null, show: null })}
                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-2.5 text-sm font-black text-white hover:bg-blue-700"
                    >
                        <X size={16} />
                        Show all merchandise
                    </button>
                </div>
            ) : (
                <InfiniteScroll
                    data="merchandise"
                    itemsElement={grid}
                    onlyNext
                    preserveUrl
                    loading={() => (
                        <div className={cn(gridClasses, 'mt-3 md:mt-4')}>
                            {Array.from(
                                { length: LOADING_TILES },
                                (_, index) => (
                                    <PlaceholderTile key={index} pulse />
                                ),
                            )}
                        </div>
                    )}
                >
                    <div ref={grid} className={gridClasses}>
                        {merchandise.data.map((product) => (
                            <StorefrontTile
                                key={product.id}
                                product={product}
                                onView={onView}
                            />
                        ))}
                    </div>
                </InfiniteScroll>
            )}
        </section>
    );
}
