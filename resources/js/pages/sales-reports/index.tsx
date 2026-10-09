import { Head, router, useForm, usePage } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    Download,
    Gift,
    LoaderCircle,
    Search,
    ShoppingCart,
    Tag,
    TrendingDown,
    TrendingUp,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import SalesReportController from '@/actions/App/Http/Controllers/SalesReportController';
import DateRangeFilter from '@/components/date-range-filter';
import InputError from '@/components/input-error';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import Panel, { TableHeading } from '@/components/panel';
import { formatDateOrdered, formatDateTime, formatPeso } from '@/lib/format';
import { formatUnits } from '@/lib/units';
import { cn } from '@/lib/utils';
import type {
    FreeRow,
    Paginated,
    SalesPeriod,
    SalesReportFilters,
    SalesSummary,
    SalesTab,
    SoldRow,
    SpentRow,
} from '@/types';

const periods: { value: SalesPeriod; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This week' },
    { value: 'month', label: 'This month' },
    { value: 'custom', label: 'Pick dates' },
];

const tabs: { value: SalesTab; label: string }[] = [
    { value: 'spent', label: 'What we spent' },
    { value: 'sold', label: 'What we sold' },
    { value: 'free', label: 'Given free' },
];

/**
 * The Specialist's Sales Reports, in plain words. For a period: what was
 * spent on eStore orders; what was sold, each item with its Cost (what
 * PROWARE paid on the eStore order), its Price (what the student paid) and
 * the Profit; what was sold below its Cost; and what free uniforms (promo)
 * were worth. Three tabs list the details.
 */
