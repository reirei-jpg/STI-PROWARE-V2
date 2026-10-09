import { useForm } from '@inertiajs/react';
import { Gift, LoaderCircle, Plus, Trash2, X } from 'lucide-react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import FreeUniformController from '@/actions/App/Http/Controllers/FreeUniformController';
import InputError from '@/components/input-error';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type {
    UniformSetOption,
    UniformSetPiece,
    UniformSizeOption,
    UniformTop,
} from '@/types';

type StudentInput = {
    key: number;
    name: string;
    enrollment_form_number: string;
    course_section: string;
    uniform_set_id: string;
    top_kind: UniformTop | '';
    top_variant_id: string;
    pants_variant_id: string;
};

type GroupForm = {
    enrolled_on: string;
    note: string;
    students: StudentInput[];
};

const inputClasses =
    'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

/**
 * The Record a group pop-up: the date the students enrolled together, then
 * one card per student (at least the promo's group size): name, Enrollment
 * Form #, course / section, the course's set, Blouse or Polo with its size,
 * and the pants' size. A size with none left (counting the students above)
 * is still to give: it is saved and given when it arrives.
 */
export default function RecordFreeUniformGroupDialog({
    open,
    sets,
    groupSize,
    today,
    onClose,
}: {
    open: boolean;
    sets: UniformSetOption[];
    groupSize: number;
    today: string;
    onClose: () => void;
}) {
    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="flex max-h-[94vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-5xl [&>button:last-child]:hidden">
                {open && (
                    <GroupForm
                        sets={sets}
                        groupSize={groupSize}
                        today={today}
                        onClose={onClose}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function GroupForm({
    sets,
    groupSize,
    today,
    onClose,
}: {
    sets: UniformSetOption[];
    groupSize: number;
    today: string;
    onClose: () => void;
}) {
    const nextKey = useRef(groupSize + 1);
    const onlySet = sets.length === 1 ? sets[0] : null;
    const emptyStudent = (key: number, from?: StudentInput): StudentInput => ({
        key,
        name: '',
        enrollment_form_number: '',
        // A new student usually has the same course as the one above.
        course_section: from?.course_section ?? '',
        uniform_set_id:
            from?.uniform_set_id ?? (onlySet ? String(onlySet.id) : ''),
        top_kind: '',
        top_variant_id: '',
        pants_variant_id: '',
    });

    const form = useForm<GroupForm>({
        enrolled_on: today,
        note: '',
        students: Array.from({ length: groupSize }, (_, index) =>
            emptyStudent(index + 1),
        ),
    });
    const { data, setData, processing } = form;
    const errors = form.errors as Record<string, string | undefined>;

    const updateStudent = (key: number, changes: Partial<StudentInput>) =>
        setData(
            'students',
            data.students.map((student) =>
                student.key === key ? { ...student, ...changes } : student,
            ),
        );

    const addStudent = () =>
        setData('students', [
            ...data.students,
            emptyStudent(nextKey.current++, data.students.at(-1)),
        ]);

    const removeStudent = (key: number) =>
        setData(
            'students',
            data.students.filter((student) => student.key !== key),
        );

    // Pieces taken by the students above each one, to tell which sizes
    // will be still to give.
    const takenBefore: Record<number, number>[] = [];
    const taken: Record<number, number> = {};

    for (const student of data.students) {
        takenBefore.push({ ...taken });

        for (const id of [student.top_variant_id, student.pants_variant_id]) {
            if (id !== '') {
                taken[Number(id)] = (taken[Number(id)] ?? 0) + 1;
            }
        }
    }

    const tooFew = data.students.length < groupSize;

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.transform((current) => ({
                    enrolled_on: current.enrolled_on,
                    note: current.note,
                    students: current.students.map(
                        ({ key: _key, ...student }) => student,
                    ),
                }));
                form.post(FreeUniformController.store().url, {
                    preserveScroll: true,
                    onSuccess: onClose,
                });
            }}
            className="flex min-h-0 flex-col"
        >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                        <Gift size={22} />
                    </span>
                    <div>
                        <DialogTitle className="text-lg font-black text-slate-900">
                            Record a group
                        </DialogTitle>
                        <DialogDescription className="text-sm text-slate-500">
                            At least {groupSize} students who enrolled together.
                            Each gets 1 set for free.
                        </DialogDescription>
                    </div>
                </div>
                <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                    <X size={20} />
                    <span className="sr-only">Close</span>
                </DialogClose>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-slate-50/60 px-6 py-5">
                <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
                    <label className="grid gap-1.5">
                        <span className="text-sm font-black text-slate-700">
                            Date enrolled
                        </span>
                        <input
                            type="date"
                            value={data.enrolled_on}
                            max={today}
                            onChange={(event) =>
                                setData('enrolled_on', event.target.value)
                            }
                            className={inputClasses}
                        />
                        <InputError message={errors.enrolled_on} />
                    </label>
                    <label className="grid gap-1.5">
                        <span className="text-sm font-black text-slate-700">
                            Note (optional)
                        </span>
                        <input
                            value={data.note}
                            onChange={(event) =>
                                setData('note', event.target.value)
                            }
                            maxLength={200}
                            placeholder="e.g. Friends from Ormoc National High School"
                            className={inputClasses}
                        />
                        <InputError message={errors.note} />
                    </label>
                </div>

                {data.students.map((student, index) => (
                    <StudentCard
                        key={student.key}
                        number={index + 1}
                        student={student}
                        sets={sets}
                        takenBefore={takenBefore[index]}
                        errors={errors}
                        index={index}
                        canRemove={data.students.length > 1}
                        onChange={(changes) =>
                            updateStudent(student.key, changes)
                        }
                        onRemove={() => removeStudent(student.key)}
                    />
                ))}

                <button
                    type="button"
                    onClick={addStudent}
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-black text-blue-700 shadow-sm transition hover:bg-blue-50"
                >
                    <Plus size={16} />
                    Add a student
                </button>
                <InputError message={errors.students} />
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p
                    className={cn(
                        'text-sm font-bold',
                        tooFew ? 'text-amber-700' : 'text-slate-600',
                    )}
                >
                    {data.students.length}{' '}
                    {data.students.length === 1 ? 'student' : 'students'} ·{' '}
                    {data.students.length}{' '}
                    {data.students.length === 1 ? 'set' : 'sets'}
                    {tooFew && ` · add at least ${groupSize}`}
                </p>
                <div className="flex justify-end gap-3">
                    <DialogClose className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                        Cancel
                    </DialogClose>
                    <button
                        type="submit"
                        disabled={processing || tooFew}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {processing ? (
                            <LoaderCircle size={17} className="animate-spin" />
                        ) : (
                            <Gift size={17} />
                        )}
                        Save and give the sets
                    </button>
                </div>
            </div>
        </form>
    );
}

