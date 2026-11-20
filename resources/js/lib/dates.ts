/** "2026-02-28" → "2026-01-28": one month before a day picked as To. */
export function monthBefore(day: string): string {
    const date = new Date(`${day}T00:00:00`);
    date.setMonth(date.getMonth() - 1);

    return date.toLocaleDateString('en-CA');
}

/** Today as "YYYY-MM-DD" in the viewer's time zone (Manila). */
export function todayIso(): string {
    return new Date().toLocaleDateString('en-CA');
}
