import { Head, InfiniteScroll, router } from '@inertiajs/react';
import { Clock, Flame, LoaderCircle, Search, Store, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import StorefrontController from '@/actions/App/Http/Controllers/StorefrontController';
import StorefrontProductDialog from '@/components/storefront-product-dialog';
import StorefrontTile, { PlaceholderTile } from '@/components/storefront-tile';
import TileCarousel from '@/components/tile-carousel';
import type { StorefrontFilters, StorefrontTileProduct } from '@/types';

const feedChoices: { value: StorefrontFilters['show']; label: string }[] = [
    { value: null, label: 'All' },
    { value: 'in_stock', label: 'Available' },
    { value: 'sold_out', label: 'Out of Stock' },
];

/** Empty tiles shown where a section has no products yet (approved layout). */
const PLACEHOLDER_COMING_SOON = 10;
/** On Sale shows 4 tiles at a time on a computer, filled with empty tiles when fewer. */
const ON_SALE_PER_SET = 4;
const PLACEHOLDER_FEED = 20;

/**
 * The public storefront dashboard: anyone can scroll and browse; signing in
 * is only asked for at Add to Cart or Preorder. Coming Soon shows Preorder
 * products, On Sale the products being cleared, and All Merchandise every
 * product that arrived, newest first and out-of-stock ones last. Tapping a
 * tile opens the product's view.
 *
 * All three sections always show, as in the approved layout: a section
 * with no products yet keeps its empty tiles and says so. Coming Soon and
 * On Sale are carousels, so many items never make the page long, and fill
 * their first set with empty tiles when they have only a few products.
 */
export default function StorefrontHome({
    comingSoon,
    onSale,
    merchandise,
    filters,
}: {
    comingSoon: StorefrontTileProduct[];
    onSale: StorefrontTileProduct[];
    merchandise: { data: StorefrontTileProduct[] };
    filters: StorefrontFilters;
}) {
    const [viewing, setViewing] = useState<StorefrontTileProduct | null>(null);

    return (
        <>
            <Head title="Official STI Merchandise" />

            <div className="space-y-10">
                <section className="rounded-3xl bg-linear-to-r from-[#0D6EFD] to-blue-500 px-6 py-8 text-white shadow-lg shadow-blue-500/20 md:px-10">
                    <p className="text-sm font-bold tracking-wide text-blue-100 uppercase">
                        STI PROWARE
                    </p>
                    <h1 className="mt-1 text-2xl font-black md:text-3xl">
                        Official STI merchandise
                    </h1>
                    <p className="mt-2 max-w-xl text-sm text-blue-50 md:text-base">
                        Browse freely. You only need to sign in with your STI
                        Microsoft 365 account when you add something to your
                        cart.
                    </p>
                </section>

                <ComingSoonCarousel products={comingSoon} onView={setViewing} />

                <OnSaleSection products={onSale} onView={setViewing} />

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
    actions,
}: {
    icon: ReactNode;
    title: string;
    description: string;
    actions?: ReactNode;
}) {
    return (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-start gap-3">
                {icon}
                <div>
                    <h2 className="text-xl font-black text-slate-900">
                        {title}
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
        <section aria-label="Coming Soon">
            <SectionHeading
                icon={
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                        <Clock size={20} />
                    </span>
                }
                title="Coming Soon"
                description="Ordered from STI Head Office and on the way."
            />

            <TileCarousel
                label="Coming Soon"
                tiles={[
                    ...products.map((product) => (
                        <StorefrontTile
                            key={product.id}
                            product={product}
                            onView={onView}
                            className="w-full"
                        />
                    )),
                    ...Array.from(
                        {
                            length:
                                products.length === 0
                                    ? PLACEHOLDER_COMING_SOON
                                    : Math.max(0, 5 - products.length),
                        },
                        (_, index) => (
                            <PlaceholderTile
                                key={`placeholder-${index}`}
                                comingSoon
                                className="w-full"
                            />
                        ),
                    ),
                ]}
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
            aria-label="On Sale"
            className="rounded-3xl border border-red-100 bg-linear-to-br from-red-50 via-orange-50 to-white p-5 md:p-6"
        >
            <SectionHeading
                icon={
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500 text-white">
                        <Flame size={20} />
                    </span>
                }
                title="On Sale"
                description="Limited stock at a lower price. Get them while they last."
            />

            {/* A carousel, like Coming Soon, so many sale items never make
                the page long. 4 at a time on a computer, 3 on a phone, like
                Coming Soon on a phone. */}
            <TileCarousel
                label="On Sale"
                perSet={{ phone: 3, computer: ON_SALE_PER_SET }}
                tiles={[
                    ...products.map((product) => (
                        <StorefrontTile
                            key={product.id}
                            product={product}
                            onView={onView}
                            className="w-full"
                        />
                    )),
                    ...Array.from(
                        {
                            length:
                                products.length === 0
                                    ? ON_SALE_PER_SET
                                    : Math.max(
                                          0,
                                          ON_SALE_PER_SET - products.length,
                                      ),
                        },
                        (_, index) => (
                            <PlaceholderTile
                                key={`placeholder-${index}`}
                                sale
                                className="w-full"
                            />
                        ),
                    ),
                ]}
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
 * visitor scrolls, with a name search and All / In stock / Sold out.
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
    const [search, setSearch] = useState(filters.search ?? '');
    const firstRender = useRef(true);
    const grid = useRef<HTMLDivElement>(null);
    const isFiltered = filters.search !== null || filters.show !== null;

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

    // Search as the visitor types, after a short pause.
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;

            return;
        }

        const timer = window.setTimeout(
            () =>
                showFeed({
                    ...filters,
                    search: search.trim() === '' ? null : search.trim(),
                }),
            400,
        );

        return () => window.clearTimeout(timer);
        // Only the typed text should trigger a search.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    return (
        <section aria-label="All Merchandise">
            <SectionHeading
                icon={
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                        <Store size={20} />
                    </span>
                }
                title="All Merchandise"
                description="Everything available at the PROWARE store."
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="flex h-9 w-56 items-center gap-2 rounded-full bg-white px-3 text-slate-400 shadow-sm focus-within:ring-2 focus-within:ring-blue-100">
                            <Search size={15} className="shrink-0" />
                            <input
                                type="search"
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Search merchandise"
                                className="w-full min-w-0 bg-transparent text-xs font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                                aria-label="Search merchandise"
                            />
                        </label>
                        {feedChoices.map((choice) => (
                            <button
                                key={choice.label}
                                type="button"
                                onClick={() =>
                                    showFeed({ ...filters, show: choice.value })
                                }
                                className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                                    filters.show === choice.value
                                        ? 'bg-[#0D6EFD] text-white'
                                        : 'bg-white text-slate-600 shadow-sm hover:bg-slate-100'
                                }`}
                            >
                                {choice.label}
                            </button>
                        ))}
                    </div>
                }
            />

            {merchandise.data.length === 0 && !isFiltered ? (
                <>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
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
                        onClick={() => {
                            setSearch('');
                            showFeed({ search: null, show: null });
                        }}
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
                        <p className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
                            <LoaderCircle size={16} className="animate-spin" />
                            Loading more merchandise...
                        </p>
                    )}
                >
                    <div
                        ref={grid}
                        className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5"
                    >
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
