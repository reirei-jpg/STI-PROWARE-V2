import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const ROTATE_EVERY_MS = 7000;

function useMediaQuery(query: string): boolean {
    return useSyncExternalStore(
        (onChange) => {
            const media = window.matchMedia(query);
            media.addEventListener('change', onChange);

            return () => media.removeEventListener('change', onChange);
        },
        () => window.matchMedia(query).matches,
        () => false,
    );
}

/**
 * A carousel of tiles: 3 at a time on a phone, 5 on a computer. It moves
 * to the next set every 7 seconds and loops back to the start. It pauses
 * while the pointer or keyboard focus is on it, and does not move by
 * itself for people who turned off animations. Arrows (computer), swipe
 * (phone) and the dots move it by hand.
 */
export default function TileCarousel({
    label,
    tiles,
}: {
    label: string;
    tiles: ReactNode[];
}) {
    const isWide = useMediaQuery('(min-width: 768px)');
    const prefersReducedMotion = useMediaQuery(
        '(prefers-reduced-motion: reduce)',
    );

    const tilesPerSet = isWide ? 5 : 3;
    const gapRem = isWide ? 1 : 0.5;
    const setCount = Math.max(1, Math.ceil(tiles.length / tilesPerSet));

    const [set, setSet] = useState(0);
    const [paused, setPaused] = useState(false);
    const touchStartX = useRef<number | null>(null);

    const currentSet = Math.min(set, setCount - 1);
    // The last set is filled from the end, so it never shows empty space.
    const firstVisible = Math.min(
        currentSet * tilesPerSet,
        Math.max(0, tiles.length - tilesPerSet),
    );

    const goTo = (target: number) => setSet((target + setCount) % setCount);

    useEffect(() => {
        if (paused || prefersReducedMotion || setCount <= 1) {
            return;
        }

        const timer = window.setTimeout(
            () => setSet((currentSet + 1) % setCount),
            ROTATE_EVERY_MS,
        );

        return () => window.clearTimeout(timer);
    }, [currentSet, paused, prefersReducedMotion, setCount]);

    const tileWidth = `((100% - ${(tilesPerSet - 1) * gapRem}rem) / ${tilesPerSet})`;

    const arrowClasses =
        'absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md transition hover:bg-slate-50 md:flex';

    return (
        <div
            role="region"
            aria-roledescription="carousel"
            aria-label={label}
            className="relative"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
            onTouchStart={(event) => {
                touchStartX.current = event.touches[0].clientX;
            }}
            onTouchEnd={(event) => {
                if (touchStartX.current === null) {
                    return;
                }

                const distance =
                    event.changedTouches[0].clientX - touchStartX.current;
                touchStartX.current = null;

                if (Math.abs(distance) > 40) {
                    goTo(currentSet + (distance < 0 ? 1 : -1));
                }
            }}
        >
            {setCount > 1 && (
                <>
                    <button
                        type="button"
                        onClick={() => goTo(currentSet - 1)}
                        className={cn(arrowClasses, '-left-5')}
                        aria-label="Previous"
                    >
                        <ChevronLeft size={22} />
                    </button>
                    <button
                        type="button"
                        onClick={() => goTo(currentSet + 1)}
                        className={cn(arrowClasses, '-right-5')}
                        aria-label="Next"
                    >
                        <ChevronRight size={22} />
                    </button>
                </>
            )}

            <div className="overflow-hidden py-1">
                <div
                    className="flex transition-transform duration-700 ease-out motion-reduce:transition-none"
                    style={{
                        gap: `${gapRem}rem`,
                        transform: `translateX(calc(${-firstVisible} * (${tileWidth} + ${gapRem}rem)))`,
                    }}
                >
                    {tiles.map((tile, index) => {
                        const isVisible =
                            index >= firstVisible &&
                            index < firstVisible + tilesPerSet;

                        return (
                            <div
                                key={index}
                                inert={!isVisible}
                                className="flex"
                                style={{ flex: `0 0 calc(${tileWidth})` }}
                            >
                                {tile}
                            </div>
                        );
                    })}
                </div>
            </div>

            {setCount > 1 && (
                <div className="mt-4 flex justify-center gap-2">
                    {Array.from({ length: setCount }, (_, index) => (
                        <button
                            key={index}
                            type="button"
                            onClick={() => goTo(index)}
                            aria-label={`Show set ${index + 1} of ${setCount}`}
                            aria-current={index === currentSet}
                            className={cn(
                                'h-2.5 rounded-full transition-all',
                                index === currentSet
                                    ? 'w-7 bg-[#0D6EFD]'
                                    : 'w-2.5 bg-slate-300 hover:bg-slate-400',
                            )}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
