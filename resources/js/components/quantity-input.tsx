import { Minus, Plus } from 'lucide-react';
import { MAX_PER_ITEM, wholeNumberInput } from '@/lib/number-input';
import { cn } from '@/lib/utils';

/**
 * − [ 2 ] + for how many: never below 1 or above `most` (what is left to
 * buy, or 99 as the server allows), even while typing. With `keepTyped`,
 * a typed number above `most` stays as typed (the form says what is wrong
 * and `invalid` outlines the box in red); − and + still stop at `most`.
 */
export default function QuantityInput({
    value,
    onChange,
    label,
    most = MAX_PER_ITEM,
    small = false,
    tone = 'blue',
    keepTyped = false,
    invalid = false,
}: {
    value: string;
    onChange: (value: string) => void;
    label: string;
    most?: number;
    small?: boolean;
    tone?: 'blue' | 'amber';
    keepTyped?: boolean;
    invalid?: boolean;
}) {
    const quantity = Number(value) || 0;
    const cap = Math.max(most, 1);
    const box = small ? 'h-9 w-9' : 'h-11 w-11';
    const typedCap = keepTyped ? Number.MAX_SAFE_INTEGER : cap;

    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={() =>
                    onChange(String(Math.max(1, Math.min(quantity - 1, cap))))
                }
                disabled={quantity <= 1}
                className={`flex ${box} items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40`}
                aria-label={`One less (${label})`}
            >
                <Minus size={16} />
            </button>
            <input
                value={value}
                onChange={(event) =>
                    onChange(wholeNumberInput(event.target.value, typedCap))
                }
                onBlur={() =>
                    onChange(String(Math.max(1, Math.min(quantity, typedCap))))
                }
                inputMode="numeric"
                className={cn(
                    small ? 'h-9 w-14' : 'h-11 w-20',
                    'rounded-xl border text-center text-sm font-black text-slate-800 outline-none focus:ring-2',
                    invalid
                        ? 'border-red-400 bg-red-50 text-red-700 focus:border-red-500 focus:ring-red-100'
                        : tone === 'amber'
                          ? 'border-slate-200 focus:border-amber-400 focus:ring-amber-100'
                          : 'border-slate-200 focus:border-blue-400 focus:ring-blue-100',
                )}
                aria-invalid={invalid}
                aria-label={label}
            />
            <button
                type="button"
                onClick={() => onChange(String(Math.min(cap, quantity + 1)))}
                disabled={quantity >= cap}
                className={`flex ${box} items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40`}
                aria-label={`One more (${label})`}
            >
                <Plus size={16} />
            </button>
        </div>
    );
}
