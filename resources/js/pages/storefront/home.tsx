import { Head } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Clock, Flame, Store } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import StorefrontTile from '@/components/storefront-tile';

const PLACEHOLDER_COMING_SOON = 8;
const PLACEHOLDER_ON_SALE = 4;
const PLACEHOLDER_FEED = 20;

const feedFilters = ['All', 'Available', 'Out of Stock'] as const;

type FeedFilter = (typeof feedFilters)[number];

/**
 * The public storefront dashboard: anyone can scroll and browse; signing in
 * is only asked for at Add to Cart. For now it shows the tile layout only,
 * with empty tiles where products will go.
 */
export default function StorefrontHome() {
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

                <ComingSoonCarousel />

                <OnSaleSection />

                <MerchandiseFeed />
            </div>
        </>
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
 * Coming Soon items in a row that slides sideways: arrows on a computer,
 * swipe on a phone.
 */
function ComingSoonCarousel() {
    const track = useRef<HTMLDivElement>(null);

    const slide = (direction: 1 | -1) => {
        track.current?.scrollBy({
            left: direction * track.current.clientWidth * 0.8,
            behavior: 'smooth',
        });
    };

    const arrowClasses =
        'flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50';

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
                actions={
                    <div className="hidden gap-2 md:flex">
                        <button
                            type="button"
                            onClick={() => slide(-1)}
                            className={arrowClasses}
                            aria-label="Previous"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            type="button"
                            onClick={() => slide(1)}
                            className={arrowClasses}
                            aria-label="Next"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                }
            />

            <div
                ref={track}
                className="-mx-4 flex snap-x snap-mandatory [scrollbar-width:none] gap-4 overflow-x-auto scroll-smooth px-4 pb-2 md:mx-0 md:px-0"
            >
                {Array.from({ length: PLACEHOLDER_COMING_SOON }, (_, index) => (
                    <StorefrontTile
                        key={index}
                        comingSoon
                        className="w-40 shrink-0 snap-start sm:w-48 lg:w-56"
                    />
                ))}
            </div>
        </section>
    );
}

/**
 * Slow-moving items the Specialist has put on sale so they sell quickly.
 */
function OnSaleSection() {
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

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {Array.from({ length: PLACEHOLDER_ON_SALE }, (_, index) => (
                    <StorefrontTile key={index} sale />
                ))}
            </div>
        </section>
    );
}

/**
 * All merchandise as a dense TikTok Shop style feed.
 */
function MerchandiseFeed() {
    const [filter, setFilter] = useState<FeedFilter>('All');

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
                    <div className="flex gap-2">
                        {feedFilters.map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => setFilter(option)}
                                className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                                    filter === option
                                        ? 'bg-[#0D6EFD] text-white'
                                        : 'bg-white text-slate-600 shadow-sm hover:bg-slate-100'
                                }`}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                }
            />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
                {Array.from({ length: PLACEHOLDER_FEED }, (_, index) => (
                    <StorefrontTile key={index} />
                ))}
            </div>
        </section>
    );
}
