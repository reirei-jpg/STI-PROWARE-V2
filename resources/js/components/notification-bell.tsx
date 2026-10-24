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
import { formatUnits } from '@/lib/units';
import type { StaffNotification } from '@/types';

/**
 * The bell (as in V1): a red count of unread notifications and a list of
 * the latest ones — uploaded orders for the School Admin; deliveries, stock,
 * sales and new student orders for the Specialist; order and preorder
 * notices for a student (in the storefront top bar). Opening one shows what
 * it is about.
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
                    className="relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition outline-none hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-300"
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
                                ? 'You will be notified here when stock runs low or a sale is ending.'
                                : auth.user.role === 'student'
                                  ? 'You will be notified here when your order is ready for pickup, or when an item you preordered arrives.'
                                  : 'You will be notified here when the Specialist uploads a purchase order, records a delivery, or closes an order short.'}
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
    if (data.kind === 'delivery_recorded') {
        return (
            <>
                <span className="block text-sm font-bold text-emerald-700">
                    Delivery recorded
                    {data.order_numbers.length > 0 &&
                        `: Order ${data.order_numbers.map((number) => `#${number}`).join(', ')}`}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                    {data.quantity_received.toLocaleString('en-PH')} received
                    (as ordered on the eStore) · {data.items_count}{' '}
                    {data.items_count === 1 ? 'item' : 'items'} · received{' '}
                    {formatDateOrdered(data.received_on)}
                    {data.sales_invoice_number &&
                        ` · SI # ${data.sales_invoice_number}`}
                    {data.delivery_receipt_number &&
                        ` · DR # ${data.delivery_receipt_number}`}{' '}
                    · by {data.recorded_by}
                </span>
            </>
        );
    }

    if (data.kind === 'purchase_order_completed') {
        return (
            <>
                <span className="block text-sm font-bold text-emerald-700">
                    Order completed
                    {data.order_number ? `: Order #${data.order_number}` : ''}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                    Everything arrived (
                    {data.quantity_received.toLocaleString('en-PH')} as ordered
                    on the eStore) · ordered{' '}
                    {formatDateOrdered(data.date_ordered)}, completed{' '}
                    {formatDateTime(data.completed_at)}
                    {data.completed_after_days === 0
                        ? ' (the same day)'
                        : ` (${data.completed_after_days} ${data.completed_after_days === 1 ? 'day' : 'days'})`}{' '}
                    · by {data.recorded_by}
                </span>
            </>
        );
    }

    if (data.kind === 'purchase_order_late') {
        return (
            <>
                <span className="block text-sm font-bold text-red-700">
                    Order late
                    {data.order_number ? `: Order #${data.order_number}` : ''}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                    Not complete after {data.late_days} days · ordered{' '}
                    {formatDateOrdered(data.date_ordered)} ·{' '}
                    {data.quantity_received.toLocaleString('en-PH')} of{' '}
                    {data.quantity_ordered.toLocaleString('en-PH')} received (
                    {data.percent_received}%)
                </span>
            </>
        );
    }

    if (data.kind === 'purchase_order_reminder') {
        return (
            <>
                <span className="block text-sm font-bold text-red-700">
                    Reminder from the School Admin
                    {data.order_number ? `: Order #${data.order_number}` : ''}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                    Not complete after {data.late_days} days (ordered{' '}
                    {formatDateOrdered(data.date_ordered)}):{' '}
                    {data.quantity_remaining.toLocaleString('en-PH')} of{' '}
                    {data.quantity_ordered.toLocaleString('en-PH')} still to
                    come. Why is it not delivered yet? Ask Head Office and
                    record the delivery when it arrives. · from{' '}
                    {data.reminded_by}
                </span>
            </>
        );
    }

    if (data.kind === 'purchase_order_closed_short') {
        return (
            <>
                <span className="block text-sm font-bold text-amber-800">
                    Completed (some missing)
                    {data.order_number ? `: Order #${data.order_number}` : ''}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                    "{data.reason}" · {data.percent_received}% received
                    {data.closed_by && ` · by ${data.closed_by}`}
                </span>
            </>
        );
    }

    if (data.kind === 'order_placed') {
        return (
            <>
                <span className="block text-sm font-bold text-slate-900">
                    New order {data.order_number}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                    {data.student_name} · {data.items_count}{' '}
                    {data.items_count === 1 ? 'item' : 'items'} ·{' '}
                    {formatPeso(data.total_centavos)} to pay at the cashier.
                    Prepare it, then mark it Ready for pickup.
                </span>
            </>
        );
    }

    if (data.kind === 'order_ready') {
        return (
            <>
                <span className="block text-sm font-bold text-emerald-700">
                    Order {data.order_number} is ready for pickup
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                    Pay {formatPeso(data.total_centavos)} at the cashier, then
                    show the receipt and the issuance slip at the PROWARE office
                    {data.pick_up_by
                        ? ` by ${formatDateOrdered(data.pick_up_by)}`
                        : ''}
                    .
                </span>
            </>
        );
    }

    if (data.kind === 'order_last_day') {
        return (
            <>
                <span className="block text-sm font-bold text-red-700">
                    Last day to get order {data.order_number}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                    Pay {formatPeso(data.total_centavos)} at the cashier and
                    show the receipt and the issuance slip at the PROWARE office
                    today. After today it expires and the items go back on sale.
                </span>
            </>
        );
    }

    if (data.kind === 'order_cancelled') {
        return (
            <>
                <span className="block text-sm font-bold text-red-700">
                    Order {data.order_number} was cancelled
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                    {data.reason ?? 'Ask the PROWARE office.'}
                </span>
            </>
        );
    }

    if (data.kind === 'preorder_arrived') {
        return (
            <>
                <span className="block text-sm font-bold text-amber-800">
                    {data.variant_label
                        ? `Back in stock: ${data.product_name} (${data.variant_label})`
                        : `Your preordered item is here: ${data.product_name}`}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                    You can now add it to your cart and order it. It is not held
                    for you, so order soon.
                </span>
            </>
        );
    }

    if (data.kind === 'preorder_not_restocked') {
        return (
            <>
                <span className="block text-sm font-bold text-red-700">
                    Not restocked: {data.product_name}
                    {data.variant_label && ` (${data.variant_label})`}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                    It will not be restocked, so your preorder has been closed.
                    {data.reason && ` Reason: ${data.reason}`}
                </span>
            </>
        );
    }

    if (data.kind === 'preorder_held') {
        return (
            <>
                <span className="block text-sm font-bold text-emerald-700">
                    Your preorder has arrived: {data.product_name}
                    {data.variant_label && ` (${data.variant_label})`}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                    {data.held === data.preordered
                        ? `${formatUnits(data.held, 'Piece')} held for you`
                        : `${data.held} of your ${formatUnits(data.preordered, 'Piece')} arrived and are held for you`}{' '}
                    until {formatDateTime(data.held_until)}. Order in My
                    Preorders before then.
                </span>
            </>
        );
    }

    if (data.kind === 'preorder_hold_ended') {
        return (
            <>
                <span className="block text-sm font-bold text-slate-700">
                    Your hold has ended: {data.product_name}
                    {data.variant_label && ` (${data.variant_label})`}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                    The {formatUnits(data.held, 'Piece')} held for you were not
                    ordered within 24 hours, so they went to the next student.
                    {(data.rest_closed ?? 0) > 0 &&
                        ` The other ${formatUnits(data.rest_closed ?? 0, 'Piece')} of this preorder will not be held for you either.`}
                </span>
            </>
        );
    }

    if (data.kind === 'preorder_arrival_changed') {
        return (
            <>
                <span className="block text-sm font-bold text-amber-800">
                    New expected arrival: {data.product_name}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                    Your preorder is now expected to arrive{' '}
                    {data.expected_arrival}.
                    {data.before && ` It was expected ${data.before}.`}
                </span>
            </>
        );
    }

    if (data.kind === 'preorder_placed') {
        return (
            <>
                <span className="block text-sm font-bold text-amber-800">
                    New preorder: {data.product_name}
                    {data.variant_label && ` (${data.variant_label})`}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                    {data.student_name} preordered{' '}
                    {formatUnits(data.quantity, 'Piece')}. It is out of stock.
                    Order more in the eStore, or mark it as not restocked on
                    Preorders.
                </span>
            </>
        );
    }

    if (data.kind === 'ordering_resumed') {
        return (
            <>
                <span className="block text-sm font-bold text-emerald-700">
                    You can order again
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                    The PROWARE office lifted your ordering pause. You can place
                    orders now.
                </span>
            </>
        );
    }

    if (data.kind === 'ordering_paused') {
        return (
            <>
                <span className="block text-sm font-bold text-red-700">
                    Ordering is paused until{' '}
                    {formatDateOrdered(data.paused_until)}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                    {data.expired_orders} of your orders expired without being
                    picked up, so you cannot place orders until then. Ask the
                    PROWARE office if this is a mistake.
                </span>
            </>
        );
    }

    if (data.kind === 'order_cancelled_by_student') {
        return (
            <>
                <span className="block text-sm font-bold text-red-700">
                    Order {data.order_number} was cancelled by the student
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                    {data.student_name}: {data.reason ?? 'No reason given.'} Its
                    items are free to sell again.
                </span>
            </>
        );
    }

    if (data.kind === 'sale_ending') {
        return (
            <>
                <span className="block text-sm font-bold text-red-700">
                    Sale ending tomorrow: {data.product_name}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                    Ends {formatDateTime(data.ends_at)}. Open it to extend the
                    sale, or let it go back to its normal price.
                </span>
            </>
        );
    }

    if (data.kind === 'sale_ended') {
        return (
            <>
                <span className="block text-sm font-bold text-slate-900">
                    Sale ended: {data.product_name}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                    It is back to {data.normal_price}.
                </span>
            </>
        );
    }

    if (data.kind === 'low_stock') {
        return (
            <>
                <span
                    className={`block text-sm font-bold ${data.stock_on_hand === 0 ? 'text-red-700' : 'text-amber-800'}`}
                >
                    {data.stock_on_hand === 0 ? 'Out of stock' : 'Low stock'}:{' '}
                    {data.product_name}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                    {formatUnits(data.stock_on_hand, 'Piece')} left · you are
                    warned at {formatUnits(data.alert_at, 'Piece')}. Order more
                    in the eStore.
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
