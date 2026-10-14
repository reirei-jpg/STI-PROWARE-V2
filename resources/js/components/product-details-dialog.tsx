import { Link } from '@inertiajs/react';
import { Boxes, Flame, LoaderCircle, Package, Pencil, X } from 'lucide-react';
import type { ReactNode } from 'react';
import ProductController from '@/actions/App/Http/Controllers/ProductController';
import ProductStockController from '@/actions/App/Http/Controllers/ProductStockController';
import EndSaleButton from '@/components/end-sale-button';
import ProductStatusBadge from '@/components/product-status-badge';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDateOrdered, formatPeso } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ProductDetails, ProductListItem } from '@/types';

/**
 * A product's View Details popup on the Products list: its status, the
 * buttons to edit it, see its stock history and handle its sale, a row of
 * key numbers, and each size or color with its stock. No photo: Edit shows
 * it.
 */
export default function ProductDetailsDialog({
    product,
    details,
    onClose,
    onPutOnSale,
}: {
    /** The row that was opened; null when the popup is closed. */
    product: ProductListItem | null;
    /** Undefined while loading, null if it could not be found. */
    details: ProductDetails | null | undefined;
    onClose: () => void;
    onPutOnSale: (productId: number) => void;
}) {
    const canSell =
        product !== null &&
        (product.status === 'on_sale' ||
            (product.status === 'available' && product.stock_on_hand > 0));
    const hasOptions =
        details !== null &&
        details !== undefined &&
        details.variants.some((variant) => variant.label !== null);

    return (
        <Dialog
            open={product !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-3xl [&>button:last-child]:hidden">
                {product && (
                    <>
                        <header className="border-b border-slate-200 px-6 py-5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="text-xs font-black tracking-wide text-blue-600 uppercase">
                                        Product
                                    </p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <DialogTitle className="text-xl font-black text-slate-900">
                                            {product.name}
                                        </DialogTitle>
                                        <ProductStatusBadge
                                            status={product.status}
                                            label={product.status_label}
                                        />
                                    </div>
                                    <DialogDescription className="sr-only">
                                        Stock, price and actions for this
                                        product
                                    </DialogDescription>
                                </div>
                                <DialogClose className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                                    <X size={20} />
                                    <span className="sr-only">Close</span>
                                </DialogClose>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                                <Link
                                    href={ProductController.edit(product.id)}
                                    className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#0D6EFD] px-5 text-base font-black text-white shadow-sm transition hover:bg-blue-700"
                                >
                                    <Pencil size={18} />
                                    Edit
                                </Link>
                                <Link
                                    href={ProductStockController.index(
                                        product.id,
                                    )}
                                    className="inline-flex h-12 items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-base font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                                >
                                    <Boxes size={18} />
                                    Stock History
                                </Link>
                                {canSell && (
                                    <button
                                        type="button"
                                        onClick={() => onPutOnSale(product.id)}
                                        className="inline-flex h-12 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 text-base font-black text-red-700 transition hover:bg-red-100"
                                    >
                                        <Flame size={18} />
                                        {product.status === 'on_sale'
                                            ? 'Change sale'
                                            : 'Put on Sale'}
                                    </button>
                                )}
                                {product.status === 'on_sale' && (
                                    <EndSaleButton
                                        productId={product.id}
                                        productName={product.name}
                                        onEnded={onClose}
                                        className="h-12 px-5 text-base [&_svg]:size-[18px]"
                                    />
                                )}
                            </div>
                        </header>

                        <div className="overflow-y-auto">
                            <dl className="grid grid-cols-2 border-b border-slate-200 bg-slate-50/60 sm:grid-cols-4 sm:divide-x sm:divide-slate-100">
                                <Fact label="Student Price">
                                    <Price product={product} />
                                </Fact>
                                <Fact label="Stock">
                                    <span
                                        className={cn(
                                            product.low_stock &&
                                                'text-amber-700',
                                        )}
                                    >
                                        {product.stock_on_hand.toLocaleString(
                                            'en-PH',
                                        )}{' '}
                                        pcs
                                    </span>
                                    {product.low_stock && <LowDot />}
                                </Fact>
                                <Fact label="Low-stock warning">
                                    {details?.watched_for_low_stock === false
                                        ? 'Not watched'
                                        : `at ${product.low_stock_alert_at.toLocaleString('en-PH')} pcs${hasOptions ? ' each' : ''}`}
                                </Fact>
                                <Fact label="Updated">
                                    {product.updated_at
                                        ? formatDateOrdered(product.updated_at)
                                        : '—'}
                                </Fact>
                            </dl>

                            {product.sale_ends_at && (
                                <p className="mx-6 mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
                                    <b>On sale until</b>{' '}
                                    {formatDateOrdered(product.sale_ends_at)}
                                    {product.price_centavos !== null &&
                                        product.sale_price_centavos !== null &&
                                        !product.sale_by_variant && (
                                            <>
                                                {' · '}
                                                {formatPeso(
                                                    product.price_centavos,
                                                )}{' '}
                                                →{' '}
                                                <b>
                                                    {formatPeso(
                                                        product.sale_price_centavos,
                                                    )}
                                                </b>
                                            </>
                                        )}
                                </p>
                            )}

                            <div className="px-6 py-5">
                                <h3 className="text-xs font-black tracking-wide text-slate-500 uppercase">
                                    {hasOptions
                                        ? 'Stock per size / color'
                                        : 'Stock'}
                                </h3>
                                {details === undefined ? (
                                    <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-500">
                                        <LoaderCircle
                                            size={18}
                                            className="animate-spin text-blue-600"
                                        />
                                        Loading...
                                    </p>
                                ) : details === null ? (
                                    <p className="mt-3 text-sm text-slate-500">
                                        This product could not be found.
                                    </p>
                                ) : details.variants.length === 0 ? (
                                    <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                                        <Package size={16} />
                                        No sizes or colors yet.
                                    </p>
                                ) : (
                                    <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    <Heading>
                                                        {hasOptions
                                                            ? 'Size / Color'
                                                            : 'Item'}
                                                    </Heading>
                                                    <Heading right>
                                                        In stock
                                                    </Heading>
                                                    <Heading right>
                                                        Held for orders
                                                    </Heading>
                                                    <Heading right>
                                                        Free to sell
                                                    </Heading>
                                                    <Heading right>
                                                        Price
                                                    </Heading>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {details.variants.map(
                                                    (variant) => {
                                                        const isLow =
                                                            details.watched_for_low_stock &&
                                                            variant.free_to_sell <=
                                                                details.low_stock_alert_at;

                                                        return (
                                                            <tr
                                                                key={variant.id}
                                                            >
                                                                <td className="px-4 py-2.5 font-semibold text-slate-900">
                                                                    {variant.label ??
                                                                        product.name}
                                                                </td>
                                                                <NumberCell>
                                                                    {variant.stock_on_hand.toLocaleString(
                                                                        'en-PH',
                                                                    )}{' '}
                                                                    pcs
                                                                </NumberCell>
                                                                <NumberCell className="text-slate-500">
                                                                    {variant.held_pieces.toLocaleString(
                                                                        'en-PH',
                                                                    )}
                                                                </NumberCell>
                                                                <NumberCell
                                                                    className={cn(
                                                                        'font-black',
                                                                        isLow
                                                                            ? 'text-amber-700'
                                                                            : 'text-slate-900',
                                                                    )}
                                                                >
                                                                    {variant.free_to_sell.toLocaleString(
                                                                        'en-PH',
                                                                    )}{' '}
                                                                    pcs
                                                                    {isLow && (
                                                                        <LowDot />
                                                                    )}
                                                                </NumberCell>
                                                                <NumberCell>
                                                                    {variant.price_centavos ===
                                                                    null ? (
                                                                        '—'
                                                                    ) : variant.sale_price_centavos !==
                                                                      null ? (
                                                                        <>
                                                                            <span className="mr-1.5 text-xs text-slate-400 line-through">
                                                                                {formatPeso(
                                                                                    variant.price_centavos,
                                                                                )}
                                                                            </span>
                                                                            <span className="font-black text-red-600">
                                                                                {formatPeso(
                                                                                    variant.sale_price_centavos,
                                                                                )}
                                                                            </span>
                                                                        </>
                                                                    ) : (
                                                                        formatPeso(
                                                                            variant.price_centavos,
                                                                        )
                                                                    )}
                                                                </NumberCell>
                                                            </tr>
                                                        );
                                                    },
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>

                        <footer className="flex justify-end border-t border-slate-200 bg-slate-50/60 px-6 py-3">
                            <DialogClose className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50">
                                Close
                            </DialogClose>
                        </footer>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

/** The price per piece, with the sale price when On Sale. */
function Price({ product }: { product: ProductListItem }) {
    if (product.price_centavos === null) {
        return <>{product.packs_for_sale.length > 0 ? 'By the pack' : '—'}</>;
    }

    if (product.sale_price_centavos !== null) {
        return (
            <>
                {product.sale_by_variant ? (
                    <span className="mr-1 text-xs font-semibold text-slate-500">
                        from
                    </span>
                ) : (
                    <span className="mr-1.5 text-xs text-slate-400 line-through">
                        {formatPeso(product.price_centavos)}
                    </span>
                )}
                <span className="text-red-600">
                    {formatPeso(product.sale_price_centavos)}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                    {' '}
                    /pc
                </span>
            </>
        );
    }

    return (
        <>
            {formatPeso(product.price_centavos)}
            <span className="text-xs font-semibold text-slate-500"> /pc</span>
        </>
    );
}

function LowDot() {
    return (
        <span className="ml-1.5 inline-flex items-center gap-1 text-xs font-black text-amber-700">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Low
        </span>
    );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="px-6 py-4">
            <dt className="text-xs font-black tracking-wide text-slate-400 uppercase">
                {label}
            </dt>
            <dd className="mt-1 text-sm font-black text-slate-900">
                {children}
            </dd>
        </div>
    );
}

function Heading({
    right = false,
    children,
}: {
    right?: boolean;
    children: ReactNode;
}) {
    return (
        <th
            className={cn(
                'px-4 py-2.5 text-xs font-black tracking-wide whitespace-nowrap text-slate-500 uppercase',
                right ? 'text-right' : 'text-left',
            )}
        >
            {children}
        </th>
    );
}

function NumberCell({
    className,
    children,
}: {
    className?: string;
    children: ReactNode;
}) {
    return (
        <td
            className={cn(
                'px-4 py-2.5 text-right whitespace-nowrap tabular-nums',
                className,
            )}
        >
            {children}
        </td>
    );
}
