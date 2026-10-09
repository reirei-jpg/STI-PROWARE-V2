import { router, useForm } from '@inertiajs/react';
import { CheckCircle2, Gift, Hourglass, LoaderCircle, X } from 'lucide-react';
import FreeUniformController from '@/actions/App/Http/Controllers/FreeUniformController';
import InputError from '@/components/input-error';
import { TableHeading } from '@/components/panel';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDateOrdered, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { FreeUniformGroupDetails, FreeUniformPiece } from '@/types';

type Student = FreeUniformGroupDetails['students'][number];

/**
 * One group, opened with View Details: when they enrolled and who recorded
 * it, then each student with their Enrollment Form #, set and sizes, and
 * whether each piece was given. A piece still to give can be given here
 * once it arrives, in another size if the student agrees.
 */
export default function FreeUniformGroupDialog({
    open,
    details,
    onClose,
}: {
    open: boolean;
    /** Undefined while it loads. */
    details: FreeUniformGroupDetails | null | undefined;
    onClose: () => void;
}) {
    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-5xl [&>button:last-child]:hidden">
                {!details ? (
                    <div className="flex flex-col items-center gap-3 px-6 py-16 text-sm font-bold text-slate-500">
                        <DialogTitle className="sr-only">
                            Group details
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            Loading
                        </DialogDescription>
                        {details === null ? (
                            'This group was not found.'
                        ) : (
                            <>
                                <LoaderCircle
                                    size={28}
                                    className="animate-spin text-blue-600"
                                />
                                Loading…
                            </>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                            <div className="flex items-start gap-3">
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                                    <Gift size={22} />
                                </span>
                                <div>
                                    <DialogTitle className="text-lg font-black text-slate-900">
                                        Group #{details.id} · enrolled{' '}
                                        {formatDateOrdered(details.enrolled_on)}
                                    </DialogTitle>
                                    <DialogDescription className="text-sm text-slate-500">
                                        {details.students.length} students ·
                                        recorded by {details.recorded_by} ·{' '}
                                        {formatDateTime(details.recorded_at)}
                                    </DialogDescription>
                                </div>
                            </div>
                            <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                                <X size={20} />
                                <span className="sr-only">Close</span>
                            </DialogClose>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto">
                            {details.note && (
                                <p className="border-b border-slate-100 px-6 py-3 text-sm text-slate-600">
                                    Note: {details.note}
                                </p>
                            )}
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <TableHeading>Student</TableHeading>
                                            <TableHeading>Set</TableHeading>
                                            <TableHeading>Top</TableHeading>
                                            <TableHeading>Pants</TableHeading>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {details.students.map((student) => (
                                            <StudentRow
                                                key={student.id}
                                                groupId={details.id}
                                                student={student}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

function StudentRow({
    groupId,
    student,
}: {
    groupId: number;
    student: Student;
}) {
    const owed = !student.top.given || !student.pants.given;

    return (
        <>
            <tr className="border-t border-slate-100 align-top text-sm">
                <td className="px-5 py-4">
                    <p className="font-black text-slate-900">{student.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                        Form #{student.enrollment_form_number}
                        {student.course_section &&
                            ` · ${student.course_section}`}
                    </p>
                </td>
                <td className="px-5 py-4 font-bold text-slate-700">
                    1 {student.set_name} set
                </td>
                <td className="px-5 py-4">
                    <PieceStatus piece={student.top} />
                </td>
                <td className="px-5 py-4">
                    <PieceStatus piece={student.pants} />
                </td>
            </tr>
            {owed && (
                <tr className="bg-amber-50/50">
                    <td colSpan={4} className="px-5 pb-4">
                        <GiveRest groupId={groupId} student={student} />
                    </td>
                </tr>
            )}
        </>
    );
}

/** "Polo M" with Given, or Still to give. */
function PieceStatus({ piece }: { piece: FreeUniformPiece }) {
    return (
        <div>
            <p className="font-bold text-slate-800">
                {piece.name} {piece.size}
            </p>
            <p
                className={cn(
                    'mt-0.5 inline-flex items-center gap-1 text-xs font-black',
                    piece.given ? 'text-emerald-700' : 'text-amber-700',
                )}
            >
                {piece.given ? (
                    <CheckCircle2 size={13} />
                ) : (
                    <Hourglass size={13} />
                )}
                {piece.given ? 'Given' : 'Still to give'}
            </p>
        </div>
    );
}

/**
 * Give the pieces still to give: each in the size recorded, or another
 * size of the same top or pants that is in stock.
 */
function GiveRest({ groupId, student }: { groupId: number; student: Student }) {
    const form = useForm({
        top_variant_id: student.top.given ? '' : String(student.top.variant_id),
        pants_variant_id: student.pants.given
            ? ''
            : String(student.pants.variant_id),
    });
    const errors = form.errors as Record<string, string | undefined>;

    const sizeSelect = (
        piece: FreeUniformPiece,
        field: 'top_variant_id' | 'pants_variant_id',
    ) =>
        !piece.given && (
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                {piece.name}
                <select
                    value={form.data[field]}
                    onChange={(event) =>
                        form.setData(field, event.target.value)
                    }
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                    {piece.sizes.map((size) => (
                        <option key={size.id} value={size.id}>
                            {size.label} —{' '}
                            {size.free_to_sell > 0
                                ? `${size.free_to_sell} left`
                                : 'out of stock'}
                        </option>
                    ))}
                </select>
            </label>
        );

    return (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-black text-amber-800">
                    Arrived? Give it now:
                </span>
                {sizeSelect(student.top, 'top_variant_id')}
                {sizeSelect(student.pants, 'pants_variant_id')}
                <button
                    type="button"
                    disabled={form.processing}
                    onClick={() =>
                        form.post(
                            FreeUniformController.giveRest(student.id).url,
                            {
                                preserveScroll: true,
                                onSuccess: () =>
                                    router.reload({
                                        data: { details: groupId },
                                        only: ['details'],
                                    }),
                            },
                        )
                    }
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0D6EFD] px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {form.processing ? (
                        <LoaderCircle size={15} className="animate-spin" />
                    ) : (
                        <Gift size={15} />
                    )}
                    Give now
                </button>
            </div>
            <InputError
                message={
                    errors.pieces ??
                    errors.top_variant_id ??
                    errors.pants_variant_id
                }
            />
        </div>
    );
}
