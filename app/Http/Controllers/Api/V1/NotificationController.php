<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\NotificationRow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The student's notifications on the phone app (order ready, order
 * cancelled, preorder arrived), the same ones as the website's bell.
 */
class NotificationController extends Controller
{
    /**
     * Newest first, 20 at a time, with how many are unread.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $page = $user->notifications()
            ->latest()
            ->paginate(20)
            ->through(NotificationRow::of(...));

        return response()->json([
            ...$page->toArray(),
            'unread_count' => $user->unreadNotifications()->count(),
        ]);
    }

    public function read(Request $request, string $notification): JsonResponse
    {
        $request->user()->notifications()->findOrFail($notification)->markAsRead();

        return response()->json(['unread_count' => $request->user()->unreadNotifications()->count()]);
    }

    public function readAll(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->json(['unread_count' => 0]);
    }
}
