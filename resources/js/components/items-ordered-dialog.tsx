import { Boxes, LoaderCircle } from 'lucide-react';
import { TableHeading, TableScroll } from '@/components/panel';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatUnits } from '@/lib/units';
import { cn } from '@/lib/utils';
import type { ItemOrdered } from '@/types';

/** "10 pcs", "5 Packs", or just the number while not linked to a product. */
function quantity(value: number, unitName: string | null): string {
    return unitName
        ? formatUnits(value, unitName)
        : value.toLocaleString('en-PH');
}

/**
 * What Total QTY Ordered is made of: every item of the listed orders,
 * added up per Item Code, the most ordered first, with how many were for
 * preorders and how many are the Specialist's own order.
 */
export default function ItemsOrderedDialog({
    open,
    items,
    scope,
    onClose,
}: {
    open: boolean;
    /** Undefined while it loads. */
    items: ItemOrdered[] | undefined;
    /** e.g. "Nov 12, 2026 to Nov 13, 2026", or "All orders". */
    scope: string;
    onClose: () => void;
}) {
    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-5xl">
                <div className="flex items-start gap-3 border-b border-slate-100 px-6 py-5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <Boxes size={22} />
                    </span>
                    <div>
                        <DialogTitle className="text-lg font-black text-slate-900">
                            Total QTY Ordered, by item
                        </DialogTitle>
                        <DialogDescription className="text-sm text-slate-500">
                            {scope} · the most ordered first
                        </DialogDescription>
                    </div>
                </div>

                <div className="overflow-y-auto px-6 py-4">
                    {items === undefined ? (
                        <div className="flex flex-col items-center gap-3 py-16 text-sm font-bold text-slate-500">
                            <LoaderCircle
                                size={28}
                                className="animate-spin text-blue-600"
                            />
                            Loading…
                        </div>
                    ) : items.length === 0 ? (
                        <p className="py-16 text-center text-sm font-bold text-slate-500">
                            No items ordered.
                        </p>
                    ) : (
                        <TableScroll>
                            <table className="w-full min-w-200 text-sm">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <TableHeading>Item</TableHeading>
                                        <TableHeading align="right">
                                            Preorders
                                        </TableHeading>
                                        <TableHeading align="right">
                                            Own order
                                        </TableHeading>
                                        <TableHeading align="right">
                                            Total ordered
                                        </TableHeading>
                                        <TableHeading align="right">
                                            Received
                                        </TableHeading>
                                        <TableHeading align="right">
                                            Remaining
                                        </TableHeading>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item) => (
                                        <tr
                                            key={item.item_code}
                                            className="border-t border-slate-100 align-top"
                                        >
                                            <td className="px-5 py-3">
                                                <p className="font-mono text-xs font-black text-blue-700">
                                                    {item.item_code}
                                                </p>
                                                <p className="font-semibold text-slate-900">
                                                    {item.description}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    On {item.orders_count}{' '}
                                                    {item.orders_count === 1
                                                        ? 'order'
                                                        : 'orders'}
                                                </p>
                                            </td>
                                            {item.preorder_quantity === null ? (
                                                <td
                                                    colSpan={2}
                                                    className="px-5 py-3 text-center text-xs font-semibold text-slate-400"
                                                >
                                                    Not tracked
                                                </td>
                                            ) : (
                                                <>
                                                    <td className="px-5 py-3 text-right whitespace-nowrap">
                                                        <span
                                                            className={cn(
                                                                'font-black',
                                                                item.preorder_quantity >
                                                                    0
                                                                    ? 'text-blue-700'
                                                                    : 'text-slate-400',
                                                            )}
                                                        >
                                                            {quantity(
                                                                item.preorder_quantity,
                                                                item.unit_name,
                                                            )}
                                                        </span>
                                                        {item.partly_tracked && (
                                                            <span className="block text-xs font-semibold text-slate-400">
                                                                older POs not
                                                                tracked
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3 text-right font-black whitespace-nowrap text-slate-600">
                                                        {quantity(
                                                            item.own_quantity ??
                                                                0,
                                                            item.unit_name,
                                                        )}
                                                    </td>
                                                </>
                                            )}
                                            <td className="px-5 py-3 text-right font-black whitespace-nowrap text-slate-900">
                                                {quantity(
                                                    item.quantity_ordered,
                                                    item.unit_name,
                                                )}
                                            </td>
                                            <td className="px-5 py-3 text-right font-black whitespace-nowrap text-emerald-700">
                                                {quantity(
                                                    item.quantity_received,
                                                    item.unit_name,
                                                )}
                                            </td>
                                            <td
                                                className={cn(
                                                    'px-5 py-3 text-right font-black whitespace-nowrap',
                                                    item.quantity_remaining > 0
                                                        ? 'text-amber-700'
                                                        : 'text-slate-400',
                                                )}
                                            >
                                                {quantity(
                                                    item.quantity_remaining,
                                                    item.unit_name,
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </TableScroll>
                    )}
                </div>

                <footer className="flex justify-end border-t border-slate-200 bg-slate-50/60 px-6 py-3">
                    <DialogClose className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50">
                        Close
                    </DialogClose>
                </footer>
            </DialogContent>
        </Dialog>
    );
}
