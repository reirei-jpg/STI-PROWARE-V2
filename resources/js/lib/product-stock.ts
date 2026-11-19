/**
 * A product in the store (Available or On Sale) with no pieces left at all:
 * shown as "Out of stock", not as "0 pcs" with a Low warning.
 */
export function isOutOfStock(product: {
    status: string;
    stock_on_hand: number;
}): boolean {
    return (
        (product.status === 'available' || product.status === 'on_sale') &&
        product.stock_on_hand === 0
    );
}
