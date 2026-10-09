import { useForm } from '@inertiajs/react';
import { ClipboardCheck, LoaderCircle, X } from 'lucide-react';
import type { ReactNode } from 'react';
import ProductStockController from '@/actions/App/Http/Controllers/ProductStockController';
import InputError from '@/components/input-error';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatUnits } from '@/lib/units';
import { cn } from '@/lib/utils';
import type {
    StockCorrectionReasonOption,
    StockProduct,
    StockVariant,
} from '@/types';

const inputClasses =
    'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

type CorrectionForm = {
    product_variant_id: string;
    reason: string;
    pieces_to_remove: string;
    actual_count: string;
    note: string;
    /** Pesos per piece, for a count that adds pieces. */
    unit_cost: string;
};

/** Keeps only digits, so "45 pcs" becomes "45". */
const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, 7);

/**
 * The pop-up where the Specialist corrects a variant's stock. For damaged,
 * lost or returned pieces she enters how many to take out; for a recount
 * (or another reason) she enters the count on the shelf, and, when that
 * adds pieces, their eStore price per piece. Before saving it shows the
 * stock before and after.
 */
export default function CorrectStockDialog({
    open,
    product,
    variants,
    reasons,
    initialVariantId,
    onClose,
}: {
    open: boolean;
    product: StockProduct;
    variants: StockVariant[];
    reasons: StockCorrectionReasonOption[];
    initialVariantId: number | null;
    onClose: () => void;
}) {
    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-xl [&>button:last-child]:hidden">
                {open && (
                    <CorrectionForm
                        product={product}
                        variants={variants}
                        reasons={reasons}
                        initialVariantId={initialVariantId}
                        onClose={onClose}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function CorrectionForm({
    product,
    variants,
    reasons,
    initialVariantId,
    onClose,
}: {
    product: StockProduct;
    variants: StockVariant[];
    reasons: StockCorrectionReasonOption[];
    initialVariantId: number | null;
    onClose: () => void;
}) {
    const form = useForm<CorrectionForm>({
        product_variant_id: String(
            initialVariantId ?? (variants.length === 1 ? variants[0].id : ''),
        ),
        reason: '',
        pieces_to_remove: '',
        actual_count: '',
        note: '',
        unit_cost: '',
    });
    const { data, setData, processing, errors } = form;

    const variant = variants.find(
        (candidate) => String(candidate.id) === data.product_variant_id,
    );
    const reason = reasons.find((option) => option.value === data.reason);
    const amountText = reason
        ? reason.removes_pieces
            ? data.pieces_to_remove
            : data.actual_count
        : '';

    // The stock after saving, and why it cannot be saved yet, if so.
    let after: number | null = null;
    let problem: string | null = null;

    if (variant && reason && amountText !== '') {
        const amount = Number(amountText);

        if (reason.removes_pieces) {
            if (amount < 1) {
                problem = 'Take out at least 1 piece.';
            } else if (amount > variant.stock_on_hand) {
                problem = `Only ${formatUnits(variant.stock_on_hand, 'Piece')} are in stock.`;
            } else {
                after = variant.stock_on_hand - amount;
            }
        } else if (amount === variant.stock_on_hand) {
            problem = `The stock is already ${formatUnits(amount, 'Piece')}, so nothing would change.`;
        } else {
            after = amount;
        }
    }

    const noteRequired = data.reason === 'other';
    // Pieces added need what they cost on the eStore, so every piece has one.
    const addsPieces =
        variant !== undefined &&
        after !== null &&
        after > variant.stock_on_hand;
    const costMissing = addsPieces && !(Number(data.unit_cost) > 0);

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.post(ProductStockController.store(product.id).url, {
                    preserveScroll: true,
                    onSuccess: onClose,
                });
            }}
            className="flex min-h-0 flex-col"
        >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <ClipboardCheck size={22} />
                    </span>
                    <div>
                        <DialogTitle className="text-lg font-black text-slate-900">
                            Correct Stock
                        </DialogTitle>
                        <DialogDescription className="text-sm text-slate-500">
                            {product.name} · the correction is kept in the Stock
                            History with your name
                        </DialogDescription>
                    </div>
                </div>
                <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                    <X size={20} />
                    <span className="sr-only">Close</span>
                </DialogClose>
            </div>

            <div className="space-y-6 overflow-y-auto px-6 py-5">
                {product.has_options && (
                    <section className="space-y-2">
                        <p className="text-sm font-black text-slate-700">
                            Which variant?
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {variants.map((candidate) => (
                                <ChoiceCard
                                    key={candidate.id}
                                    name="product_variant_id"
                                    checked={
                                        data.product_variant_id ===
                                        String(candidate.id)
                                    }
                                    onChange={() =>
                                        setData(
                                            'product_variant_id',
                                            String(candidate.id),
                                        )
                                    }
                                >
                                    <span>
                                        {candidate.label}
                                        <span className="block text-xs font-normal text-slate-500">
                                            {formatUnits(
                                                candidate.stock_on_hand,
                                                'Piece',
                                            )}{' '}
                                            in stock
                                        </span>
                                    </span>
                                </ChoiceCard>
                            ))}
                        </div>
                        <InputError message={errors.product_variant_id} />
                    </section>
                )}

                <section className="space-y-2">
                    <p className="text-sm font-black text-slate-700">Reason</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {reasons.map((option) => (
                            <ChoiceCard
                                key={option.value}
                                name="reason"
                                checked={data.reason === option.value}
                                onChange={() => setData('reason', option.value)}
                            >
                                {option.label}
                            </ChoiceCard>
                        ))}
                    </div>
                    <InputError message={errors.reason} />
                </section>

                {reason && (
                    <section className="space-y-2">
                        <label className="grid gap-1.5">
                            <span className="text-sm font-black text-slate-700">
                                {reason.removes_pieces
                                    ? 'How many pieces to take out of stock?'
                                    : 'How many pieces are actually on the shelf?'}
                            </span>
                            <span className="flex items-center gap-2">
                                <input
                                    value={amountText}
                                    onChange={(event) =>
                                        setData(
                                            reason.removes_pieces
                                                ? 'pieces_to_remove'
                                                : 'actual_count',
                                            digitsOnly(event.target.value),
                                        )
                                    }
                                    inputMode="numeric"
                                    placeholder="0"
                                    className={cn(
                                        inputClasses,
                                        'w-40 text-right',
                                        problem && 'border-red-300',
                                    )}
                                    autoFocus
                                />
                                <span className="text-sm font-bold text-slate-500">
                                    pcs
                                </span>
                            </span>
                            <InputError
                                message={
                                    problem ??
                                    errors.pieces_to_remove ??
                                    errors.actual_count
                                }
                            />
                        </label>

                        {variant && after !== null && (
                            <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
                                {product.has_options && (
                                    <span className="font-bold">
                                        {variant.label}:{' '}
                                    </span>
                                )}
                                <span className="font-black">
                                    {formatUnits(
                                        variant.stock_on_hand,
                                        'Piece',
                                    )}{' '}
                                    → {formatUnits(after, 'Piece')}
                                </span>{' '}
                                ({after > variant.stock_on_hand ? '+' : '−'}
                                {formatUnits(
                                    Math.abs(after - variant.stock_on_hand),
                                    'Piece',
                                )}
                                )
                            </p>
                        )}
                    </section>
                )}

                {addsPieces && (
                    <label className="grid gap-1.5">
                        <span className="text-sm font-black text-slate-700">
                            eStore price per piece of the added pieces
                        </span>
                        <span className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-500">
                                ₱
                            </span>
                            <input
                                value={data.unit_cost}
                                onChange={(event) =>
                                    setData(
                                        'unit_cost',
                                        event.target.value
                                            .replace(/[^\d.]/g, '')
                                            .slice(0, 10),
                                    )
                                }
                                inputMode="decimal"
                                placeholder="0.00"
                                className={cn(
                                    inputClasses,
                                    'w-40 text-right',
                                    errors.unit_cost && 'border-red-300',
                                )}
                            />
                        </span>
                        <span className="text-xs text-slate-500">
                            What PROWARE paid Head Office for each piece, as on
                            the eStore order. Used for the Sales Reports.
                        </span>
                        <InputError message={errors.unit_cost} />
                    </label>
                )}

                <label className="grid gap-1.5">
                    <span className="text-sm font-black text-slate-700">
                        Note {noteRequired ? '(required)' : '(optional)'}
                    </span>
                    <input
                        value={data.note}
                        onChange={(event) =>
                            setData('note', event.target.value)
                        }
                        maxLength={200}
                        placeholder={
                            noteRequired
                                ? 'Write what happened'
                                : 'e.g. Counted the shelf on Oct 3'
                        }
                        className={inputClasses}
                    />
                    <InputError message={errors.note} />
                </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                <DialogClose className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                    Cancel
                </DialogClose>
                <button
                    type="submit"
                    disabled={
                        processing ||
                        after === null ||
                        costMissing ||
                        (noteRequired && data.note.trim() === '')
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {processing ? (
                        <LoaderCircle size={17} className="animate-spin" />
                    ) : (
                        <ClipboardCheck size={17} />
                    )}
                    Save Correction
                </button>
            </div>
        </form>
    );
}

function ChoiceCard({
    name,
    checked,
    onChange,
    children,
}: {
    name: string;
    checked: boolean;
    onChange: () => void;
    children: ReactNode;
}) {
    return (
        <label
            className={cn(
                'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition',
                checked
                    ? 'border-[#0D6EFD] bg-blue-50 text-blue-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
            )}
        >
            <input
                type="radio"
                name={name}
                checked={checked}
                onChange={onChange}
                className="h-4 w-4 shrink-0 accent-[#0D6EFD]"
            />
            {children}
        </label>
    );
}
