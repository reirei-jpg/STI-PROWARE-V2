import { formatPeso } from '@/lib/format';
import { formatUnits } from '@/lib/units';
import type { OptionRow, SalesByOption, StockTrend } from '@/types';

/**
 * Sales Reports, By Size, Color, Grade (panel revision D1): the pieces
 * released to buyers in the period and what they paid, by each size, color
 * and grade level, with the products that sold most in each. Each table adds
 * up to the Sales tab's total.
 */
export function OptionTables({ data }: { data: SalesByOption }) {
    if (data.pieces === 0) {
        return (
            <p className="px-6 py-14 text-center text-sm text-slate-500">
                Nothing was released to buyers in this period.
            </p>
        );
    }

    return (
        <div className="grid gap-5 p-6 xl:grid-cols-3">
            <OptionTable title="By Size" rows={data.size} />
            <OptionTable title="By Color" rows={data.color} />
            <OptionTable title="By Grade Level" rows={data.grade} />
            <p className="text-xs text-slate-500 xl:col-span-3">
                {formatUnits(data.pieces, 'Piece')} released ·{' '}
                {formatPeso(data.price_total_centavos)} in sales, the same as
                the Sales tab. Grade 11 and 12 come from a product&apos;s
                Program option; College and Senior High from its category.
            </p>
        </div>
    );
}

function OptionTable({ title, rows }: { title: string; rows: OptionRow[] }) {
    const most = Math.max(1, ...rows.map((row) => row.pieces));

    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200">
            <h3 className="bg-slate-50 px-4 py-2.5 text-xs font-black tracking-wide text-slate-600 uppercase">
                {title}
            </h3>
            <ul className="divide-y divide-slate-100">
                {rows.map((row) => (
                    <li key={row.label} className="px-4 py-2.5">
                        <div className="flex items-baseline justify-between gap-3">
                            <span className="font-black text-slate-900">
                                {row.label}
                            </span>
                            <span className="text-sm whitespace-nowrap">
                                <b className="text-slate-900">
                                    {formatUnits(row.pieces, 'Piece')}
                                </b>{' '}
                                <span className="text-slate-500">
                                    · {formatPeso(row.price_total_centavos)} ·{' '}
                                    {row.share}%
                                </span>
                            </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                                className="h-full rounded-full bg-[#0D6EFD]"
                                style={{
                                    width: `${(row.pieces / most) * 100}%`,
                                }}
                            />
                        </div>
                        {row.top && (
                            <p className="mt-1 truncate text-xs text-slate-500">
                                {row.top}
                            </p>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    );
}

/**
 * Sales Reports, Stock Trend (panel revision D1): per day or week, the pieces
 * received, sold, given free and corrected, and the stock at the end, for
 * every product or the one chosen. Bars compare received and sold.
 */
export function StockTrendTable({
    trend,
    products,
    product,
    onProduct,
}: {
    trend: StockTrend;
    products: { id: number; name: string }[];
    product: number | null;
    onProduct: (product: number | null) => void;
}) {
    const most = Math.max(
        1,
        ...trend.rows.flatMap((row) => [row.received, row.sold]),
    );

    return (
        <div className="space-y-4 p-6">
            <label className="flex max-w-md items-center gap-2 text-sm font-bold text-slate-700">
                Product
                <select
                    value={product ?? ''}
                    onChange={(event) =>
                        onProduct(
                            event.target.value === ''
                                ? null
                                : Number(event.target.value),
                        )
                    }
                    className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900"
                >
                    <option value="">All products</option>
                    {products.map((option) => (
                        <option key={option.id} value={option.id}>
                            {option.name}
                        </option>
                    ))}
                </select>
            </label>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-180 text-sm">
                    <thead className="bg-slate-50 text-xs font-black tracking-wide text-slate-500 uppercase">
                        <tr>
                            <th className="px-4 py-2.5 text-left">
                                {trend.by === 'day' ? 'Day' : 'Week'}
                            </th>
                            <th className="px-4 py-2.5 text-left">
                                Received vs sold
                            </th>
                            <th className="px-4 py-2.5 text-right">Received</th>
                            <th className="px-4 py-2.5 text-right">Sold</th>
                            <th className="px-4 py-2.5 text-right">
                                Given free
                            </th>
                            <th className="px-4 py-2.5 text-right">
                                Corrections
                            </th>
                            <th className="px-4 py-2.5 text-right">
                                Stock at the end
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {trend.rows.map((row) => (
                            <tr key={row.from}>
                                <td className="px-4 py-2 font-bold whitespace-nowrap text-slate-900">
                                    {row.label}
                                </td>
                                <td className="w-56 px-4 py-2">
                                    <div className="grid gap-1">
                                        <div
                                            className="h-1.5 rounded-full bg-emerald-500"
                                            style={{
                                                width: `${(row.received / most) * 100}%`,
                                            }}
                                            title={`Received ${row.received}`}
                                        />
                                        <div
                                            className="h-1.5 rounded-full bg-[#0D6EFD]"
                                            style={{
                                                width: `${(row.sold / most) * 100}%`,
                                            }}
                                            title={`Sold ${row.sold}`}
                                        />
                                    </div>
                                </td>
                                <Count
                                    value={row.received}
                                    tone="text-emerald-700"
                                />
                                <Count value={row.sold} tone="text-blue-700" />
                                <Count value={row.free} />
                                <Count value={row.corrections} signed />
                                <td className="px-4 py-2 text-right font-black text-slate-900">
                                    {formatUnits(row.stock_at_end, 'Piece')}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="text-xs text-slate-500">
                Green bar: received from Head Office · blue bar: sold (released
                to buyers). Stock at the end is the pieces on the shelf after
                that {trend.by === 'day' ? 'day' : 'week'}.
            </p>
        </div>
    );
}

function Count({
    value,
    tone = 'text-slate-700',
    signed = false,
}: {
    value: number;
    tone?: string;
    signed?: boolean;
}) {
    return (
        <td
            className={`px-4 py-2 text-right ${value === 0 ? 'text-slate-300' : tone}`}
        >
            {value === 0
                ? '—'
                : `${signed && value > 0 ? '+' : ''}${value.toLocaleString('en-PH')}`}
        </td>
    );
}