export default function SalesReportsIndex({
    summary,
    spent,
    sold,
    free,
    filters,
}: {
    summary: SalesSummary;
    spent: Paginated<SpentRow> | null;
    sold: Paginated<SoldRow> | null;
    free: Paginated<FreeRow> | null;
    filters: SalesReportFilters;
}) {
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const [search, setSearch] = useState(filters.search ?? '');
    const [pickingDates, setPickingDates] = useState(
        filters.period === 'custom',
    );
    const firstRender = useRef(true);
    const periodText =
        filters.date_from === filters.date_to
            ? formatDateOrdered(filters.date_from)
            : `${formatDateOrdered(filters.date_from)} to ${formatDateOrdered(filters.date_to)}`;

    const show = (next: Partial<SalesReportFilters>) => {
        const merged = { ...filters, ...next };
        const query: Record<string, string> = {};

        if (merged.tab !== 'sold') {
            query.tab = merged.tab;
        }

        if (merged.period !== 'month') {
            query.period = merged.period;
        }

        if (merged.period === 'custom') {
            query.date_from = merged.date_from;
            query.date_to = merged.date_to;
        }

        if (merged.search) {
            query.search = merged.search;
        }

        router.get(SalesReportController.index().url, query, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    // Search as the Specialist types, after a short pause.
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;

            return;
        }

        const timer = window.setTimeout(
            () => show({ search: search.trim() === '' ? null : search.trim() }),
            400,
        );

        return () => window.clearTimeout(timer);
        // Only the typed search starts a new search.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const exportQuery: Record<string, string> =
        filters.period === 'custom'
            ? {
                  period: 'custom',
                  date_from: filters.date_from,
                  date_to: filters.date_to,
              }
            : { period: filters.period };

    return (
        <>
            <Head title="Sales Reports" />

            <div className="space-y-6">
                <PageHeader
                    title="Sales Reports"
                    description="What we spent on eStore orders, what we sold and the profit, what we sold below cost, and what free uniforms were worth."
                />

                <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        {periods.map((period) => {
                            const chosen =
                                period.value === 'custom'
                                    ? pickingDates
                                    : !pickingDates &&
                                      filters.period === period.value;

                            return (
                                <button
                                    key={period.value}
                                    type="button"
                                    onClick={() => {
                                        if (period.value === 'custom') {
                                            setPickingDates(true);

                                            return;
                                        }

                                        setPickingDates(false);
                                        show({ period: period.value });
                                    }}
                                    className={cn(
                                        'rounded-xl px-4 py-2.5 text-sm font-black transition',
                                        chosen
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                                    )}
                                >
                                    {period.label}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-base font-black text-slate-900">
                        {periodText}
                    </p>
                </section>

                {pickingDates && (
                    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <DateRangeFilter
                            label="From / To"
                            dateFrom={
                                filters.period === 'custom'
                                    ? filters.date_from
                                    : null
                            }
                            dateTo={
                                filters.period === 'custom'
                                    ? filters.date_to
                                    : null
                            }
                            serverError={errors.date_from ?? errors.date_to}
                            onChange={(dateFrom, dateTo) => {
                                if (dateFrom && dateTo) {
                                    show({
                                        period: 'custom',
                                        date_from: dateFrom,
                                        date_to: dateTo,
                                    });
                                }
                            }}
                        />
                    </section>
                )}

                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Card
                        icon={ShoppingCart}
                        tone="blue"
                        label="Spent on eStore orders"
                        value={formatPeso(summary.spent_centavos)}
                        detail={`${summary.purchase_orders} ${summary.purchase_orders === 1 ? 'order' : 'orders'} uploaded`}
                        onClick={() => show({ tab: 'spent' })}
                    />
                    <Card
                        icon={
                            summary.profit_centavos < 0
                                ? TrendingDown
                                : TrendingUp
                        }
                        tone={summary.profit_centavos < 0 ? 'red' : 'green'}
                        label="Profit"
                        value={formatPeso(summary.profit_centavos)}
                        detail={`Price ${formatPeso(summary.price_centavos)} − Cost ${formatPeso(summary.cost_centavos)}`}
                        note={
                            summary.missing_cost_lines > 0
                                ? `${summary.missing_cost_lines} ${summary.missing_cost_lines === 1 ? 'sale has' : 'sales have'} no Cost yet (not counted)`
                                : undefined
                        }
                        onClick={() => show({ tab: 'sold' })}
                    />
                    <Card
                        icon={Tag}
                        tone="red"
                        label="Sold below cost"
                        value={formatPeso(summary.below_cost_loss_centavos)}
                        detail={
                            summary.below_cost_lines === 0
                                ? 'Nothing sold below its Cost.'
                                : `lost on ${summary.below_cost_lines} ${summary.below_cost_lines === 1 ? 'sale' : 'sales'}`
                        }
                        onClick={() => show({ tab: 'sold' })}
                    />
                    <Card
                        icon={Gift}
                        tone="amber"
                        label="Given free"
                        value={formatPeso(summary.free_cost_centavos)}
                        detail={`${formatUnits(summary.free_pieces, 'Piece')} · worth ${formatPeso(summary.free_price_centavos)} at Price`}
                        onClick={() => show({ tab: 'free' })}
                    />
                </section>

                <Panel>
                    <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.value}
                                    type="button"
                                    onClick={() => show({ tab: tab.value })}
                                    className={cn(
                                        'rounded-xl px-4 py-2 text-sm font-black transition',
                                        filters.tab === tab.value
                                            ? 'bg-[#0D6EFD] text-white shadow-sm'
                                            : 'text-slate-600 hover:bg-white',
                                    )}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        {filters.tab === 'sold' && (
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 sm:w-72">
                                    <Search size={18} className="shrink-0" />
                                    <input
                                        type="search"
                                        value={search}
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
                                        placeholder="Search item"
                                        className="w-full min-w-0 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                                        aria-label="Search item"
                                    />
                                </label>
                                <a
                                    href={
                                        SalesReportController.export({
                                            query: exportQuery,
                                        }).url
                                    }
                                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                                >
                                    <Download size={16} />
                                    Excel (CSV)
                                </a>
                            </div>
                        )}
                    </div>

                    {spent && <SpentTable rows={spent} />}
                    {sold && <SoldTable rows={sold} />}
                    {free && <FreeTable rows={free} />}
                </Panel>
            </div>
        </>
    );
}

const toneClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
} as const;

function Card({
    icon: Icon,
    tone,
    label,
    value,
    detail,
    note,
    onClick,
}: {
    icon: LucideIcon;
    tone: keyof typeof toneClasses;
    label: string;
    value: string;
    detail: string;
    note?: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
            <span
                className={cn(
                    'flex size-11 items-center justify-center rounded-2xl',
                    toneClasses[tone],
                )}
            >
                <Icon size={21} />
            </span>
            <span className="mt-4 text-xs font-black tracking-wide text-slate-500 uppercase">
                {label}
            </span>
            <span
                className={cn(
                    'mt-0.5 text-2xl font-black tracking-tight',
                    tone === 'red'
                        ? 'text-red-600'
                        : tone === 'green'
                          ? 'text-emerald-700'
                          : 'text-slate-900',
                )}
            >
                {value}
            </span>
            <span className="text-sm text-slate-500">{detail}</span>
            {note && (
                <span className="mt-2 text-xs font-bold text-amber-700">
                    {note}
                </span>
            )}
        </button>
    );
}

function Empty({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
    return (
        <div className="px-6 py-16 text-center">
            <Icon size={44} className="mx-auto text-slate-300" />
            <p className="mt-4 text-lg font-black text-slate-800">{text}</p>
        </div>
    );
}

/** 1. The uploaded eStore orders of the period. */
function SpentTable({ rows }: { rows: Paginated<SpentRow> }) {
    if (rows.data.length === 0) {
        return (
            <Empty icon={ShoppingCart} text="No eStore orders in this period" />
        );
    }

    return (
        <>
            <div className="overflow-x-auto">
                <table className="w-full min-w-180">
                    <thead className="bg-slate-50">
                        <tr>
                            <TableHeading>Order #</TableHeading>
                            <TableHeading>Date ordered</TableHeading>
                            <TableHeading align="right">Items</TableHeading>
                            <TableHeading align="right">Amount</TableHeading>
                            <TableHeading>Uploaded by</TableHeading>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.data.map((row) => (
                            <tr
                                key={row.id}
                                className="border-t border-slate-100 text-sm"
                            >
                                <td className="px-5 py-4 font-mono font-black text-blue-700">
                                    {row.order_number
                                        ? `#${row.order_number}`
                                        : 'No order #'}
                                </td>
                                <td className="px-5 py-4 text-slate-700">
                                    {formatDateOrdered(row.date_ordered)}
                                </td>
                                <td className="px-5 py-4 text-right text-slate-700">
                                    {row.items_count}
                                </td>
                                <td className="px-5 py-4 text-right text-base font-black text-slate-900">
                                    {formatPeso(row.total_centavos)}
                                </td>
                                <td className="px-5 py-4 text-slate-700">
                                    {row.uploaded_by}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Pagination pagination={rows} itemName="orders" />
        </>
    );
}

/** 2 and 3. Each item sold at each price: Cost, Price, Profit. */
function SoldTable({ rows }: { rows: Paginated<SoldRow> }) {
    if (rows.data.length === 0) {
        return <Empty icon={TrendingUp} text="Nothing sold in this period" />;
    }

    return (
        <>
            <div className="overflow-x-auto">
                <table className="w-full min-w-250">
                    <thead className="bg-slate-50">
                        <tr>
                            <TableHeading>Item</TableHeading>
                            <TableHeading align="right">Cost</TableHeading>
                            <TableHeading align="right">Price</TableHeading>
                            <TableHeading align="right">Sold</TableHeading>
                            <TableHeading align="right">
                                Total Price
                            </TableHeading>
                            <TableHeading align="right">
                                Total Cost
                            </TableHeading>
                            <TableHeading align="right">Profit</TableHeading>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.data.map((row) => (
                            <SoldTableRow key={row.key} row={row} />
                        ))}
                    </tbody>
                </table>
            </div>
            <Pagination pagination={rows} itemName="items" />
        </>
    );
}

function SoldTableRow({ row }: { row: SoldRow }) {
    const unit = row.pieces_per_unit > 1 ? row.unit_name.toLowerCase() : 'pc';

    return (
        <tr
            className={cn(
                'border-t border-slate-100 align-top text-sm',
                row.below_cost && 'bg-red-50/60',
            )}
        >
            <td className="px-5 py-4">
                <p className="font-black text-slate-900">{row.product_name}</p>
                <p className="text-xs text-slate-500">
                    {row.variant_label && `${row.variant_label} · `}
                    {row.pieces_per_unit > 1
                        ? `${row.unit_name} of ${row.pieces_per_unit}`
                        : 'By the piece'}
                </p>
                {row.below_cost && (
                    <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-black text-red-700">
                        <TrendingDown size={12} />
                        Sold below cost · lost {formatPeso(row.loss_centavos)}
                    </p>
                )}
            </td>
            <td className="px-5 py-4 text-right whitespace-nowrap">
                {row.cost_each_centavos === null ? (
                    <SetCost row={row} />
                ) : (
                    <Each value={row.cost_each_centavos} unit={unit} />
                )}
            </td>
            <td className="px-5 py-4 text-right whitespace-nowrap">
                {row.normal_each_centavos !== null && (
                    <span className="mr-1.5 text-xs text-slate-400 line-through">
                        {formatPeso(row.normal_each_centavos)}
                    </span>
                )}
                <Each
                    value={row.price_each_centavos}
                    unit={unit}
                    className={
                        row.normal_each_centavos !== null
                            ? 'text-red-600'
                            : undefined
                    }
                />
                {row.normal_each_centavos !== null && (
                    <span className="block text-[11px] font-black text-red-600">
                        On sale ·{' '}
                        {formatPeso(
                            row.normal_each_centavos - row.price_each_centavos,
                        )}{' '}
                        less each
                    </span>
                )}
            </td>
            <td className="px-5 py-4 text-right font-bold whitespace-nowrap text-slate-700">
                {formatUnits(row.quantity, row.unit_name)}
            </td>
            <td className="px-5 py-4 text-right font-black whitespace-nowrap text-slate-900">
                {formatPeso(row.price_total_centavos)}
            </td>
            <td className="px-5 py-4 text-right whitespace-nowrap text-slate-700">
                {row.cost_total_centavos === null
                    ? '—'
                    : formatPeso(row.cost_total_centavos)}
            </td>
            <td
                className={cn(
                    'px-5 py-4 text-right text-base font-black whitespace-nowrap',
                    row.profit_centavos === null
                        ? 'text-slate-300'
                        : row.profit_centavos < 0
                          ? 'text-red-600'
                          : 'text-emerald-700',
                )}
            >
                {row.profit_centavos === null
                    ? '—'
                    : formatPeso(row.profit_centavos)}
            </td>
        </tr>
    );
}

function Each({
    value,
    unit,
    className,
}: {
    value: number;
    unit: string;
    className?: string;
}): ReactNode {
    return (
        <span className={cn('font-black text-slate-900', className)}>
            {formatPeso(value)}
            <span className="font-normal text-slate-500"> / {unit}</span>
        </span>
    );
}

/** A sale whose Cost is not set: enter the Cost per piece right here. */
function SetCost({ row }: { row: SoldRow }) {
    const form = useForm({ unit_cost: '' });
    const [open, setOpen] = useState(false);

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800 transition hover:bg-amber-100"
            >
                Not set · Set cost
            </button>
        );
    }

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.post(SalesReportController.setPrice(row.variant_id).url, {
                    preserveScroll: true,
                });
            }}
            className="ml-auto flex max-w-48 flex-col items-end gap-1"
        >
            <span className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500">₱</span>
                <input
                    value={form.data.unit_cost}
                    onChange={(event) =>
                        form.setData(
                            'unit_cost',
                            event.target.value
                                .replace(/[^\d.]/g, '')
                                .slice(0, 10),
                        )
                    }
                    inputMode="decimal"
                    placeholder="per piece"
                    autoFocus
                    aria-label={`Cost per piece of ${row.product_name}`}
                    className="h-9 w-24 rounded-lg border border-slate-200 bg-white px-2 text-right text-sm font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                <button
                    type="submit"
                    disabled={
                        form.processing || !(Number(form.data.unit_cost) > 0)
                    }
                    className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#0D6EFD] px-3 text-xs font-black text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                    {form.processing && (
                        <LoaderCircle size={13} className="animate-spin" />
                    )}
                    Save
                </button>
            </span>
            <InputError message={form.errors.unit_cost} />
        </form>
    );
}

