import type { Href } from 'expo-router';

/**
 * The screen a notice opens, for both a tapped push and a notice tapped in
 * Notifications. Push data arrives as strings, so ids are read as numbers.
 * Null means there is nothing to open on the phone (sales are handled on
 * the website). A School Admin's reminder about a late order opens
 * Deliveries, where the Specialist records it when it arrives.
 */
export function noticeTarget(data: Record<string, unknown>): Href | null {
    const orderId = Number(data.order_id);
    const productId = Number(data.product_id);
    const hasOrder = Number.isInteger(orderId) && orderId > 0;
    const hasProduct = Number.isInteger(productId) && productId > 0;

    switch (data.kind) {
        case 'order_ready':
        case 'order_last_day':
        case 'order_cancelled':
            return hasOrder ? `/order/${orderId}` : null;
        case 'preorder_arrived':
            return hasProduct ? `/product/${productId}` : null;
        case 'preorder_not_restocked':
        case 'preorder_arrival_changed':
        case 'preorder_held':
        case 'preorder_hold_ended':
            return '/orders?show=preorders';
        case 'preorder_placed':
            return hasProduct ? `/stock/${productId}` : null;
        case 'ordering_resumed':
            return '/';
        case 'ordering_paused':
            return '/orders';
        case 'order_cancelled_by_student':
        case 'order_placed':
            return hasOrder ? `/staff-order/${orderId}` : null;
        case 'low_stock':
            return hasProduct ? `/stock/${productId}` : null;
        case 'purchase_order_reminder':
            return '/staff-deliveries';
        default:
            return null;
    }
}
