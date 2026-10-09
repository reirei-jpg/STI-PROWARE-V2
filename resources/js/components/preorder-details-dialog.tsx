import { Link } from '@inertiajs/react';
import {
    CalendarClock,
    Download,
    ImageIcon,
    LoaderCircle,
    Users,
    X,
} from 'lucide-react';
import PreorderController from '@/actions/App/Http/Controllers/PreorderController';
import { TableHeading } from '@/components/panel';
import PreorderStageBadge, {
    PreorderWhen,
} from '@/components/preorder-stage-badge';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDateTime } from '@/lib/format';
import { formatUnits } from '@/lib/units';
import type { PreorderDetails } from '@/types';

/**
 * One Preorder product, opened with View Details: what to order in the
 * eStore (pieces per size or color, with the eStore item codes) or what
 * arrived, the students who preordered (newest first; the full list has
 * its own page), Change date / Reopen while it is on Preorder, and a CSV of
 * this product.
 */
export default function PreorderDetailsDialog({
    open,
    details,
    today,
    onClose,
    onChangeDate,
}: {
    open: boolean;
    /** Undefined while it loads. */
    details: PreorderDetails | null | undefined;
    today: string;
    onClose: () => void;
    onChangeDate: (product: PreorderDetails) => void;
}) {
    const arrived = details?.stage === 'arrived';
    const counted = details?.variants ?? [];
    const oneSize = counted.length === 1 && counted[0].label === null;

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-3xl [&>button:last-child]:hidden">
                {!details ? (
                    <div className="flex flex-col items-center gap-3 px-6 py-16 text-sm font-bold text-slate-500">
                        <DialogTitle className="sr-only">
                            Preorder details
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            Loading
                        </DialogDescription>
                        {details === null ? (
                            'This product was not found.'
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
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-300">
                                    {details.photo_url ? (
                                        <img
                                            src={details.photo_url}
                                            alt=""
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <ImageIcon size={22} />
                                    )}
                                </div>
                                <div>
                                    <DialogTitle className="flex flex-wrap items-center gap-2 text-lg font-black text-slate-900">
                                        {details.name}
                                        <PreorderStageBadge
                                            stage={details.stage}
                                        />
                                    </DialogTitle>
                                    <DialogDescription asChild>
                                        <div className="mt-0.5 text-sm">
                                            <PreorderWhen
                                                product={details}
                                                today={today}
                                            />
                                        </div>
                                    </DialogDescription>
                                </div>
                            </div>
                            <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                                <X size={20} />
                                <span className="sr-only">Close</span>
                            </DialogClose>
                        </div>

                        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
                            <section>
                                <h3 className="text-xs font-black tracking-wide text-slate-400 uppercase">
                                    {arrived
                                        ? 'What arrived for them'
                                        : details.stage === 'to_order'
                                          ? 'What to order in the eStore'
                                          : 'Preordered so far'}
                                </h3>
                                <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <TableHeading>
                                                    Size / Color
                                                </TableHeading>
                                                <TableHeading>
                                                    eStore Item Code
                                                </TableHeading>
                                                <TableHeading align="right">
                                                    Students
                                                </TableHeading>
                                                <TableHeading align="right">
                                                    Pieces
                                                </TableHeading>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {counted.map((variant) => (
                                                <tr
                                                    key={variant.id}
                                                    className="border-t border-slate-100"
                                                >
                                                    <td className="px-5 py-2.5 font-bold text-slate-800">
                                                        {oneSize
                                                            ? 'One size'
                                                            : variant.label}
                                                    </td>
                                                    <td className="px-5 py-2.5 font-mono text-xs text-slate-600">
                                                        {variant.estore_item_code ??
                                                            '—'}
                                                    </td>
                                                    <td className="px-5 py-2.5 text-right text-slate-700">
                                                        {variant.students}
                                                    </td>
                                                    <td
                                                        className={`px-5 py-2.5 text-right font-black ${variant.pieces > 0 ? 'text-slate-900' : 'text-slate-300'}`}
                                                    >
                                                        {formatUnits(
                                                            variant.pieces,
                                                            'Piece',
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="border-t-2 border-slate-200 bg-slate-50">
                                                <td
                                                    colSpan={2}
                                                    className="px-5 py-3 text-sm font-black text-slate-700"
                                                >
                                                    Total
                                                </td>
                                                <td className="px-5 py-3 text-right font-black text-slate-900">
                                                    {details.students_count}
                                                </td>
                                                <td className="px-5 py-3 text-right text-base font-black text-amber-700">
                                                    {formatUnits(
                                                        details.pieces_total,
                                                        'Piece',
                                                    )}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </section>

                            <section>
                                <h3 className="flex items-center justify-between gap-2 text-xs font-black tracking-wide text-slate-400 uppercase">
                                    Who preordered ({details.preorders_count})
                                    {details.preorders_count >
                                        details.preorders.length && (
                                        <Link
                                            href={PreorderController.show(
                                                details.id,
                                            )}
                                            className="text-xs font-black text-blue-700 normal-case hover:underline"
                                        >
                                            See all {details.preorders_count}
                                        </Link>
                                    )}
                                </h3>
                                {details.preorders.length === 0 ? (
                                    <p className="mt-2 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                                        No student has preordered it yet.
                                    </p>
                                ) : (
                                    <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200">
                                        {details.preorders.map((preorder) => (
                                            <li
                                                key={preorder.id}
                                                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate font-bold text-slate-900">
                                                        {preorder.student_name}
                                                    </p>
                                                    <p className="truncate text-xs text-slate-500">
                                                        {preorder.student_email}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-black text-slate-900">
                                                        {preorder.variant_label &&
                                                            `${preorder.variant_label} · `}
                                                        {formatUnits(
                                                            preorder.quantity,
                                                            'Piece',
                                                        )}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {formatDateTime(
                                                            preorder.created_at,
                                                        )}
                                                    </p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-6 py-4">
                            <div className="flex flex-wrap gap-2">
                                {details.status === 'preorder' && (
                                    <button
                                        type="button"
                                        onClick={() => onChangeDate(details)}
                                        className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-black text-blue-700 transition hover:bg-blue-100"
                                    >
                                        <CalendarClock size={16} />
                                        {details.accepts_preorders
                                            ? 'Change close date'
                                            : 'Reopen / change date'}
                                    </button>
                                )}
                                {!arrived && (
                                    <a
                                        href={
                                            PreorderController.export({
                                                query: { product: details.id },
                                            }).url
                                        }
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                                    >
                                        <Download size={16} />
                                        CSV of this product
                                    </a>
                                )}
                                <Link
                                    href={PreorderController.show(details.id)}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                                >
                                    <Users size={16} />
                                    Full list
                                </Link>
                            </div>
                            <DialogClose className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                                Close
                            </DialogClose>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
