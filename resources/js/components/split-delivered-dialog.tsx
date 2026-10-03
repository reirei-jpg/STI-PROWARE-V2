import { useForm } from '@inertiajs/react';
import { Boxes, LoaderCircle, X } from 'lucide-react';
import ItemLinkController from '@/actions/App/Http/Controllers/ItemLinkController';
import InputError from '@/components/input-error';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatConversion, formatUnits } from '@/lib/units';
import { cn } from '@/lib/utils';
import type { ItemToSplit } from '@/types';

const inputClasses =
    'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-right text-sm font-semibold text-slate-800 shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

/**
 * The pop-up where the Specialist says how many pieces of each variant
 * arrived for a shared code that is not in stock yet. The counts must add
 * up to what arrived.
 */
export default function SplitDeliveredDialog({
    item,
    onClose,
}: {
    item: ItemToSplit | null;
    onClose: () => void;
}) {
    return (
        <Dialog
            open={item !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-2xl [&>button:last-child]:hidden">
                {item && <SplitForm item={item} onClose={onClose} />}
            </DialogContent>
        </Dialog>
    );
}

function SplitForm({
    item,
    onClose,
}: {
    item: ItemToSplit;
    onClose: () => void;
}) {
    const form = useForm<{ counts: Record<number, string> }>({ counts: {} });
    const { data, setData, processing } = form;
    const errors = form.errors as Record<string, string | undefined>;

    const counted = item.split_into.reduce(
        (sum, variant) => sum + (Number(data.counts[variant.id]) || 0),
        0,
    );
    const matches = counted === item.pieces_waiting;

    const submit = () => {
        form.transform((current) => ({
            item_code: item.item_code,
            pieces: item.split_into.map((variant) => ({
                product_variant_id: variant.id,
                pieces: current.counts[variant.id] ?? '',
            })),
        }));
        form.post(ItemLinkController.split().url, {
            preserveScroll: true,
            onSuccess: onClose,
        });
    };

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                submit();
            }}
            className="flex min-h-0 flex-col"
        >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                        <Boxes size={22} />
                    </span>
                    <div>
                        <DialogTitle className="text-lg font-black text-slate-900">
                            Split into stock:{' '}
                            <span className="font-mono">{item.item_code}</span>
                        </DialogTitle>
                        <DialogDescription className="text-sm text-slate-500">
                            {item.product_name} ·{' '}
                            {formatConversion(
                                item.units_waiting,
                                item.unit_name,
                                item.pieces_per_unit,
                            )}{' '}
                            arrived
                        </DialogDescription>
                    </div>
                </div>
                <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                    <X size={20} />
                    <span className="sr-only">Close</span>
                </DialogClose>
            </div>

            <div className="space-y-4 overflow-y-auto px-6 py-5">
                <p className="text-sm font-black text-slate-700">
                    How many of each did you receive? (pcs)
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {item.split_into.map((variant) => (
                        <label
                            key={variant.id}
                            className="grid gap-1 rounded-xl border border-slate-200 bg-slate-50/60 p-3"
                        >
                            <span className="truncate text-sm font-black text-slate-800">
                                {variant.label}
                            </span>
                            <input
                                value={data.counts[variant.id] ?? ''}
                                onChange={(event) =>
                                    setData('counts', {
                                        ...data.counts,
                                        [variant.id]: event.target.value
                                            .replace(/\D/g, '')
                                            .slice(0, 7),
                                    })
                                }
                                inputMode="numeric"
                                placeholder="0"
                                className={inputClasses}
                                aria-label={`Pieces of ${variant.label} received`}
                            />
                            <span className="text-[11px] text-slate-500">
                                In stock now:{' '}
                                {formatUnits(variant.stock_on_hand, 'Piece')}
                            </span>
                        </label>
                    ))}
                </div>
                <p
                    className={cn(
                        'rounded-xl px-4 py-3 text-sm font-bold',
                        matches
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-amber-50 text-amber-900',
                    )}
                >
                    Counted {formatUnits(counted, 'Piece')} of{' '}
                    {formatUnits(item.pieces_waiting, 'Piece')} that arrived.
                    {!matches && ' They must add up before you can save.'}
                </p>
                <InputError message={errors.pieces} />
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                <DialogClose className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                    Cancel
                </DialogClose>
                <button
                    type="submit"
                    disabled={processing || !matches}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {processing ? (
                        <LoaderCircle size={17} className="animate-spin" />
                    ) : (
                        <Boxes size={17} />
                    )}
                    Add to Stock
                </button>
            </div>
        </form>
    );
}
