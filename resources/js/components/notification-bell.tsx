import { router, usePage } from '@inertiajs/react';
import { Bell, ClipboardList } from 'lucide-react';
import NotificationController from '@/actions/App/Http/Controllers/NotificationController';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDateOrdered, formatDateTime, formatPeso } from '@/lib/format';

/**
 * The School Admin's bell (as in V1): a red count of unread notifications
 * and a list of the latest ones. Opening one shows that purchase order.
 */
export default function NotificationBell() {
    const { notifications } = usePage().props;

    if (!notifications) {
        return null;
    }

    const { unread_count: unreadCount, recent } = notifications;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    title="Notifications"
                    className="relative flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition outline-none hover:bg-blue-50 hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-300"
                    data-test="notification-bell"
                >
                    <Bell size={20} />
                    <span className="sr-only">Notifications</span>
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-black text-white">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align="end"
                className="w-96 overflow-hidden rounded-2xl border-slate-200 p-0 shadow-xl shadow-slate-900/10"
            >
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                    <div>
                        <h3 className="font-black text-slate-900">
                            Notifications
                        </h3>
                        <p className="text-xs text-slate-500">
                            {unreadCount === 0
                                ? 'You are all caught up'
                                : `${unreadCount} unread`}
                        </p>
                    </div>

                    {unreadCount > 0 && (
                        <button
                            type="button"
                            onClick={() =>
                                router.post(
                                    NotificationController.readAll().url,
                                    {},
                                    { preserveScroll: true },
                                )
                            }
                            className="rounded-lg px-2 py-1 text-xs font-bold text-blue-700 transition hover:bg-blue-50"
                        >
                            Mark all read
                        </button>
                    )}
                </div>

                {recent.length === 0 ? (
                    <div className="px-5 py-10 text-center">
                        <ClipboardList
                            size={36}
                            className="mx-auto text-slate-300"
                        />
                        <p className="mt-3 text-sm font-semibold text-slate-600">
                            No notifications yet
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                            You will be notified here when the Specialist
                            uploads a purchase order.
                        </p>
                    </div>
                ) : (
                    <div className="max-h-96 overflow-y-auto p-2">
                        {recent.map((notification) => (
                            <DropdownMenuItem
                                key={notification.id}
                                onSelect={() =>
                                    router.post(
                                        NotificationController.open(
                                            notification.id,
                                        ).url,
                                    )
                                }
                                className={`flex cursor-pointer items-start gap-3 rounded-xl px-3 py-3 ${
                                    notification.read
                                        ? 'focus:bg-slate-50'
                                        : 'bg-blue-50/70 focus:bg-blue-50'
                                }`}
                            >
                                <span
                                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                                        notification.read
                                            ? 'bg-slate-300'
                                            : 'bg-blue-600'
                                    }`}
                                />
                                <span className="min-w-0">
                                    <span className="block text-sm font-bold text-slate-900">
                                        New purchase order uploaded
                                    </span>
                                    <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                                        {notification.data.uploaded_by} uploaded
                                        {notification.data.order_number
                                            ? ` Order #${notification.data.order_number}, dated `
                                            : ' an order dated '}
                                        {formatDateOrdered(
                                            notification.data.date_ordered,
                                        )}{' '}
                                        ·{' '}
                                        {formatPeso(
                                            notification.data
                                                .total_amount_centavos,
                                        )}{' '}
                                        · {notification.data.items_count}{' '}
                                        {notification.data.items_count === 1
                                            ? 'item'
                                            : 'items'}
                                    </span>
                                    <span className="mt-1 block text-[11px] text-slate-400">
                                        {formatDateTime(
                                            notification.created_at,
                                        )}
                                    </span>
                                </span>
                            </DropdownMenuItem>
                        ))}
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
