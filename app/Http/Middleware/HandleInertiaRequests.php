<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
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
        ];
    }

    /**
     * The School Admin's latest notifications for the bell in the top bar.
     *
     * The notification data is whatever the notification stored (see
     * PurchaseOrderUploaded::toArray()), decoded from the database.
     *
     * @return array{unread_count: int, recent: list<array{id: string, data: array<mixed>, read: bool, created_at: ?string}>}|null
     */
    private function notifications(Request $request): ?array
    {
        $user = $request->user();

        if ($user === null || ! $user->isSchoolAdmin()) {
            return null;
        }

        $recent = $user->notifications()
            ->latest()
            ->limit(10)
            ->get()
            ->map(fn (DatabaseNotification $notification): array => [
                'id' => $notification->id,
                'data' => $notification->data,
                'read' => $notification->read_at !== null,
                'created_at' => $notification->created_at?->toIso8601String(),
            ])
            ->all();

        return [
            'unread_count' => $user->unreadNotifications()->count(),
            'recent' => array_values($recent),
        ];
    }
}
