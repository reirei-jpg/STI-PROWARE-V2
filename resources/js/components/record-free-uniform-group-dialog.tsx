import { useForm } from '@inertiajs/react';
import { Gift, LoaderCircle, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import FreeUniformController from '@/actions/App/Http/Controllers/FreeUniformController';
import ConfirmDialog from '@/components/confirm-dialog';
import DraftRestoredNotice from '@/components/draft-restored-notice';
import InputError from '@/components/input-error';
import RequiredLabel, { RequiredNote } from '@/components/required-label';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type {
    UniformBottom,
    UniformSetOption,
    UniformSetPiece,
    UniformSizeOption,
    UniformTop,
} from '@/types';
import { useFormDraft } from '@/hooks/use-form-draft';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { confirmLeave } from '@/lib/back-guard';

type StudentInput = {
    key: number;
    name: string;
    enrollment_form_number: string;
    course_section: string;
    uniform_set_id: string;
    top_kind: UniformTop | '';
    top_variant_id: string;
    bottom_kind: UniformBottom | '';
    /** The bottom's size (pants, ladies' pants or skirt). */
    pants_variant_id: string;
};

const BOTTOM_LABELS: Record<UniformBottom, string> = {
    pants: 'Pants',
    ladies_pants: "Ladies' Pants",
    skirt: 'Skirt',
};

/**
 * The bottoms the set has for the top: the pants with the polo; the
 * ladies' pants and / or the skirt with the blouse.
 */
function bottomsFor(
    set: UniformSetOption | undefined,
    top: UniformTop | '',
): UniformBottom[] {
    if (!set || top === '') {
        return [];
    }

    const kinds: UniformBottom[] =
        top === 'polo' ? ['pants'] : ['ladies_pants', 'skirt'];

    return kinds.filter((kind) => set[kind] !== null);
}

/** As on the server (RecordFreeUniformGroupRequest). */
const NAME_PATTERN = /^(?=.*\p{L})[\p{L}\p{M} .'-]+$/u;
const FORM_NUMBER_PATTERN = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;

/** Extra spaces out, as the server tidies it. */
const tidy = (value: string) => value.trim().replace(/\s+/g, ' ');

/**
 * What a box still needs: `wrong` (something typed that is not allowed)
 * shows at once; a missing required box shows once Save is reached for.
 */
type Check = { key: string; message: string; wrong: boolean };

/** Every check of one student card, as the server would refuse it. */
function studentChecks(
    student: StudentInput,
    index: number,
    sets: UniformSetOption[],
    formNumberCounts: Map<string, number>,
): Check[] {
    const checks: Check[] = [];
    const add = (field: string, message: string, wrong = false) =>
        checks.push({ key: `students.${index}.${field}`, message, wrong });
    const name = tidy(student.name);
    const formNumber = tidy(student.enrollment_form_number).toUpperCase();

    if (name === '') {
        add('name', "Enter the student's name.");
    } else if (!NAME_PATTERN.test(name)) {
        add(
            'name',
            "Enter the student's name using letters, e.g. Juan Dela Cruz.",
            true,
        );
    }

    if (formNumber === '') {
        add('enrollment_form_number', "Enter the student's Enrollment Form #.");
    } else if (!FORM_NUMBER_PATTERN.test(formNumber)) {
        add(
            'enrollment_form_number',
            'Use only letters, numbers and hyphens, e.g. 2026-01234.',
            true,
        );
    } else if ((formNumberCounts.get(formNumber) ?? 0) > 1) {
        add(
            'enrollment_form_number',
            'This Enrollment Form # is typed twice in this group.',
            true,
        );
    }

    const set = sets.find(
        (option) => String(option.id) === student.uniform_set_id,
    );

    if (!set) {
        add('uniform_set_id', 'Choose the uniform set, e.g. BSIT.');

        return checks;
    }

    if (student.top_kind === '') {
        add('top_kind', 'Choose Blouse or Polo.');

        return checks;
    }

    if (student.top_variant_id === '') {
        add('top_variant_id', 'Choose the size of the top.');
    }

    const bottoms = bottomsFor(set, student.top_kind);

    if (bottoms.length === 0) {
        add(
            'bottom_kind',
            `The ${set.name} set has no ${student.top_kind === 'polo' ? 'pants' : "ladies' pants or skirt"}. Add them in Uniform sets.`,
            true,
        );
    } else if (student.bottom_kind === '') {
        add('bottom_kind', "Choose Ladies' Pants or Skirt.");
    } else if (student.pants_variant_id === '') {
        add('pants_variant_id', 'Choose the size of the bottom.');
    }

    return checks;
}

type GroupForm = {
    enrolled_on: string;
    note: string;
    students: StudentInput[];
};

const inputClasses =
    'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 aria-invalid:border-red-400 aria-invalid:ring-2 aria-invalid:ring-red-100';

/** A student card's boxes, as named in the list of problems. */
const STUDENT_FIELDS: Record<string, string> = {
    name: 'Name',
    enrollment_form_number: 'Enrollment Form #',
    course_section: 'Course / Section',
    uniform_set_id: 'Set',
    top_kind: 'Top',
    top_variant_id: 'Top size',
    bottom_kind: 'Bottom',
    pants_variant_id: 'Bottom size',
};

/**
 * The Record a group pop-up: the date the students enrolled together, then
 * one card per student (at least the promo's group size): name, Enrollment
 * Form #, course / section, the course's set, Blouse or Polo with its size,
 * and the bottom with its size (the pants with the polo; the ladies' pants
 * or the skirt with the blouse). A size with none left (counting the
 * students above) is still to give: it is saved and given when it arrives.
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
        <Dialog
            open={open}
            onOpenChange={(isOpen) => !isOpen && confirmLeave(onClose)}
        >
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
        bottom_kind: '',
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

    // What was typed is kept until the group is recorded (e.g. the popup
    // was closed or the page left by accident), and leaving asks first.
    const draft = useFormDraft('free-uniform-group', data, (saved) => {
        nextKey.current =
            Math.max(
                groupSize,
                ...saved.students.map((student) => student.key),
            ) + 1;
        setData(saved);
    });
    const unsaved = useUnsavedChanges(form.isDirty && !processing, {
        kept: true,
    });

    /** Clears these server messages, e.g. once their box is changed. */
    const clear = (keys: string[]) =>
        form.clearErrors(...(keys as Parameters<typeof form.clearErrors>));

    const updateStudent = (key: number, changes: Partial<StudentInput>) => {
        const index = data.students.findIndex((student) => student.key === key);
        clear(
            Object.keys(changes).map((field) => `students.${index}.${field}`),
        );
        setData(
            'students',
            data.students.map((student) =>
                student.key === key ? { ...student, ...changes } : student,
            ),
        );
    };

    const addStudent = () => {
        clear(['students']);
        setData('students', [
            ...data.students,
            emptyStudent(nextKey.current++, data.students.at(-1)),
        ]);
    };

    // The cards below move up, so their messages no longer fit: all go.
    const removeStudent = (key: number) => {
        clear(
            Object.keys(form.errors).filter((field) =>
                field.startsWith('students'),
            ),
        );
        setData(
            'students',
            data.students.filter((student) => student.key !== key),
        );
    };

    // The boxes with a problem (the server's or the screen's), top first.
    const problemsIn = (source: Record<string, string | undefined>) =>
        Object.entries(source)
            .filter((entry): entry is [string, string] => Boolean(entry[1]))
            .map(([key, message]) => {
                const [field, index, part] = key.split('.');

                if (field === 'students' && index !== undefined) {
                    return {
                        key,
                        message,
                        order: Number(index) + 1,
                        place: `Student ${Number(index) + 1} · ${STUDENT_FIELDS[part] ?? part}`,
                        anchor: `free-uniform-student-${index}`,
                    };
                }

                return field === 'students'
                    ? {
                          key,
                          message,
                          order: Infinity,
                          place: 'Students',
                          anchor: 'free-uniform-students',
                      }
                    : {
                          key,
                          message,
                          order: 0,
                          place: field === 'note' ? 'Note' : 'Date enrolled',
                          anchor: 'free-uniform-details',
                      };
            })
            .sort((a, b) => a.order - b.order);

    const jumpTo = (anchor: string) =>
        document
            .getElementById(anchor)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // When saving is refused, go to the first card with a problem.
    const jumpToFirstProblem = useRef(false);
    useEffect(() => {
        const first = problemsIn(errors)[0];

        if (jumpToFirstProblem.current && first) {
            jumpToFirstProblem.current = false;
            jumpTo(first.anchor);
        }
    });

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

    // The same checks as the server, so Save works only when all is right.
    const formNumberCounts = new Map<string, number>();

    for (const student of data.students) {
        const formNumber = tidy(student.enrollment_form_number).toUpperCase();

        if (formNumber !== '') {
            formNumberCounts.set(
                formNumber,
                (formNumberCounts.get(formNumber) ?? 0) + 1,
            );
        }
    }

    const checks: Check[] = [
        ...(data.enrolled_on === ''
            ? [
                  {
                      key: 'enrolled_on',
                      message: 'Enter the date they enrolled.',
                      wrong: false,
                  },
              ]
            : data.enrolled_on > today
              ? [
                    {
                        key: 'enrolled_on',
                        message: 'The enrollment date cannot be in the future.',
                        wrong: true,
                    },
                ]
              : []),
        ...data.students.flatMap((student, index) =>
            studentChecks(student, index, sets, formNumberCounts),
        ),
    ];
    // Reaching for the greyed-out Save shows every message.
    const [showAllChecks, setShowAllChecks] = useState(false);
    // A server message first; then what the screen found.
    const shownErrors: Record<string, string | undefined> = { ...errors };

    for (const check of checks) {
        if (!shownErrors[check.key] && (check.wrong || showAllChecks)) {
            shownErrors[check.key] = check.message;
        }
    }

    // The first box still to fill in, to scroll to when Save is reached for.
    const firstOpen = problemsIn(
        Object.fromEntries(checks.map((check) => [check.key, check.message])),
    )[0];
    const showWhatIsNeeded = () => {
        setShowAllChecks(true);

        if (firstOpen) {
            jumpTo(firstOpen.anchor);
        }
    };
    // The boxes still empty or wrong: their "*… required" stays on.
    const openChecks = new Set(checks.map((check) => check.key));
    const canSave = !tooFew && checks.length === 0;
    // Recording gives the pieces at once and a group cannot be taken back,
    // so the Specialist answers first.
    const [confirming, setConfirming] = useState(false);
    const freeToSell = new Map<number, number>();

    for (const option of sets) {
        for (const piece of [
            option.blouse,
            option.polo,
            option.pants,
            option.ladies_pants,
            option.skirt,
        ]) {
            for (const size of piece?.sizes ?? []) {
                freeToSell.set(size.id, size.free_to_sell);
            }
        }
    }

    let pieces = 0;
    let stillToGive = 0;

    for (const [id, count] of Object.entries(taken)) {
        const given = Math.min(count, freeToSell.get(Number(id)) ?? 0);
        pieces += given;
        stillToGive += count - given;
    }

    const students = data.students.length;
    const leaveTheStock =
        pieces === 0
            ? 'No piece leaves the stock now.'
            : `${pieces} ${pieces === 1 ? 'piece leaves' : 'pieces leave'} the stock now, as Free (promo).`;
    const outOfStock =
        stillToGive === 0
            ? ''
            : ` ${stillToGive} ${stillToGive === 1 ? 'piece is' : 'pieces are'} out of stock and saved as pending.`;

    const record = () => {
        setConfirming(false);
        form.transform((current) => ({
            enrolled_on: current.enrolled_on,
            note: current.note,
            students: current.students.map(
                ({ key: _key, ...student }) => student,
            ),
        }));
        form.post(FreeUniformController.store().url, {
            preserveScroll: true,
            onSuccess: (page) => {
                draft.clear(page);
                onClose();
            },
            onError: () => {
                jumpToFirstProblem.current = true;
            },
        });
    };

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();

                // Pressing Enter in a box: say what is still needed instead.
                if (!canSave) {
                    showWhatIsNeeded();

                    return;
                }

                setConfirming(true);
            }}
            className="flex min-h-0 flex-col"
        >
            {unsaved.prompt}
            <ConfirmDialog
                open={confirming}
                title={`Record ${students} ${students === 1 ? 'student' : 'students'} and give their free ${students === 1 ? 'set' : 'sets'}?`}
                description={`${leaveTheStock}${outOfStock} This cannot be undone.`}
                cancelLabel="Check again"
                confirmLabel="Record the group"
                busy={form.processing}
                onConfirm={record}
                onClose={() => setConfirming(false)}
            />
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
                {draft.restored && (
                    <DraftRestoredNotice
                        onDiscard={draft.discard}
                        onDismiss={draft.dismiss}
                    />
                )}
                <RequiredNote saveLabel="Save and give the sets" />
                <div
                    id="free-uniform-details"
                    className="grid scroll-mt-4 gap-4 sm:grid-cols-[14rem_1fr]"
                >
                    <label className="grid gap-1.5">
                        <span className="text-sm font-black text-slate-700">
                            {/* "required" goes once the box is right. */}
                            <RequiredLabel
                                required={openChecks.has('enrolled_on')}
                            >
                                Date enrolled
                            </RequiredLabel>
                        </span>
                        <input
                            type="date"
                            value={data.enrolled_on}
                            max={today}
                            onChange={(event) => {
                                clear(['enrolled_on']);
                                setData('enrolled_on', event.target.value);
                            }}
                            aria-invalid={Boolean(shownErrors.enrolled_on)}
                            className={inputClasses}
                        />
                        <InputError message={shownErrors.enrolled_on} />
                    </label>
                    <label className="grid gap-1.5">
                        <span className="text-sm font-black text-slate-700">
                            Note (optional)
                        </span>
                        <input
                            value={data.note}
                            onChange={(event) => {
                                clear(['note']);
                                setData('note', event.target.value);
                            }}
                            aria-invalid={Boolean(errors.note)}
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
                        errors={shownErrors}
                        openChecks={openChecks}
                        index={index}
                        canRemove={data.students.length > 1}
                        onChange={(changes) =>
                            updateStudent(student.key, changes)
                        }
                        onRemove={() => removeStudent(student.key)}
                    />
                ))}

                <button
                    id="free-uniform-students"
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
                    {!tooFew && checks.length > 0 && (
                        <span className="block text-xs font-bold text-amber-700">
                            Save works once{' '}
                            {checks.length === 1
                                ? '1 field is'
                                : `${checks.length} fields are`}{' '}
                            filled in correctly.
                        </span>
                    )}
                </p>
                <div className="flex justify-end gap-3">
                    {/* Cancel throws what was typed away (asks first); an
                        accidental close keeps it as a draft. */}
                    <button
                        type="button"
                        onClick={() =>
                            unsaved.confirmDiscard(() => {
                                draft.discard();
                                onClose();
                            })
                        }
                        className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                    >
                        Cancel
                    </button>
                    {/* Reaching for the greyed-out Save shows every message
                        and the list of what is still needed. */}
                    <span
                        className={cn(
                            'inline-flex',
                            !canSave && 'cursor-not-allowed',
                        )}
                        onMouseEnter={() => !canSave && setShowAllChecks(true)}
                        // Clicking it goes to the first box still to fill in.
                        onClick={() => !canSave && showWhatIsNeeded()}
                    >
                        <button
                            type="submit"
                            disabled={processing || !canSave}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-60"
                            data-test="save-free-uniform-group"
                        >
                            {processing ? (
                                <LoaderCircle
                                    size={17}
                                    className="animate-spin"
                                />
                            ) : (
                                <Gift size={17} />
                            )}
                            Save and give the sets
                        </button>
                    </span>
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
    openChecks,
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
    /** The boxes of the form still empty or wrong. */
    openChecks: Set<string>;
    index: number;
    canRemove: boolean;
    onChange: (changes: Partial<StudentInput>) => void;
    onRemove: () => void;
}) {
    /** "*… required" shows while the box is empty or wrong, and goes once it is right. */
    const needs = (field: keyof StudentInput) =>
        student[field] === '' || openChecks.has(`students.${index}.${field}`);
    const set = sets.find(
        (option) => String(option.id) === student.uniform_set_id,
    );
    const tops = set
        ? (['blouse', 'polo'] as const).filter((kind) => set[kind] !== null)
        : [];
    const top = set && student.top_kind !== '' ? set[student.top_kind] : null;
    const bottoms = bottomsFor(set, student.top_kind);
    const bottom =
        set && student.bottom_kind !== '' ? set[student.bottom_kind] : null;
    const error = (field: string) => errors[`students.${index}.${field}`];

    /** Choosing the top also chooses the bottom when only one goes with it. */
    const chooseTop = (kind: UniformTop) => {
        const fits = bottomsFor(set, kind);

        onChange({
            top_kind: kind,
            top_variant_id: '',
            bottom_kind: fits.length === 1 ? fits[0] : '',
            pants_variant_id: '',
        });
    };

    return (
        <section
            id={`free-uniform-student-${index}`}
            className="scroll-mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
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
                <Field
                    label="Name"
                    error={error('name')}
                    required={needs('name')}
                >
                    <input
                        value={student.name}
                        onChange={(event) =>
                            onChange({ name: event.target.value })
                        }
                        maxLength={120}
                        placeholder="e.g. Juan Dela Cruz"
                        aria-invalid={Boolean(error('name'))}
                        className={inputClasses}
                    />
                </Field>
                <Field
                    label="Enrollment Form #"
                    error={error('enrollment_form_number')}
                    required={needs('enrollment_form_number')}
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
                        aria-invalid={Boolean(error('enrollment_form_number'))}
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
                        aria-invalid={Boolean(error('course_section'))}
                        className={inputClasses}
                    />
                </Field>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-[10rem_12rem_1fr_1fr]">
                <Field
                    label="Set"
                    error={error('uniform_set_id')}
                    required={needs('uniform_set_id')}
                >
                    <select
                        value={student.uniform_set_id}
                        onChange={(event) =>
                            onChange({
                                uniform_set_id: event.target.value,
                                top_kind: '',
                                top_variant_id: '',
                                bottom_kind: '',
                                pants_variant_id: '',
                            })
                        }
                        aria-invalid={Boolean(error('uniform_set_id'))}
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
                <Field
                    label="Top"
                    error={error('top_kind')}
                    isGroup
                    required={needs('top_kind')}
                >
                    <div className="grid grid-cols-2 gap-1.5">
                        {(['blouse', 'polo'] as const).map((kind) => (
                            <button
                                key={kind}
                                type="button"
                                disabled={!tops.includes(kind)}
                                onClick={() => chooseTop(kind)}
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
                    required={needs('top_variant_id')}
                    onChange={(id) => onChange({ top_variant_id: id })}
                />
                <div className="grid content-start gap-3">
                    {student.top_kind === 'blouse' && bottoms.length > 1 && (
                        <Field
                            label="Bottom"
                            error={error('bottom_kind')}
                            isGroup
                            required={needs('bottom_kind')}
                        >
                            <div className="grid grid-cols-2 gap-1.5">
                                {bottoms.map((kind) => (
                                    <button
                                        key={kind}
                                        type="button"
                                        onClick={() =>
                                            onChange({
                                                bottom_kind: kind,
                                                pants_variant_id: '',
                                            })
                                        }
                                        aria-pressed={
                                            student.bottom_kind === kind
                                        }
                                        className={cn(
                                            'h-11 rounded-xl text-sm font-black transition',
                                            student.bottom_kind === kind
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                                        )}
                                    >
                                        {BOTTOM_LABELS[kind]}
                                    </button>
                                ))}
                            </div>
                        </Field>
                    )}
                    <SizeField
                        label={
                            student.bottom_kind === ''
                                ? 'Bottom size'
                                : `${BOTTOM_LABELS[student.bottom_kind]} size`
                        }
                        piece={bottom}
                        value={student.pants_variant_id}
                        takenBefore={takenBefore}
                        placeholder={
                            !set
                                ? 'Choose the set first'
                                : student.top_kind === ''
                                  ? 'Choose Blouse or Polo first'
                                  : bottoms.length === 0
                                    ? `The ${set.name} set has no ${student.top_kind === 'polo' ? 'pants' : "ladies' pants or skirt"}`
                                    : "Choose Ladies' Pants or Skirt first"
                        }
                        error={
                            error('pants_variant_id') ??
                            (bottoms.length > 1
                                ? undefined
                                : error('bottom_kind'))
                        }
                        required={needs('pants_variant_id')}
                        onChange={(id) => onChange({ pants_variant_id: id })}
                    />
                </div>
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
    required,
    onChange,
}: {
    label: string;
    piece: UniformSetPiece | null;
    value: string;
    takenBefore: Record<number, number>;
    placeholder: string;
    error?: string;
    /** While no size is chosen. */
    required: boolean;
    onChange: (id: string) => void;
}) {
    const left = (size: UniformSizeOption) =>
        Math.max(0, size.free_to_sell - (takenBefore[size.id] ?? 0));
    const chosen = piece?.sizes.find((size) => String(size.id) === value);

    return (
        <Field label={label} error={error} required={required}>
            <select
                value={value}
                disabled={piece === null}
                onChange={(event) => onChange(event.target.value)}
                aria-invalid={Boolean(error)}
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
                            : 'out of stock (pending)'}
                    </option>
                ))}
            </select>
            {chosen && left(chosen) === 0 && (
                <span className="text-xs font-bold text-amber-700">
                    Out of stock: saved as pending.
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
    required = false,
    children,
}: {
    label: string;
    error?: string;
    isGroup?: boolean;
    /** Shown as "*Name required". */
    required?: boolean;
    children: ReactNode;
}) {
    const Wrapper = isGroup ? 'div' : 'label';

    return (
        <Wrapper className="grid content-start gap-1.5">
            <span className="text-xs font-black tracking-wide text-slate-500 uppercase">
                <RequiredLabel required={required}>{label}</RequiredLabel>
            </span>
            {children}
            <InputError message={error} />
        </Wrapper>
    );
}
