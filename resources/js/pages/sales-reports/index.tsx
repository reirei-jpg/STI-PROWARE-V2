import { Head, router, useForm, usePage } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    Banknote,
    Download,
    Eye,
    LoaderCircle,
    Receipt,
    Search,
    Tag,
    TrendingUp,
    TriangleAlert,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import SalesReportController from '@/actions/App/Http/Controllers/SalesReportController';
import DateRangeFilter from '@/components/date-range-filter';
import InputError from '@/components/input-error';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import Panel, { TableHeading } from '@/components/panel';
import ProductSalesDialog from '@/components/product-sales-dialog';
import { formatDateOrdered, formatPeso } from '@/lib/format';
import { formatUnits } from '@/lib/units';
import { cn } from '@/lib/utils';
import type {
    Paginated,
    ProductSales,
    ProductSalesDetails,
    SalesPeriod,
    SalesReportFilters,
    SalesSummary,
    VariantNeedingPrice,
} from '@/types';

const periods: { value: SalesPeriod; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This week' },
    { value: 'month', label: 'This month' },
    { value: 'custom', label: 'Choose dates' },
];

/**
 * The Specialist's Sales Reports for a period (this month by default):
 * Sales (released orders), what their pieces cost on the eStore (as on the
 * uploaded purchase orders), Profit with its margin, and the Discounts
 * given while items were on sale. Stock without an eStore price is listed
 * with its price to enter. Below, sales per product and size, with View
 * Details for each release. Export downloads the period for Excel.
 */
