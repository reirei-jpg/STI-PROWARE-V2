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
     * product's Stock History for a low-stock notice, otherwise the purchase
     * order with its details window already open.
     */
    public function open(Request $request, string $notification): RedirectResponse
    {
        $notification = $request->user()->notifications()->findOrFail($notification);
        $notification->markAsRead();

        if (($notification->data['kind'] ?? null) === 'low_stock') {
            return to_route('products.stock', $notification->data['product_id']);
        }

        return to_route('purchase-orders.index', ['view' => $notification->data['purchase_order_id'] ?? null]);
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
