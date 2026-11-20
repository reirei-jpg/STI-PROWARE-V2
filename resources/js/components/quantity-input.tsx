import { Minus, Plus } from 'lucide-react';
import InputError from '@/components/input-error';
import {
    MAX_PER_ITEM,
    quantityProblem,
    typedQuantity,
} from '@/lib/number-input';
import { cn } from '@/lib/utils';

/**
 * − [ 2 ] + for how many. The box keeps exactly what was typed (".5",
 * "-1", letters): a wrong amount is outlined in red with the reason under
 * it ("Enter a whole number, e.g. 2.", "Enter at least 1."), and the form
 * using it stays greyed out (typedQuantity). More than `most` says "Enter
 * N or fewer." unless `keepTyped`, where the form says what is wrong (e.g.
 * "Only 94 pcs left") and `invalid` outlines the box. − and + always give
 * a whole number between 1 and `most`.
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
    const quantity = typedQuantity(value) ?? 0;
    const cap = Math.max(most, 1);
    const box = small ? 'h-9 w-9' : 'h-11 w-11';
    const problem =
        quantityProblem(value) ??
        (!keepTyped && quantity > cap ? `Enter ${cap} or fewer.` : null);
    const wrong = invalid || problem !== null;

    return (
        <div className="grid gap-1">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() =>
                        onChange(
                            String(Math.max(1, Math.min(quantity - 1, cap))),
                        )
                    }
                    disabled={quantity <= 1}
                    className={`flex ${box} items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40`}
                    aria-label={`One less (${label})`}
                >
                    <Minus size={16} />
                </button>
                <input
                    value={value}
                    // Kept as typed: a wrong amount shows in red instead of changing.
                    onChange={(event) =>
                        onChange(event.target.value.slice(0, 12))
                    }
                    inputMode="numeric"
                    className={cn(
                        small ? 'h-9 w-14' : 'h-11 w-20',
                        'rounded-xl border text-center text-sm font-black text-slate-800 outline-none focus:ring-2',
                        wrong
                            ? 'border-red-400 bg-red-50 text-red-700 focus:border-red-500 focus:ring-red-100'
                            : tone === 'amber'
                              ? 'border-slate-200 focus:border-amber-400 focus:ring-amber-100'
                              : 'border-slate-200 focus:border-blue-400 focus:ring-blue-100',
                    )}
                    aria-invalid={wrong}
                    aria-label={label}
                />
                <button
                    type="button"
                    onClick={() =>
                        onChange(
                            String(Math.min(cap, Math.max(quantity, 0) + 1)),
                        )
                    }
                    disabled={quantity >= cap}
                    className={`flex ${box} items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40`}
                    aria-label={`One more (${label})`}
                >
                    <Plus size={16} />
                </button>
            </div>
            <InputError message={problem ?? undefined} />
        </div>
    );
}
