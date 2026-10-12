/**
 * The looks every back-office page shares, kept in one place so pages do
 * not drift apart: two button sizes (large for a page's main actions, small
 * inside popups and table rows) and the status badge.
 */
export const buttonClasses = {
    primary:
        'inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60',
    secondary:
        'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60',
    primarySmall:
        'inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D6EFD] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60',
    secondarySmall:
        'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60',
} as const;

/** The size of every status badge (Ready, Released, Arrived...); add its colors. */
export const badgeClasses =
    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black whitespace-nowrap';
