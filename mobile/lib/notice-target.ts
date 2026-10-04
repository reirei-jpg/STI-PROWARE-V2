import type { Href } from 'expo-router';

/**
 * The screen a notice opens, for both a tapped push and a notice tapped in
 * Notifications. Push data arrives as strings, so ids are read as numbers.
 * Null means there is nothing to open on the phone (sales and deliveries
 * are handled on the website).
 */
export function noticeTarget(data: Record<string, unknown>): Href | null {
    const orderId = Number(data.order_id);
    const productId = Number(data.product_id);
    const hasOrder = Number.isInteger(orderId) && orderId > 0;
    const hasProduct = Number.isInteger(productId) && productId > 0;

    switch (data.kind) {
        case 'order_ready':
        case 'order_cancelled':
            return hasOrder ? `/order/${orderId}` : null;
        case 'preorder_arrived':
            return hasProduct ? `/product/${productId}` : null;
        case 'order_placed':
            return hasOrder ? `/staff-order/${orderId}` : null;
        case 'low_stock':
            return hasProduct ? `/stock/${productId}` : null;
        default:
            return null;
    }
}
