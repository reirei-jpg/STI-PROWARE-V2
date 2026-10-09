import { Head, router } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    CalendarClock,
    Download,
    Eye,
    ImageIcon,
    PackageCheck,
    Search,
    ShoppingCart,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import PreorderController from '@/actions/App/Http/Controllers/PreorderController';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import Panel, { TableHeading } from '@/components/panel';
import PreorderCloseDateDialog from '@/components/preorder-close-date-dialog';
import type { CloseDateTarget } from '@/components/preorder-close-date-dialog';
import PreorderDetailsDialog from '@/components/preorder-details-dialog';
import PreorderStageBadge, {
    PreorderWhen,
} from '@/components/preorder-stage-badge';
import { formatUnits } from '@/lib/units';
import { cn } from '@/lib/utils';
import type {
    Paginated,
    PreorderDetails,
    PreorderProductSummary,
    PreorderStage,
    PreorderStageNumbers,
} from '@/types';

type Stage = 'all' | PreorderStage;

const tabs: { value: Stage; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'to_order', label: 'To order' },
    { value: 'open', label: 'Taking preorders' },
    { value: 'arrived', label: 'Arrived' },
];

const descriptions: Record<Stage, string> = {
    all: 'To order first, then those taking preorders (closing soonest), then arrived.',
    to_order:
        'Preorders closed. Order these pieces in the eStore, then set the product to Available when they arrive.',
    open: 'Students can still preorder these. Closing soonest first.',
    arrived:
        'For sale now. The students who preordered were told; nothing is held for them.',
};

/**
 * The Specialist's Preorders page. Each Preorder product goes from Taking
 * preorders to To order in eStore (preorders closed) to Arrived (for sale,
 * the students were told). Three cards say how many are in each stage and
 * filter the table; each row shows the stage, the date that matters, the
 * pieces per size, and View Details (what to order, who preordered, change
 * the date). Export downloads what is still to order for Excel.
 */
