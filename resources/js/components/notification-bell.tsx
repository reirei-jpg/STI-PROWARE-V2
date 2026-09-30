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
import type { StaffNotification } from '@/types';

/**
 * The staff bell (as in V1): a red count of unread notifications and a list
 * of the latest ones — uploaded orders for the School Admin, delivery
 * reminders for the Specialist. Opening one shows that purchase order.
 */
export default function NotificationBell() {
    const { notifications, auth } = usePage().props;

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
                            {auth.user.role === 'specialist'
                                ? 'You will be reminded here the day before and on the day of an expected delivery.'
                                : 'You will be notified here when the Specialist uploads a purchase order.'}
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
                                    <NotificationText
                                        data={notification.data}
                                    />
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

function NotificationText({ data }: { data: StaffNotification['data'] }) {
    if (data.kind === 'delivery_reminder') {
        return (
            <>
                <span className="block text-sm font-bold text-slate-900">
                    Delivery expected {data.when}
                    {data.order_number ? `: Order #${data.order_number}` : ''}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                    {data.percent_received}% received so far ·{' '}
                    {data.quantity_remaining.toLocaleString('en-PH')} still to
                    come
                    {data.expected_delivery_date
                        ? ` · ${formatDateOrdered(data.expected_delivery_date)}`
                        : ''}
                </span>
            </>
        );
    }

    return (
        <>
            <span className="block text-sm font-bold text-slate-900">
                New purchase order uploaded
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                {data.uploaded_by} uploaded
                {data.order_number
                    ? ` Order #${data.order_number}, dated `
                    : ' an order dated '}
                {formatDateOrdered(data.date_ordered)} ·{' '}
                {formatPeso(data.total_amount_centavos)} · {data.items_count}{' '}
                {data.items_count === 1 ? 'item' : 'items'}
            </span>
        </>
    );
}
