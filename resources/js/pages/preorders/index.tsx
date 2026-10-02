import { Head, Link, router } from '@inertiajs/react';
import {
    CalendarClock,
    Download,
    ImageIcon,
    Search,
    Users,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import PreorderController from '@/actions/App/Http/Controllers/PreorderController';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import Panel, { TableHeading } from '@/components/panel';
import PreorderCloseDateDialog from '@/components/preorder-close-date-dialog';
import type { CloseDateTarget } from '@/components/preorder-close-date-dialog';
import { CloseDate, VariantCounts } from '@/components/preorder-counts';
import SummaryCard from '@/components/summary-card';
import { formatUnits } from '@/lib/units';
import type { Paginated, PreorderProductSummary } from '@/types';

/**
 * The Specialist's Preorders page: per Preorder product and size or color,
 * how many students preordered and how many pieces, so she knows how many to
 * order in the eStore. She can move the close date and export the summary
 * as a CSV file for Excel.
 */
export default function PreordersIndex({
    products,
    filters,
    totals,
    today,
}: {
    products: Paginated<PreorderProductSummary>;
    filters: { search: string | null };
    totals: { students: number; pieces: number };
    today: string;
}) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [changing, setChanging] = useState<CloseDateTarget | null>(null);
    const firstRender = useRef(true);

    // Search as the Specialist types, after a short pause.
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;

            return;
        }

        const timer = window.setTimeout(
            () =>
                router.get(
                    PreorderController.index().url,
                    search.trim() === '' ? {} : { search: search.trim() },
                    {
                        preserveState: true,
                        preserveScroll: true,
                        replace: true,
                    },
                ),
            400,
        );

        return () => window.clearTimeout(timer);
    }, [search]);

    return (
        <>
            <Head title="Preorders" />

            <div className="space-y-7">
                <PageHeader
                    title="Preorders"
                    description="How many students reserved each Preorder product, per size or color. Use it to know how many to order in the eStore. Cancelled preorders are not counted."
                    actions={
                        <a
                            href={PreorderController.export().url}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
                        >
                            <Download size={18} />
                            Export for Excel (CSV)
                        </a>
                    }
                />

                <section className="grid gap-5 md:grid-cols-2">
                    <SummaryCard
                        label="Students with preorders"
                        value={totals.students.toLocaleString('en-PH')}
                        description="Across all products, not counting cancelled preorders."
                        icon={Users}
                    />
                    <SummaryCard
                        label="Pieces preordered"
                        value={formatUnits(totals.pieces, 'Piece')}
                        description="The total students reserved."
                        icon={CalendarClock}
                    />
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 lg:max-w-sm">
                        <Search size={18} className="shrink-0" />
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search by product name"
                            className="w-full min-w-0 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                            aria-label="Search by product name"
                        />
                    </label>
                </section>

                <Panel
                    title="Preorder Products"
                    description="Closing soonest first."
                >
                    {products.data.length === 0 ? (
                        <div className="px-6 py-16 text-center">
                            <CalendarClock
                                size={44}
                                className="mx-auto text-slate-300"
                            />
                            <h3 className="mt-4 text-lg font-black text-slate-800">
                                {filters.search
                                    ? 'No product matches your search'
                                    : 'No Preorder products yet'}
                            </h3>
                            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                                Set a product to Preorder (with a close date) on
                                its Edit Product page. It shows under Coming
                                Soon, and students can preorder it.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-250">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <TableHeading>Product</TableHeading>
                                            <TableHeading>
                                                Preorders Close
                                            </TableHeading>
                                            <TableHeading>
                                                Per Size / Color
                                            </TableHeading>
                                            <TableHeading align="right">
                                                No. of Students
                                            </TableHeading>
                                            <TableHeading align="right">
                                                Total Pieces
                                            </TableHeading>
                                            <TableHeading align="right">
                                                Actions
                                            </TableHeading>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {products.data.map((product) => (
                                            <tr
                                                key={product.id}
                                                className="border-t border-slate-100 align-top text-sm"
                                            >
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-300">
                                                            {product.photo_url ? (
                                                                <img
                                                                    src={
                                                                        product.photo_url
                                                                    }
                                                                    alt=""
                                                                    className="h-full w-full object-cover"
                                                                />
                                                            ) : (
                                                                <ImageIcon
                                                                    size={20}
                                                                />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-slate-900">
                                                                {product.name}
                                                            </p>
                                                            <p className="text-xs text-slate-500">
                                                                {
                                                                    product.status_label
                                                                }
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <CloseDate
                                                        product={product}
                                                        onChange={() =>
                                                            setChanging(product)
                                                        }
                                                    />
                                                </td>
                                                <td className="px-5 py-4">
                                                    <VariantCounts
                                                        product={product}
                                                    />
                                                </td>
                                                <td className="px-5 py-4 text-right text-base font-black text-slate-900">
                                                    {product.students_count.toLocaleString(
                                                        'en-PH',
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 text-right text-base font-black text-amber-700">
                                                    {formatUnits(
                                                        product.pieces_total,
                                                        'Piece',
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <Link
                                                        href={PreorderController.show(
                                                            product.id,
                                                        )}
                                                        className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-100"
                                                    >
                                                        <Users size={15} />
                                                        Who preordered
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <Pagination
                                pagination={products}
                                itemName="products"
                            />
                        </>
                    )}
                </Panel>
            </div>

            <PreorderCloseDateDialog
                product={changing}
                today={today}
                onClose={() => setChanging(null)}
            />
        </>
    );
}