export default function PreordersIndex({
    products,
    filters,
    summary,
    details,
    today,
}: {
    products: Paginated<PreorderProductSummary>;
    filters: { search: string | null; stage: Stage };
    summary: Record<PreorderStage, PreorderStageNumbers>;
    details?: PreorderDetails | null;
    today: string;
}) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [viewingId, setViewingId] = useState<number | null>(null);
    const [changing, setChanging] = useState<CloseDateTarget | null>(null);
    const firstRender = useRef(true);

    const showList = (stage: Stage, term: string) =>
        router.get(
            PreorderController.index().url,
            {
                ...(stage === 'all' ? {} : { stage }),
                ...(term.trim() === '' ? {} : { search: term.trim() }),
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );

    // Search as the Specialist types, after a short pause.
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;

            return;
        }

        const timer = window.setTimeout(
            () => showList(filters.stage, search),
            400,
        );

        return () => window.clearTimeout(timer);
        // Only the typed search starts a new search.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    // The popup opens at once and fills in when its details arrive.
    const openDetails = (product: PreorderProductSummary) => {
        setViewingId(product.id);
        router.reload({ data: { details: product.id }, only: ['details'] });
    };

    return (
        <>
            <Head title="Preorders" />

            <div className="space-y-6">
                <PageHeader
                    title="Preorders"
                    description="Students reserve Preorder products; when preorders close, order that many in the eStore; when they arrive, set the product to Available and the students are told."
                    actions={
                        <a
                            href={PreorderController.export().url}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
                        >
                            <Download size={18} />
                            Export what to order (CSV)
                        </a>
                    }
                />

                <section className="grid gap-4 md:grid-cols-3">
                    <StageCard
                        stage="to_order"
                        current={filters.stage}
                        icon={ShoppingCart}
                        tone="amber"
                        title="To order in eStore"
                        value={formatUnits(summary.to_order.pieces, 'Piece')}
                        detail={`${summary.to_order.products} ${summary.to_order.products === 1 ? 'product' : 'products'} closed · ${summary.to_order.students} ${summary.to_order.students === 1 ? 'student' : 'students'}`}
                        onClick={() => showList('to_order', search)}
                    />
                    <StageCard
                        stage="open"
                        current={filters.stage}
                        icon={CalendarClock}
                        tone="blue"
                        title="Taking preorders"
                        value={`${summary.open.products} ${summary.open.products === 1 ? 'product' : 'products'}`}
                        detail={`${formatUnits(summary.open.pieces, 'Piece')} preordered so far · ${summary.open.students} ${summary.open.students === 1 ? 'student' : 'students'}`}
                        onClick={() => showList('open', search)}
                    />
                    <StageCard
                        stage="arrived"
                        current={filters.stage}
                        icon={PackageCheck}
                        tone="green"
                        title="Arrived"
                        value={`${summary.arrived.students} ${summary.arrived.students === 1 ? 'student' : 'students'} told`}
                        detail={`${summary.arrived.products} ${summary.arrived.products === 1 ? 'product' : 'products'} · ${formatUnits(summary.arrived.pieces, 'Piece')}`}
                        onClick={() => showList('arrived', search)}
                    />
                </section>

                <Panel>
                    <div className="space-y-4 border-b border-slate-100 px-6 py-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <h2 className="font-black text-slate-900">
                                    {filters.stage === 'all'
                                        ? 'Preorder Products'
                                        : tabs.find(
                                              (tab) =>
                                                  tab.value === filters.stage,
                                          )?.label}
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    {descriptions[filters.stage]}
                                </p>
                            </div>
                            <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 lg:max-w-sm">
                                <Search size={18} className="shrink-0" />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Search by product name"
                                    className="w-full min-w-0 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                                    aria-label="Search by product name"
                                />
                            </label>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.value}
                                    type="button"
                                    onClick={() => showList(tab.value, search)}
                                    className={cn(
                                        'inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition',
                                        filters.stage === tab.value
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                                    )}
                                >
                                    {tab.label}
                                    {tab.value !== 'all' && (
                                        <span
                                            className={cn(
                                                'rounded-full px-1.5 text-[11px] font-black',
                                                filters.stage === tab.value
                                                    ? 'bg-white/25'
                                                    : 'bg-white',
                                            )}
                                        >
                                            {summary[tab.value].products}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {products.data.length === 0 ? (
                        <div className="px-6 py-16 text-center">
                            <CalendarClock
                                size={44}
                                className="mx-auto text-slate-300"
                            />
                            <h3 className="mt-4 text-lg font-black text-slate-800">
                                {filters.search
                                    ? 'No product matches your search'
                                    : 'Nothing here'}
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
                                <table className="w-full min-w-225">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <TableHeading>Product</TableHeading>
                                            <TableHeading>Stage</TableHeading>
                                            <TableHeading>Date</TableHeading>
                                            <TableHeading>
                                                Per Size / Color
                                            </TableHeading>
                                            <TableHeading align="right">
                                                Students
                                            </TableHeading>
                                            <TableHeading align="right">
                                                Pieces
                                            </TableHeading>
                                            <TableHeading align="right">
                                                Actions
                                            </TableHeading>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {products.data.map((product) => (
                                            <PreorderTableRow
                                                key={product.id}
                                                product={product}
                                                today={today}
                                                onView={() =>
                                                    openDetails(product)
                                                }
                                            />
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

            <PreorderDetailsDialog
                open={viewingId !== null}
                // Another product's details (from before) count as loading.
                details={
                    details === null || details?.id === viewingId
                        ? details
                        : undefined
                }
                today={today}
                onClose={() => setViewingId(null)}
                onChangeDate={(product) => {
                    setViewingId(null);
                    setChanging(product);
                }}
            />

            <PreorderCloseDateDialog
                product={changing}
                today={today}
                onClose={() => setChanging(null)}
            />
        </>
    );
}

const toneClasses = {
    amber: {
        icon: 'bg-amber-50 text-amber-600',
        ring: 'ring-amber-400',
    },
    blue: { icon: 'bg-blue-50 text-blue-600', ring: 'ring-blue-400' },
    green: {
        icon: 'bg-emerald-50 text-emerald-600',
        ring: 'ring-emerald-400',
    },
} as const;

/** One stage's numbers; clicking it shows only that stage. */
function StageCard({
    stage,
    current,
    icon: Icon,
    tone,
    title,
    value,
    detail,
    onClick,
}: {
    stage: PreorderStage;
    current: Stage;
    icon: LucideIcon;
    tone: keyof typeof toneClasses;
    title: string;
    value: string;
    detail: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={current === stage}
            className={cn(
                'flex items-start gap-4 rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
                current === stage && `ring-2 ${toneClasses[tone].ring}`,
            )}
        >
            <span
                className={cn(
                    'flex size-12 shrink-0 items-center justify-center rounded-2xl',
                    toneClasses[tone].icon,
                )}
            >
                <Icon size={23} />
            </span>
            <span className="min-w-0">
                <span className="block text-xs font-black tracking-wide text-slate-500 uppercase">
                    {title}
                </span>
                <span className="mt-0.5 block text-2xl font-black tracking-tight text-slate-900">
                    {value}
                </span>
                <span className="block text-sm text-slate-500">{detail}</span>
            </span>
        </button>
    );
}

/** One product: photo and name, stage, its date, sizes, totals, View Details. */
function PreorderTableRow({
    product,
    today,
    onView,
}: {
    product: PreorderProductSummary;
    today: string;
    onView: () => void;
}) {
    const withPreorders = product.variants.filter(
        (variant) => variant.pieces > 0,
    );
    const oneSize =
        product.variants.length === 1 && product.variants[0].label === null;

    return (
        <tr className="border-t border-slate-100 text-sm transition hover:bg-slate-50/70">
            <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-300">
                        {product.photo_url ? (
                            <img
                                src={product.photo_url}
                                alt=""
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <ImageIcon size={18} />
                        )}
                    </div>
                    <p className="max-w-52 truncate font-black text-slate-900">
                        {product.name}
                    </p>
                </div>
            </td>
            <td className="px-5 py-4">
                <PreorderStageBadge stage={product.stage} />
            </td>
            <td className="px-5 py-4 whitespace-nowrap">
                <PreorderWhen product={product} today={today} />
            </td>
            <td className="px-5 py-4">
                {withPreorders.length === 0 ? (
                    <span className="text-slate-400">No preorders yet</span>
                ) : oneSize ? (
                    <span className="text-slate-600">One size</span>
                ) : (
                    <div className="flex max-w-64 flex-wrap gap-1.5">
                        {withPreorders.map((variant) => (
                            <span
                                key={variant.id}
                                className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700"
                            >
                                {variant.label}{' '}
                                <span className="text-slate-900">
                                    {variant.pieces}
                                </span>
                            </span>
                        ))}
                    </div>
                )}
            </td>
            <td className="px-5 py-4 text-right font-bold text-slate-700">
                {product.students_count.toLocaleString('en-PH')}
            </td>
            <td
                className={cn(
                    'px-5 py-4 text-right text-base font-black',
                    product.stage === 'to_order'
                        ? 'text-amber-700'
                        : 'text-slate-900',
                )}
            >
                {formatUnits(product.pieces_total, 'Piece')}
            </td>
            <td className="px-5 py-4 text-right">
                <button
                    type="button"
                    onClick={onView}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 text-sm font-black whitespace-nowrap text-blue-700 transition hover:bg-blue-100"
                >
                    <Eye size={15} />
                    View Details
                </button>
            </td>
        </tr>
    );
}