export default function SalesReportsIndex({
    summary,
    products,
    needingPrice,
    details,
    filters,
}: {
    summary: SalesSummary;
    products: Paginated<ProductSales>;
    needingPrice: VariantNeedingPrice[];
    details?: ProductSalesDetails | null;
    filters: SalesReportFilters;
}) {
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const [search, setSearch] = useState(filters.search ?? '');
    const [viewingId, setViewingId] = useState<number | null>(null);
    const [choosingDates, setChoosingDates] = useState(
        filters.period === 'custom',
    );
    const firstRender = useRef(true);
    const periodText =
        filters.date_from === filters.date_to
            ? `on ${formatDateOrdered(filters.date_from)}`
            : `from ${formatDateOrdered(filters.date_from)} to ${formatDateOrdered(filters.date_to)}`;

    const showReport = (next: Partial<SalesReportFilters>) => {
        const merged = { ...filters, ...next };
        const query: Record<string, string> = {};

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
            () =>
                showReport({
                    search: search.trim() === '' ? null : search.trim(),
                }),
            400,
        );

        return () => window.clearTimeout(timer);
        // Only the typed search starts a new search.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const openDetails = (product: ProductSales) => {
        setViewingId(product.variant_id);
        router.reload({
            data: { details: product.variant_id },
            only: ['details'],
        });
    };

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
                    description="What released orders collected, what their items cost on the eStore (as on the uploaded purchase orders), the profit, and the discounts given while items were on sale."
                    actions={
                        <a
                            href={
                                SalesReportController.export({
                                    query: exportQuery,
                                }).url
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
                        >
                            <Download size={18} />
                            Export for Excel (CSV)
                        </a>
                    }
                />

                <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        {periods.map((period) => (
                            <button
                                key={period.value}
                                type="button"
                                onClick={() => {
                                    if (period.value === 'custom') {
                                        setChoosingDates(true);

                                        return;
                                    }

                                    setChoosingDates(false);
                                    showReport({ period: period.value });
                                }}
                                className={cn(
                                    'rounded-xl px-4 py-2.5 text-sm font-black transition',
                                    (
                                        period.value === 'custom'
                                            ? choosingDates
                                            : !choosingDates &&
                                              filters.period === period.value
                                    )
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                                )}
                            >
                                {period.label}
                            </button>
                        ))}
                    </div>
                    <p className="text-sm font-bold text-slate-600">
                        Released {periodText}
                    </p>
                </section>

                {choosingDates && (
                    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <DateRangeFilter
                            label="Released between"
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
                                    showReport({
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
                        icon={Banknote}
                        tone="blue"
                        label="Sales"
                        value={formatPeso(summary.sales_centavos)}
                        detail={`${summary.orders} ${summary.orders === 1 ? 'order' : 'orders'} released · ${formatUnits(summary.pieces, 'Piece')}`}
                    />
                    <Card
                        icon={Receipt}
                        tone="slate"
                        label="eStore cost"
                        value={formatPeso(summary.cost_centavos)}
                        detail="What those items cost Head Office's eStore."
                        warning={
                            summary.uncosted_lines > 0
                                ? `${summary.uncosted_lines} ${summary.uncosted_lines === 1 ? 'sale has' : 'sales have'} no eStore price yet`
                                : undefined
                        }
                    />
                    <Card
                        icon={TrendingUp}
                        tone={summary.profit_centavos < 0 ? 'red' : 'green'}
                        label="Profit"
                        value={formatPeso(summary.profit_centavos)}
                        detail={
                            summary.margin_percent === null
                                ? 'Nothing with a cost sold yet.'
                                : `${summary.margin_percent}% of sales (margin)`
                        }
                    />
                    <Card
                        icon={Tag}
                        tone="amber"
                        label="Discounts given"
                        value={formatPeso(summary.discount_centavos)}
                        detail={`${formatUnits(summary.on_sale_pieces, 'Piece')} sold on sale`}
                        warning={
                            summary.discount_not_recorded_lines > 0
                                ? `${summary.discount_not_recorded_lines} older ${summary.discount_not_recorded_lines === 1 ? 'sale' : 'sales'}: discount not recorded`
                                : undefined
                        }
                        warningTone="slate"
                    />
                </section>

                {needingPrice.length > 0 && (
                    <NeedsPrice variants={needingPrice} />
                )}

                <Panel>
                    <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h2 className="font-black text-slate-900">
                                Sales per Product
                            </h2>
                            <p className="mt-1 text-sm text-slate-500">
                                Biggest sales first. Profit counts only sales
                                with an eStore price.
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

                    {products.data.length === 0 ? (
                        <div className="px-6 py-16 text-center">
                            <TrendingUp
                                size={44}
                                className="mx-auto text-slate-300"
                            />
                            <h3 className="mt-4 text-lg font-black text-slate-800">
                                {filters.search
                                    ? 'No product matches your search'
                                    : 'No sales in this period'}
                            </h3>
                            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                                A sale is counted when the Specialist releases a
                                student's order.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-250">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <TableHeading>Product</TableHeading>
                                            <TableHeading align="right">
                                                Sold
                                            </TableHeading>
                                            <TableHeading align="right">
                                                Sales
                                            </TableHeading>
                                            <TableHeading align="right">
                                                eStore Cost
                                            </TableHeading>
                                            <TableHeading align="right">
                                                Profit
                                            </TableHeading>
                                            <TableHeading align="right">
                                                Discounts
                                            </TableHeading>
                                            <TableHeading align="right">
                                                Actions
                                            </TableHeading>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {products.data.map((product) => (
                                            <ProductRow
                                                key={product.variant_id}
                                                product={product}
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

            <ProductSalesDialog
                open={viewingId !== null}
                // Another product's details (from before) count as loading.
                details={
                    details && details.product?.variant_id === viewingId
                        ? details
                        : details === null
                          ? null
                          : undefined
                }
                periodText={periodText}
                onClose={() => setViewingId(null)}
            />
        </>
    );
}

const toneClasses = {
    blue: 'bg-blue-50 text-blue-600',
    slate: 'bg-slate-100 text-slate-600',
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
    warning,
    warningTone = 'amber',
}: {
    icon: LucideIcon;
    tone: keyof typeof toneClasses;
    label: string;
    value: string;
    detail: string;
    warning?: string;
    warningTone?: 'amber' | 'slate';
}) {
    return (
        <div className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
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
            {warning && (
                <span
                    className={cn(
                        'mt-2 text-xs font-bold',
                        warningTone === 'amber'
                            ? 'text-amber-700'
                            : 'text-slate-400',
                    )}
                >
                    {warning}
                </span>
            )}
        </div>
    );
}

function ProductRow({
    product,
    onView,
}: {
    product: ProductSales;
    onView: () => void;
}) {
    const margin =
        product.costed_sales_centavos > 0
            ? Math.round(
                  (product.profit_centavos / product.costed_sales_centavos) *
                      1000,
              ) / 10
            : null;

    return (
        <tr className="border-t border-slate-100 text-sm transition hover:bg-slate-50/70">
            <td className="px-5 py-4">
                <p className="font-black text-slate-900">
                    {product.product_name}
                </p>
                {product.variant_label && (
                    <p className="text-xs text-slate-500">
                        {product.variant_label}
                    </p>
                )}
            </td>
            <td className="px-5 py-4 text-right font-bold whitespace-nowrap text-slate-700">
                {formatUnits(product.pieces, 'Piece')}
            </td>
            <td className="px-5 py-4 text-right font-black whitespace-nowrap text-slate-900">
                {formatPeso(product.sales_centavos)}
            </td>
            <td className="px-5 py-4 text-right whitespace-nowrap text-slate-700">
                {formatPeso(product.cost_centavos)}
                {product.uncosted_lines > 0 && (
                    <span className="block text-xs font-bold text-amber-700">
                        {product.uncosted_lines} without price
                    </span>
                )}
            </td>
            <td className="px-5 py-4 text-right whitespace-nowrap">
                <span
                    className={cn(
                        'font-black',
                        product.profit_centavos < 0
                            ? 'text-red-600'
                            : 'text-emerald-700',
                    )}
                >
                    {formatPeso(product.profit_centavos)}
                </span>
                {margin !== null && (
                    <span className="block text-xs text-slate-500">
                        {margin}%
                    </span>
                )}
            </td>
            <td className="px-5 py-4 text-right whitespace-nowrap">
                {product.discount_centavos > 0 ? (
                    <>
                        <span className="font-black text-red-600">
                            −{formatPeso(product.discount_centavos)}
                        </span>
                        <span className="flex items-center justify-end gap-1 text-xs font-bold text-red-600">
                            <Tag size={11} />
                            {formatUnits(product.on_sale_pieces, 'Piece')} on
                            sale
                        </span>
                    </>
                ) : (
                    <span className="text-slate-300">—</span>
                )}
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

/**
 * Stock that came in without an eStore price (before deliveries were
 * recorded, or a recount): enter its price per piece once, and its sales
 * are costed.
 */
function NeedsPrice({ variants }: { variants: VariantNeedingPrice[] }) {
    return (
        <Panel
            title="Needs eStore price"
            description="These pieces came into stock without what they cost on the eStore. Enter the price per piece once; their sales are costed again."
            className="border-l-4 border-l-amber-500"
        >
            <ul className="divide-y divide-slate-100">
                {variants.map((variant) => (
                    <NeedsPriceRow key={variant.variant_id} variant={variant} />
                ))}
            </ul>
        </Panel>
    );
}

function NeedsPriceRow({ variant }: { variant: VariantNeedingPrice }) {
    const form = useForm({ unit_cost: '' });

    return (
        <li className="flex flex-col gap-3 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
                <TriangleAlert
                    size={18}
                    className="mt-0.5 shrink-0 text-amber-600"
                />
                <div>
                    <p className="font-black text-slate-900">
                        {variant.product_name}
                        {variant.variant_label && (
                            <span className="font-bold text-slate-500">
                                {' '}
                                · {variant.variant_label}
                            </span>
                        )}
                    </p>
                    <p className="text-sm text-slate-500">
                        {formatUnits(variant.uncosted_pieces, 'Piece')} in stock
                        without an eStore price
                    </p>
                </div>
            </div>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post(
                        SalesReportController.setPrice(variant.variant_id).url,
                        { preserveScroll: true },
                    );
                }}
                className="flex flex-col gap-1"
            >
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-500">₱</span>
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
                        placeholder="Price per piece"
                        aria-label={`eStore price per piece of ${variant.product_name}`}
                        className="h-10 w-36 rounded-xl border border-slate-200 bg-white px-3 text-right text-sm font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                    <button
                        type="submit"
                        disabled={
                            form.processing ||
                            !(Number(form.data.unit_cost) > 0)
                        }
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0D6EFD] px-4 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-50"
                    >
                        {form.processing && (
                            <LoaderCircle size={15} className="animate-spin" />
                        )}
                        Save price
                    </button>
                </div>
                <InputError message={form.errors.unit_cost} />
            </form>
        </li>
    );
}
