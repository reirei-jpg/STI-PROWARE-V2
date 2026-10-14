import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    LoaderCircle,
    PackageCheck,
    Save,
    Search,
} from 'lucide-react';
import { useState } from 'react';
import DeliveryController from '@/actions/App/Http/Controllers/DeliveryController';
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController';
import InputError from '@/components/input-error';
import PageHeader from '@/components/page-header';
import Panel, { TableHeading } from '@/components/panel';
import {
    Quantity,
    SplitCounts,
    StockTargetNote,
    deliveryInputClasses as inputClasses,
} from '@/components/record-delivery-parts';
import { useRecordDelivery, wholeNumber } from '@/hooks/use-record-delivery';
import { formatDateOrdered } from '@/lib/format';
import { formatConversion, formatUnits, unitWord } from '@/lib/units';
import { cn } from '@/lib/utils';
import type { WaitingItemGroup } from '@/types';

export default function RecordDelivery({
    groups,
    today,
}: {
    groups: WaitingItemGroup[];
    today: string;
}) {
    const {
        data,
        setData,
        errors,
        processing,
        splitGroups,
        rowErrors,
        rowProblem,
        totalReceived,
        countedPieces,
        splitProblem,
        hasProblems,
        piecesIntoStock,
        notLinkedReceived,
        groupTotals,
        setGroupTotal,
        setRowQuantity,
        splitCounts,
        setSplitCount,
        submit,
    } = useRecordDelivery(groups, today);
    const [search, setSearch] = useState('');

    const visibleGroups = groups.filter((group) => {
        const term = search.trim().toLowerCase().replace(/^#/, '');

        return (
            term === '' ||
            group.item_code.toLowerCase().includes(term) ||
            group.description.toLowerCase().includes(term) ||
            group.rows.some((row) =>
                (row.order_number ?? '').toLowerCase().includes(term),
            )
        );
    });

    return (
        <>
            <Head title="Record Delivery" />

            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                }}
                className="space-y-7"
            >
                <PageHeader
                    title="Record Delivery"
                    description="Enter what arrived from Head Office. One delivery can cover items from several orders."
                    actions={
                        <Link
                            href={DeliveryController.index()}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                            <ArrowLeft size={18} />
                            Back to Deliveries
                        </Link>
                    }
                />

                <Panel title="Delivery Details">
                    <div className="grid gap-5 p-6 md:grid-cols-2 xl:grid-cols-4">
                        <label className="grid gap-1.5">
                            <span className="text-sm font-black text-slate-700">
                                Date Received
                            </span>
                            <input
                                type="date"
                                value={data.received_on}
                                max={today}
                                onChange={(event) =>
                                    setData('received_on', event.target.value)
                                }
                                className={inputClasses}
                            />
                            <InputError message={errors.received_on} />
                        </label>
                        <label className="grid gap-1.5">
                            <span className="text-sm font-black text-slate-700">
                                SI # (optional)
                            </span>
                            <input
                                value={data.sales_invoice_number}
                                onChange={(event) =>
                                    setData(
                                        'sales_invoice_number',
                                        event.target.value,
                                    )
                                }
                                maxLength={40}
                                placeholder="e.g. 1210000031492"
                                className={cn(inputClasses, 'font-mono')}
                            />
                            <InputError message={errors.sales_invoice_number} />
                        </label>
                        <label className="grid gap-1.5">
                            <span className="text-sm font-black text-slate-700">
                                DR # (optional)
                            </span>
                            <input
                                value={data.delivery_receipt_number}
                                onChange={(event) =>
                                    setData(
                                        'delivery_receipt_number',
                                        event.target.value,
                                    )
                                }
                                maxLength={40}
                                className={cn(inputClasses, 'font-mono')}
                            />
                            <InputError
                                message={errors.delivery_receipt_number}
                            />
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
                                maxLength={500}
                                placeholder="e.g. 1 box slightly damaged"
                                className={inputClasses}
                            />
                            <InputError message={errors.note} />
                        </label>
                    </div>
                </Panel>

                {groups.length === 0 ? (
                    <Panel>
                        <div className="px-6 py-16 text-center">
                            <PackageCheck
                                size={44}
                                className="mx-auto text-slate-300"
                            />
                            <h3 className="mt-4 text-lg font-black text-slate-800">
                                Nothing is waiting for delivery
                            </h3>
                            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                                Every uploaded order has arrived or was closed.
                                Upload new orders on Purchase Orders.
                            </p>
                            <Link
                                href={PurchaseOrderController.index()}
                                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white hover:bg-blue-700"
                            >
                                Go to Purchase Orders
                            </Link>
                        </div>
                    </Panel>
                ) : (
                    <>
                        <section className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
                            <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 md:max-w-sm">
                                <Search size={18} className="shrink-0" />
                                <input
                                    type="search"
                                    maxLength={120}
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Find an Item Code, description or Order #"
                                    className="w-full min-w-0 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                                    aria-label="Find an item"
                                />
                            </label>
                            <p className="text-sm text-slate-500">
                                Type the total you counted for an item code, and
                                PROWARE fills the oldest order first. You can
                                still change each order's number.
                            </p>
                        </section>

                        {visibleGroups.length === 0 && (
                            <p className="rounded-2xl bg-white px-5 py-4 text-sm text-slate-500">
                                No waiting item matches "{search}".
                            </p>
                        )}

                        {visibleGroups.map((group) => {
                            const remaining = group.rows.reduce(
                                (sum, row) => sum + row.quantity_remaining,
                                0,
                            );
                            const typedTotal = wholeNumber(
                                groupTotals[group.item_code],
                            );
                            const totalProblem =
                                typedTotal === null
                                    ? 'Enter a whole number.'
                                    : typedTotal > remaining
                                      ? `Only ${remaining.toLocaleString('en-PH')} left to receive for this item.`
                                      : null;

                            const target = group.stock_target;
                            const isSplit =
                                (target?.split_into.length ?? 0) > 1;
                            const counted = countedPieces(group);

                            return (
                                <Panel
                                    key={group.item_code}
                                    title={`${group.item_code} · ${group.description}`}
                                    description={`${
                                        target
                                            ? formatUnits(
                                                  remaining,
                                                  target.unit_name,
                                              )
                                            : `${remaining.toLocaleString('en-PH')} (as ordered on the eStore)`
                                    } still to come across ${group.rows.length} ${group.rows.length === 1 ? 'order' : 'orders'}`}
                                    actions={
                                        isSplit && target ? (
                                            <div className="grid gap-1 text-right">
                                                <span className="text-xs font-bold tracking-wide text-slate-400 uppercase">
                                                    Total received for this item
                                                </span>
                                                <span className="text-2xl font-black text-slate-900">
                                                    {formatUnits(
                                                        counted ?? 0,
                                                        'Piece',
                                                    )}
                                                </span>
                                                <span className="text-xs text-slate-500">
                                                    from your counts below
                                                </span>
                                            </div>
                                        ) : (
                                            <label className="grid gap-1">
                                                <span className="text-xs font-bold tracking-wide text-slate-400 uppercase">
                                                    Total received for this item
                                                </span>
                                                <span className="flex items-center gap-2">
                                                    <input
                                                        value={
                                                            groupTotals[
                                                                group.item_code
                                                            ] ?? ''
                                                        }
                                                        onChange={(event) =>
                                                            setGroupTotal(
                                                                group,
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                        inputMode="numeric"
                                                        placeholder="0"
                                                        className={cn(
                                                            inputClasses,
                                                            'w-36 text-right',
                                                        )}
                                                        aria-label={`Total received for ${group.item_code}`}
                                                    />
                                                    {target && (
                                                        <span className="w-14 text-sm font-bold text-slate-500">
                                                            {unitWord(
                                                                typedTotal ?? 0,
                                                                target.unit_name,
                                                            )}
                                                        </span>
                                                    )}
                                                </span>
                                                {target &&
                                                    totalProblem === null &&
                                                    (typedTotal ?? 0) > 0 && (
                                                        <span className="text-xs font-bold text-emerald-700">
                                                            Into stock:{' '}
                                                            {formatConversion(
                                                                typedTotal ?? 0,
                                                                target.unit_name,
                                                                target.pieces_per_unit,
                                                            )}
                                                        </span>
                                                    )}
                                                <InputError
                                                    message={
                                                        totalProblem ??
                                                        undefined
                                                    }
                                                />
                                            </label>
                                        )
                                    }
                                >
                                    <StockTargetNote group={group} />
                                    {isSplit && target && (
                                        <SplitCounts
                                            group={group}
                                            counts={
                                                splitCounts[group.item_code] ??
                                                {}
                                            }
                                            onChange={(variantId, value) =>
                                                setSplitCount(
                                                    group,
                                                    variantId,
                                                    value,
                                                )
                                            }
                                            problem={
                                                splitProblem(group) ??
                                                errors[
                                                    `splits.${splitGroups.indexOf(group)}`
                                                ] ??
                                                null
                                            }
                                        />
                                    )}
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-175">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    <TableHeading>
                                                        Order #
                                                    </TableHeading>
                                                    <TableHeading align="right">
                                                        QTY Ordered
                                                    </TableHeading>
                                                    <TableHeading align="right">
                                                        Received so far
                                                    </TableHeading>
                                                    <TableHeading align="right">
                                                        Remaining
                                                    </TableHeading>
                                                    <TableHeading align="right">
                                                        Received now
                                                    </TableHeading>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {group.rows.map((row) => {
                                                    const problem =
                                                        rowProblem(row) ??
                                                        rowErrors[
                                                            row
                                                                .purchase_order_item_id
                                                        ];
                                                    const receivedNow =
                                                        wholeNumber(
                                                            data.quantities[
                                                                row
                                                                    .purchase_order_item_id
                                                            ],
                                                        ) ?? 0;

                                                    return (
                                                        <tr
                                                            key={
                                                                row.purchase_order_item_id
                                                            }
                                                            className="border-t border-slate-100 align-top text-sm"
                                                        >
                                                            <td className="px-5 py-4">
                                                                <p className="font-mono font-black text-blue-700">
                                                                    {row.order_number
                                                                        ? `#${row.order_number}`
                                                                        : '—'}
                                                                </p>
                                                                <p className="mt-1 text-xs text-slate-500">
                                                                    Ordered{' '}
                                                                    {formatDateOrdered(
                                                                        row.date_ordered,
                                                                    )}
                                                                </p>
                                                            </td>
                                                            <td className="px-5 py-4 text-right font-black text-slate-800">
                                                                <Quantity
                                                                    value={
                                                                        row.quantity_ordered
                                                                    }
                                                                    target={
                                                                        target
                                                                    }
                                                                />
                                                            </td>
                                                            <td className="px-5 py-4 text-right text-emerald-700">
                                                                <Quantity
                                                                    value={
                                                                        row.quantity_received
                                                                    }
                                                                    target={
                                                                        target
                                                                    }
                                                                />
                                                            </td>
                                                            <td className="px-5 py-4 text-right font-black text-amber-700">
                                                                <Quantity
                                                                    value={
                                                                        row.quantity_remaining
                                                                    }
                                                                    target={
                                                                        target
                                                                    }
                                                                />
                                                            </td>
                                                            <td className="px-5 py-4">
                                                                <span className="flex items-center justify-end gap-2">
                                                                    <input
                                                                        value={
                                                                            data
                                                                                .quantities[
                                                                                row
                                                                                    .purchase_order_item_id
                                                                            ] ??
                                                                            ''
                                                                        }
                                                                        onChange={(
                                                                            event,
                                                                        ) =>
                                                                            setRowQuantity(
                                                                                row,
                                                                                event
                                                                                    .target
                                                                                    .value,
                                                                            )
                                                                        }
                                                                        inputMode="numeric"
                                                                        placeholder="0"
                                                                        className={cn(
                                                                            inputClasses,
                                                                            'ml-auto w-32 text-right',
                                                                            problem &&
                                                                                'border-red-300',
                                                                        )}
                                                                        aria-label={`Received now for Order #${row.order_number ?? ''}`}
                                                                    />
                                                                    {target && (
                                                                        <span className="w-14 text-left text-sm font-bold text-slate-500">
                                                                            {unitWord(
                                                                                receivedNow,
                                                                                target.unit_name,
                                                                            )}
                                                                        </span>
                                                                    )}
                                                                </span>
                                                                {target &&
                                                                    problem ===
                                                                        null &&
                                                                    receivedNow >
                                                                        0 && (
                                                                        <p className="mt-1 text-right text-xs font-bold text-emerald-700">
                                                                            Into
                                                                            stock:{' '}
                                                                            {formatConversion(
                                                                                receivedNow,
                                                                                target.unit_name,
                                                                                target.pieces_per_unit,
                                                                            )}
                                                                        </p>
                                                                    )}
                                                                <InputError
                                                                    className="mt-1 text-right"
                                                                    message={
                                                                        problem ??
                                                                        undefined
                                                                    }
                                                                />
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </Panel>
                            );
                        })}

                        <div className="sticky bottom-4 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-lg sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm text-slate-500">
                                    Going into stock when you save
                                </p>
                                <p className="text-2xl font-black text-slate-900">
                                    {formatUnits(piecesIntoStock, 'Piece')}
                                </p>
                                {notLinkedReceived > 0 && (
                                    <p className="mt-1 text-xs font-bold text-amber-700">
                                        {notLinkedReceived === 1
                                            ? '1 item is not linked to a product: it is recorded, but not added to stock.'
                                            : `${notLinkedReceived} items are not linked to a product: they are recorded, but not added to stock.`}
                                    </p>
                                )}
                                <InputError message={errors.items} />
                            </div>
                            <button
                                type="submit"
                                disabled={
                                    processing ||
                                    totalReceived === 0 ||
                                    hasProblems
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D6EFD] px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                data-test="save-delivery-button"
                            >
                                {processing ? (
                                    <LoaderCircle
                                        size={18}
                                        className="animate-spin"
                                    />
                                ) : (
                                    <Save size={18} />
                                )}
                                {processing ? 'Saving...' : 'Save Delivery'}
                            </button>
                        </div>
                    </>
                )}
            </form>
        </>
    );
}
