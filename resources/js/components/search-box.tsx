import { Search } from 'lucide-react';
import type { HTMLAttributes } from 'react';

/**
 * The search box of a back-office list, the same on every page; it sits
 * in the list's header, above the table.
 */
export default function SearchBox({
    value,
    onChange,
    placeholder,
    maxLength = 120,
    inputMode,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    maxLength?: number;
    inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
    return (
        <label className="flex h-11 w-full shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 sm:max-w-xs lg:max-w-sm">
            <Search size={18} className="shrink-0" />
            <input
                type="search"
                maxLength={maxLength}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                inputMode={inputMode}
                placeholder={placeholder}
                aria-label={placeholder}
                className="w-full min-w-0 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
            />
        </label>
    );
}