/** One student: who they are, then their set and sizes. */
function StudentCard({
    number,
    student,
    sets,
    takenBefore,
    errors,
    index,
    canRemove,
    onChange,
    onRemove,
}: {
    number: number;
    student: StudentInput;
    sets: UniformSetOption[];
    takenBefore: Record<number, number>;
    errors: Record<string, string | undefined>;
    index: number;
    canRemove: boolean;
    onChange: (changes: Partial<StudentInput>) => void;
    onRemove: () => void;
}) {
    const set = sets.find(
        (option) => String(option.id) === student.uniform_set_id,
    );
    const tops = set
        ? (['blouse', 'polo'] as const).filter((kind) => set[kind] !== null)
        : [];
    const top = set && student.top_kind !== '' ? set[student.top_kind] : null;
    const error = (field: string) => errors[`students.${index}.${field}`];

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-black text-slate-900">
                    Student {number}
                </p>
                {canRemove && (
                    <button
                        type="button"
                        onClick={onRemove}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-black text-red-700 transition hover:bg-red-100"
                    >
                        <Trash2 size={13} />
                        Remove
                    </button>
                )}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
                <Field label="Name" error={error('name')}>
                    <input
                        value={student.name}
                        onChange={(event) =>
                            onChange({ name: event.target.value })
                        }
                        maxLength={120}
                        placeholder="e.g. Juan Dela Cruz"
                        className={inputClasses}
                    />
                </Field>
                <Field
                    label="Enrollment Form #"
                    error={error('enrollment_form_number')}
                >
                    <input
                        value={student.enrollment_form_number}
                        onChange={(event) =>
                            onChange({
                                enrollment_form_number: event.target.value,
                            })
                        }
                        maxLength={40}
                        placeholder="e.g. 2026-01234"
                        className={inputClasses}
                    />
                </Field>
                <Field
                    label="Course / Section (optional)"
                    error={error('course_section')}
                >
                    <input
                        value={student.course_section}
                        onChange={(event) =>
                            onChange({ course_section: event.target.value })
                        }
                        maxLength={60}
                        placeholder="e.g. BSIT 1A"
                        className={inputClasses}
                    />
                </Field>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-[10rem_12rem_1fr_1fr]">
                <Field label="Set" error={error('uniform_set_id')}>
                    <select
                        value={student.uniform_set_id}
                        onChange={(event) =>
                            onChange({
                                uniform_set_id: event.target.value,
                                top_kind: '',
                                top_variant_id: '',
                                pants_variant_id: '',
                            })
                        }
                        className={inputClasses}
                    >
                        <option value="">Choose…</option>
                        {sets.map((option) => (
                            <option key={option.id} value={option.id}>
                                1 {option.name} set
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Top" error={error('top_kind')} isGroup>
                    <div className="grid grid-cols-2 gap-1.5">
                        {(['blouse', 'polo'] as const).map((kind) => (
                            <button
                                key={kind}
                                type="button"
                                disabled={!tops.includes(kind)}
                                onClick={() =>
                                    onChange({
                                        top_kind: kind,
                                        top_variant_id: '',
                                    })
                                }
                                aria-pressed={student.top_kind === kind}
                                className={cn(
                                    'h-11 rounded-xl text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40',
                                    student.top_kind === kind
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                                )}
                            >
                                {kind === 'blouse' ? 'Blouse' : 'Polo'}
                            </button>
                        ))}
                    </div>
                </Field>
                <SizeField
                    label={
                        student.top_kind === ''
                            ? 'Top size'
                            : `${student.top_kind === 'blouse' ? 'Blouse' : 'Polo'} size`
                    }
                    piece={top}
                    value={student.top_variant_id}
                    takenBefore={takenBefore}
                    placeholder={
                        set
                            ? 'Choose Blouse or Polo first'
                            : 'Choose the set first'
                    }
                    error={error('top_variant_id')}
                    onChange={(id) => onChange({ top_variant_id: id })}
                />
                <SizeField
                    label="Pants size"
                    piece={set?.pants ?? null}
                    value={student.pants_variant_id}
                    takenBefore={takenBefore}
                    placeholder="Choose the set first"
                    error={error('pants_variant_id')}
                    onChange={(id) => onChange({ pants_variant_id: id })}
                />
            </div>
        </section>
    );
}

/**
 * A size picker showing how many are left; a size with none left for this
 * student is marked as still to give.
 */
function SizeField({
    label,
    piece,
    value,
    takenBefore,
    placeholder,
    error,
    onChange,
}: {
    label: string;
    piece: UniformSetPiece | null;
    value: string;
    takenBefore: Record<number, number>;
    placeholder: string;
    error?: string;
    onChange: (id: string) => void;
}) {
    const left = (size: UniformSizeOption) =>
        Math.max(0, size.free_to_sell - (takenBefore[size.id] ?? 0));
    const chosen = piece?.sizes.find((size) => String(size.id) === value);

    return (
        <Field label={label} error={error}>
            <select
                value={value}
                disabled={piece === null}
                onChange={(event) => onChange(event.target.value)}
                className={cn(inputClasses, 'disabled:bg-slate-50')}
            >
                <option value="">
                    {piece === null ? placeholder : 'Choose the size…'}
                </option>
                {piece?.sizes.map((size) => (
                    <option key={size.id} value={size.id}>
                        {size.label} —{' '}
                        {left(size) > 0
                            ? `${left(size)} left`
                            : 'out of stock (still to give)'}
                    </option>
                ))}
            </select>
            {chosen && left(chosen) === 0 && (
                <span className="text-xs font-bold text-amber-700">
                    Out of stock: saved as still to give.
                </span>
            )}
        </Field>
    );
}

/**
 * A labelled field. isGroup is for several buttons (a label would press
 * the first one when its text is clicked).
 */
function Field({
    label,
    error,
    isGroup = false,
    children,
}: {
    label: string;
    error?: string;
    isGroup?: boolean;
    children: ReactNode;
}) {
    const Wrapper = isGroup ? 'div' : 'label';

    return (
        <Wrapper className="grid content-start gap-1.5">
            <span className="text-xs font-black tracking-wide text-slate-500 uppercase">
                {label}
            </span>
            {children}
            <InputError message={error} />
        </Wrapper>
    );
}
