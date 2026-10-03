<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * The in-app notifications (the bell in the top bar).
 */
class NotificationController extends Controller
{
    /**
     * Open a notification: mark it read and show what it is about: the
     * product's Stock History for a low-stock notice, the product on the
     * Products list for a sale notice, the order on the Orders page for a
     * new order, My Orders for the student's order notices, the item on the
     * storefront when a preorder arrived, otherwise the purchase order with
     * its details window already open.
     */
    public function open(Request $request, string $notification): RedirectResponse
    {
        $notification = $request->user()->notifications()->findOrFail($notification);
        $notification->markAsRead();

        return match ($notification->data['kind'] ?? null) {
            'low_stock' => to_route('products.stock', $notification->data['product_id']),
            'sale_ending', 'sale_ended' => to_route('products.index', ['search' => $notification->data['product_name']]),
            'order_placed' => to_route('orders.index', ['show' => 'all', 'search' => $notification->data['order_number']]),
            'order_ready', 'order_cancelled' => to_route('my-orders.index'),
            'preorder_arrived' => to_route('home', ['search' => $notification->data['product_name']]),
            default => to_route('purchase-orders.index', ['view' => $notification->data['purchase_order_id'] ?? null]),
        };
    }

    /**
     * Mark every notification of the signed-in user as read.
     */
    public function readAll(Request $request): RedirectResponse
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return back();
    }
}
