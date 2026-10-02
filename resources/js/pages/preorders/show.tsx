import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Users } from 'lucide-react';
import { useState } from 'react';
import PreorderController from '@/actions/App/Http/Controllers/PreorderController';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import Panel, { TableHeading } from '@/components/panel';
import PreorderCloseDateDialog from '@/components/preorder-close-date-dialog';
import { CloseDate, VariantCounts } from '@/components/preorder-counts';
import SummaryCard from '@/components/summary-card';
import { formatDateTime } from '@/lib/format';
import { formatUnits } from '@/lib/units';
import type { Paginated, PreorderProductSummary, PreorderRow } from '@/types';

/**
 * Who preordered one product: each student, the size or color, and how
 * many, newest first.
 */
export default function PreorderShow({
    product,
    preorders,
    today,
}: {
    product: PreorderProductSummary;
    preorders: Paginated<PreorderRow>;
    today: string;
}) {
    const [changing, setChanging] = useState(false);

    return (
        <>
            <Head title={`Preorders · ${product.name}`} />

            <div className="space-y-7">
                <PageHeader
                    title={product.name}
                    description="Every student who preordered it. Cancelled preorders are not listed."
                    actions={
                        <Link
                            href={PreorderController.index()}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                            <ArrowLeft size={18} />
                            Back to Preorders
                        </Link>
                    }
                />

                <section className="grid gap-5 md:grid-cols-3">
                    <SummaryCard
                        label="No. of Students"
                        value={product.students_count.toLocaleString('en-PH')}
                        description="Students with a preorder for it."
                        icon={Users}
                    />
                    <SummaryCard
                        label="Total Pieces"
                        value={formatUnits(product.pieces_total, 'Piece')}
                        description="How many they reserved in all."
                        icon={Users}
                    />
                    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-sm font-bold text-slate-600">
                            Preorders Close
                        </p>
                        <div className="mt-2">
                            <CloseDate
                                product={product}
                                onChange={() => setChanging(true)}
                            />
                        </div>
                    </article>
                </section>

                <Panel title="Per Size / Color">
                    <div className="px-6 py-5 text-sm">
                        <VariantCounts product={product} />
                    </div>
                </Panel>

                <Panel title="Students" description="Newest first.">
                    {preorders.data.length === 0 ? (
                        <p className="px-6 py-12 text-center text-sm text-slate-500">
                            No student has preordered it yet.
                        </p>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-175">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <TableHeading>Student</TableHeading>
                                            <TableHeading>
                                                Size / Color
                                            </TableHeading>
                                            <TableHeading align="right">
                                                How Many
                                            </TableHeading>
                                            <TableHeading>
                                                Preordered On
                                            </TableHeading>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preorders.data.map((preorder) => (
                                            <tr
                                                key={preorder.id}
                                                className="border-t border-slate-100 text-sm"
                                            >
                                                <td className="px-5 py-4">
                                                    <p className="font-black text-slate-900">
                                                        {preorder.student_name}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {preorder.student_email}
                                                    </p>
                                                </td>
                                                <td className="px-5 py-4 text-slate-700">
                                                    {preorder.variant_label ??
                                                        '—'}
                                                </td>
                                                <td className="px-5 py-4 text-right font-black text-slate-900">
                                                    {formatUnits(
                                                        preorder.quantity,
                                                        'Piece',
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 text-slate-600">
                                                    {formatDateTime(
                                                        preorder.created_at,
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <Pagination
                                pagination={preorders}
                                itemName="preorders"
                            />
                        </>
                    )}
                </Panel>
            </div>

            <PreorderCloseDateDialog
                product={changing ? product : null}
                today={today}
                onClose={() => setChanging(false)}
            />
        </>
    );
}
