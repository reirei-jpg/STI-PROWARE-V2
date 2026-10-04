<?php

namespace App\Http\Middleware;

use App\Services\NotificationRow;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user(),
            ],
            'notifications' => fn (): ?array => $this->notifications($request),
            'cart_count' => fn (): ?int => $request->user()?->isStudent() ? $request->user()->cartItems()->count() : null,
        ];
    }

    /**
     * The signed-in user's latest notifications for the bell in the top bar:
     * uploaded orders for the School Admin; delivery, stock, sale and new
     * order notices for the Specialist; order and preorder notices for a
     * student.
     *
     * The notification data is whatever the notification stored (see
     * PurchaseOrderUploaded and ExpectedDeliveryReminder), decoded from the
     * database.
     *
     * @return array{unread_count: int, recent: list<array{id: string, data: array<mixed>, read: bool, created_at: ?string}>}|null
     */
    private function notifications(Request $request): ?array
    {
        $user = $request->user();

        if ($user === null) {
            return null;
        }

        $recent = $user->notifications()
            ->latest()
            ->limit(10)
            ->get()
            ->map(NotificationRow::of(...))
            ->all();

        return [
            'unread_count' => $user->unreadNotifications()->count(),
            'recent' => array_values($recent),
        ];
    }
}
