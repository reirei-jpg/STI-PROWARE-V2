import { useForm } from '@inertiajs/react';
import { LoaderCircle, Pencil, Plus, Save, Shirt, X } from 'lucide-react';
import { useState } from 'react';
import UniformSetController from '@/actions/App/Http/Controllers/UniformSetController';
import InputError from '@/components/input-error';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import type { UniformSetOption } from '@/types';

type SetForm = {
    name: string;
    blouse_product_id: string;
    polo_product_id: string;
    pants_product_id: string;
};

const inputClasses =
    'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

/**
 * The uniform sets, one per course: what its free set is made of (the
 * blouse and / or polo, and the pants), each an existing product with its
 * own eStore Item Code and sizes. Add a set, or change one.
 */
export default function UniformSetsDialog({
    open,
    sets,
    products,
    onClose,
}: {
    open: boolean;
    sets: UniformSetOption[];
    products: { id: number; name: string }[];
    onClose: () => void;
}) {
    // null: the list; 'new': adding a set; a set: changing it.
    const [editing, setEditing] = useState<UniformSetOption | 'new' | null>(
        null,
    );

    const close = () => {
        setEditing(null);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && close()}>
            <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-2xl [&>button:last-child]:hidden">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                    <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                            <Shirt size={22} />
                        </span>
                        <div>
                            <DialogTitle className="text-lg font-black text-slate-900">
                                Uniform sets
                            </DialogTitle>
                            <DialogDescription className="text-sm text-slate-500">
                                One set per course: a blouse (female) or polo
                                (male), and pants.
                            </DialogDescription>
                        </div>
                    </div>
                    <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                        <X size={20} />
                        <span className="sr-only">Close</span>
                    </DialogClose>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                    {editing !== null ? (
                        <SetEditor
                            key={editing === 'new' ? 'new' : editing.id}
                            set={editing === 'new' ? null : editing}
                            products={products}
                            onDone={() => setEditing(null)}
                        />
                    ) : (
                        <div className="space-y-3">
                            {sets.length === 0 ? (
                                <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                                    No uniform set yet. Add one for each course,
                                    e.g. BSIT.
                                </p>
                            ) : (
                                sets.map((set) => (
                                    <div
                                        key={set.id}
                                        className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 p-4"
                                    >
                                        <div className="min-w-0 text-sm">
                                            <p className="font-black text-slate-900">
                                                {set.name} set
                                            </p>
                                            <p className="mt-1 text-slate-600">
                                                Top:{' '}
                                                {[
                                                    set.blouse?.product_name,
                                                    set.polo?.product_name,
                                                ]
                                                    .filter(Boolean)
                                                    .join(' or ')}
                                            </p>
                                            <p className="text-slate-600">
                                                Pants:{' '}
                                                {set.pants?.product_name ?? '—'}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-400">
                                                Given to {set.students_count}{' '}
                                                {set.students_count === 1
                                                    ? 'student'
                                                    : 'students'}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setEditing(set)}
                                            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-100"
                                        >
                                            <Pencil size={14} />
                                            Change
                                        </button>
                                    </div>
                                ))
                            )}

                            <button
                                type="button"
                                onClick={() => setEditing('new')}
                                className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700"
                            >
                                <Plus size={16} />
                                Add a set
                            </button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

/** Add a set, or change one: its course name and its three products. */
function SetEditor({
    set,
    products,
    onDone,
}: {
    set: UniformSetOption | null;
    products: { id: number; name: string }[];
    onDone: () => void;
}) {
    const form = useForm<SetForm>({
        name: set?.name ?? '',
        blouse_product_id: set?.blouse ? String(set.blouse.product_id) : '',
        polo_product_id: set?.polo ? String(set.polo.product_id) : '',
        pants_product_id: set?.pants ? String(set.pants.product_id) : '',
    });
    const { data, setData, errors, processing } = form;

    const productSelect = (
        field: keyof Omit<SetForm, 'name'>,
        label: string,
        hint: string,
    ) => (
        <label className="grid gap-1.5">
            <span className="text-sm font-black text-slate-700">{label}</span>
            <select
                value={data[field]}
                onChange={(event) => setData(field, event.target.value)}
                className={inputClasses}
            >
                <option value="">{hint}</option>
                {products.map((product) => (
                    <option key={product.id} value={product.id}>
                        {product.name}
                    </option>
                ))}
            </select>
            <InputError message={errors[field]} />
        </label>
    );

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                const options = { preserveScroll: true, onSuccess: onDone };

                if (set) {
                    form.put(UniformSetController.update(set.id).url, options);
                } else {
                    form.post(UniformSetController.store().url, options);
                }
            }}
            className="space-y-4"
        >
            <p className="text-base font-black text-slate-900">
                {set ? `Change the ${set.name} set` : 'Add a set'}
            </p>

            <label className="grid gap-1.5">
                <span className="text-sm font-black text-slate-700">
                    Course
                </span>
                <input
                    value={data.name}
                    onChange={(event) => setData('name', event.target.value)}
                    maxLength={60}
                    placeholder="e.g. BSIT"
                    className={inputClasses}
                    autoFocus
                />
                <InputError message={errors.name} />
            </label>

            {productSelect(
                'blouse_product_id',
                'Blouse (for female students)',
                'No blouse',
            )}
            {productSelect(
                'polo_product_id',
                'Polo (for male students)',
                'No polo',
            )}
            {productSelect('pants_product_id', 'Pants', 'Choose the pants…')}

            <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
                Each is a product in Products, with its own eStore Item Code and
                sizes. A product not there yet? Add it in Products first.
                {set &&
                    ' Students already given this set keep the pieces they got.'}
            </p>

            <div className="flex justify-end gap-3">
                <button
                    type="button"
                    onClick={onDone}
                    className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                >
                    Back
                </button>
                <button
                    type="submit"
                    disabled={processing}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {processing ? (
                        <LoaderCircle size={17} className="animate-spin" />
                    ) : (
                        <Save size={17} />
                    )}
                    Save set
                </button>
            </div>
        </form>
    );
}