/** 4. Free uniforms given (promo), with who received them. */
function FreeTable({ rows }: { rows: Paginated<FreeRow> }) {
    if (rows.data.length === 0) {
        return (
            <div className="px-6 py-16 text-center">
                <Gift size={44} className="mx-auto text-slate-300" />
                <p className="mt-4 text-lg font-black text-slate-800">
                    No free uniforms given in this period
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                    To record one, open the item in Products, then Stock,
                    Correct Stock, and choose "Given free (promo)".
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="overflow-x-auto">
                <table className="w-full min-w-225">
                    <thead className="bg-slate-50">
                        <tr>
                            <TableHeading>Date</TableHeading>
                            <TableHeading>Item</TableHeading>
                            <TableHeading align="right">Qty</TableHeading>
                            <TableHeading>Given to</TableHeading>
                            <TableHeading align="right">
                                Worth at Cost
                            </TableHeading>
                            <TableHeading align="right">
                                Worth at Price
                            </TableHeading>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.data.map((row) => (
                            <tr
                                key={row.id}
                                className="border-t border-slate-100 align-top text-sm"
                            >
                                <td className="px-5 py-4 whitespace-nowrap text-slate-700">
                                    {formatDateTime(row.given_at)}
                                    {row.recorded_by && (
                                        <span className="block text-xs text-slate-500">
                                            by {row.recorded_by}
                                        </span>
                                    )}
                                </td>
                                <td className="px-5 py-4">
                                    <p className="font-black text-slate-900">
                                        {row.product_name}
                                    </p>
                                    {row.variant_label && (
                                        <p className="text-xs text-slate-500">
                                            {row.variant_label}
                                        </p>
                                    )}
                                </td>
                                <td className="px-5 py-4 text-right font-bold text-slate-700">
                                    {formatUnits(row.pieces, 'Piece')}
                                </td>
                                <td className="px-5 py-4">
                                    <p className="font-bold text-slate-800">
                                        {row.recipient_name}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        Enrollment form #
                                        {row.enrollment_form_number}
                                    </p>
                                </td>
                                <td className="px-5 py-4 text-right font-black whitespace-nowrap text-slate-900">
                                    {row.cost_centavos === null ? (
                                        <span className="text-xs font-bold text-amber-700">
                                            Cost not set
                                        </span>
                                    ) : (
                                        formatPeso(row.cost_centavos)
                                    )}
                                </td>
                                <td className="px-5 py-4 text-right whitespace-nowrap text-slate-700">
                                    {formatPeso(row.price_centavos)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Pagination pagination={rows} itemName="free uniforms" />
        </>
    );
}
