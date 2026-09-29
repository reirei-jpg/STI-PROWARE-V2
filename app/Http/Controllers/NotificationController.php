<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * The School Admin's in-app notifications (the bell in the top bar).
 */
class NotificationController extends Controller
{
    /**
     * Open a notification: mark it read and show the purchase order it is
     * about, with its details window already open.
     */
    public function open(Request $request, string $notification): RedirectResponse
    {
        $notification = $request->user()->notifications()->findOrFail($notification);
        $notification->markAsRead();

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
