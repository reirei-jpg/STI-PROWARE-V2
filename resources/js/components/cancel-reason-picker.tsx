import { CheckCircle2, Circle } from 'lucide-react';
import InputError from '@/components/input-error';
import type { CancelReasonOption } from '@/lib/cancel-reasons';
import { cn } from '@/lib/utils';

/** The fewest characters "Other" needs, as the server checks. */
const MIN_NOTE = 5;

/**
 * Pick why an order is cancelled, like in online shops: one reason from the
 * list, and a box to write why only for Other.
 */
export default function CancelReasonPicker({
    reasons,
    reason,
    note,
    onReason,
    onNote,
    errors,
    notePlaceholder,
}: {
    reasons: CancelReasonOption[];
    reason: string;
    note: string;
    onReason: (value: string) => void;
    onNote: (value: string) => void;
    errors: { reason?: string; note?: string };
    notePlaceholder: string;
}) {
    // Other needs a few words, so the student understands why.
    const written = note.trim().length;

    return (
        <div className="space-y-2">
            <div role="radiogroup" className="space-y-2">
                {reasons.map((option) => {
                    const chosen = reason === option.value;

                    return (
                        <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={chosen}
                            onClick={() => onReason(option.value)}
                            className={cn(
                                'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-bold transition',
                                chosen
                                    ? 'border-red-300 bg-red-50 text-red-800'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                            )}
                        >
                            {chosen ? (
                                <CheckCircle2
                                    size={18}
                                    className="shrink-0 text-red-600"
                                />
                            ) : (
                                <Circle
                                    size={18}
                                    className="shrink-0 text-slate-300"
                                />
                            )}
                            {option.label}
                        </button>
                    );
                })}
            </div>
            <InputError message={errors.reason} />

            {reason === 'other' && (
                <label className="grid gap-1.5 pt-1">
                    <span className="text-sm font-black text-slate-700">
                        Write why
                    </span>
                    <textarea
                        value={note}
                        onChange={(event) => onNote(event.target.value)}
                        rows={3}
                        maxLength={200}
                        placeholder={notePlaceholder}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        autoFocus
                    />
                    {errors.note ? (
                        <InputError message={errors.note} />
                    ) : (
                        <span
                            className={cn(
                                'text-xs font-semibold',
                                written < MIN_NOTE
                                    ? 'text-amber-700'
                                    : 'text-slate-400',
                            )}
                        >
                            {written < MIN_NOTE
                                ? `Please write at least ${MIN_NOTE} characters (${written} of ${MIN_NOTE}).`
                                : `${note.length} of 200 characters`}
                        </span>
                    )}
                </label>
            )}
        </div>
    );
}
