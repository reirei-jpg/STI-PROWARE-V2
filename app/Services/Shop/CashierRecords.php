<?php

namespace App\Services\Shop;

use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PreorderStatus;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PreorderSlip;
use App\Models\User;
use App\Services\Preorders\PreorderPayment;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * The cashier's records, the same on the website and the phone: Payment
 * Receipts, Payment History, Collections and the daily collection report,
 * the dashboard, and the slips awaiting payment. Built only from payments
 * recorded by the cashier (the record starts with the cashier role); a void
 * payment is listed but never counted. Cashier data: the Specialist never
 * reads it; the School Admin only views it.
 *
 * @phpstan-type PaymentRow array{id: int, receipt_number: string|null, kind: string, number: string|null, buyer_name: string, buyer_id: string|null, is_staff: bool, amount_centavos: int, method: string, method_label: string, amount_received_centavos: int|null, change_centavos: int|null, gcash_reference: string|null, paid_at: string, cashier: string|null, void: bool, voided_at: string|null, voided_by: string|null, void_reason: string|null, released: bool}
 * @phpstan-type AwaitingRow array{kind: string, id: int, number: string|null, buyer_name: string, buyer_id: string|null, is_staff: bool, for: string, amount_centavos: int, since: string|null, pay_until: string|null}
 * @phpstan-type Totals array{count: int, total_centavos: int, cash_count: int, cash_centavos: int, gcash_count: int, gcash_centavos: int, void_count: int, void_centavos: int}
 * @phpstan-type Filters array{period: string, date_from: string, date_to: string, method: string, type: string, status: string, search: string, group: string}
 */
final class CashierRecords
{
    public const PER_PAGE = 20;

    public const NOT_OFFICIAL = 'This is not an official receipt or sales invoice. Keep it as proof of your payment to PROWARE.';

    /**
     * A Payment Receipt as printed and shown: the school, the receipt number,
     * who paid for what, how, who received it, and whether it is VOID.
     *
     * @return array{school: string, address_lines: list<string>, row: PaymentRow, for_label: string, section: string|null, lines: list<array{quantity: int, item: string, unit_price_centavos: int, amount_centavos: int}>, prints: int, note: string}
     */
    public static function receipt(Payment $payment): array
    {
        $payment->loadMissing(['order', 'preorderSlip', 'cashier', 'voider', 'buyer']);
        $snapshot = $payment->snapshot;

        return [
            'school' => IssuanceSlip::SCHOOL,
            'address_lines' => IssuanceSlip::ADDRESS_LINES,
            'row' => self::row($payment),
            'for_label' => ($payment->order_id !== null ? 'Order ' : 'Preorder slip ').($snapshot['number'] ?? ''),
            'section' => $snapshot['section'] ?? null,
            'lines' => $snapshot['lines'],
            'prints' => $payment->prints,
            'note' => self::NOT_OFFICIAL,
        ];
    }

    /**
     * The buyer's link to the Payment Receipt of an order or preorder slip:
     * the standing one, or the latest void one; null when none was issued.
     *
     * @return array{id: int, receipt_number: string|null, void: bool}|null
     */
    public static function receiptLinkFor(Order|PreorderSlip $paid): ?array
    {
        $payment = Payment::query()
            ->where($paid instanceof Order ? 'order_id' : 'preorder_slip_id', $paid->id)
            ->orderByRaw('case when voided_at is null then 0 else 1 end')
            ->latest('id')
            ->first();

        return $payment === null ? null : ['id' => $payment->id, 'receipt_number' => $payment->receipt_number, 'void' => $payment->isVoid()];
    }

    /**
     * @return PaymentRow
     */
    public static function row(Payment $payment): array
    {
        $snapshot = $payment->snapshot;

        return [
            'id' => $payment->id,
            'receipt_number' => $payment->receipt_number,
            'kind' => $payment->order_id !== null ? 'order' : 'preorder',
            'number' => $snapshot['number'] ?? null,
            'buyer_name' => $snapshot['buyer_name'],
            'buyer_id' => $snapshot['buyer_id'] ?? null,
            'is_staff' => $snapshot['is_staff'],
            'amount_centavos' => $payment->amount_centavos,
            'method' => $payment->method->value,
            'method_label' => $payment->method->label(),
            'amount_received_centavos' => $payment->amount_received_centavos,
            'change_centavos' => $payment->change_centavos,
            'gcash_reference' => $payment->gcash_reference,
            'paid_at' => $payment->paid_at->toIso8601String(),
            'cashier' => $payment->cashier?->name,
            'void' => $payment->isVoid(),
            'voided_at' => $payment->voided_at?->toIso8601String(),
            'voided_by' => $payment->voider?->name,
            'void_reason' => $payment->void_reason,
            'released' => self::released($payment),
        ];
    }

    /**
     * Payments matching the filters: the period, the method, Order or
     * Preorder, Paid or Void, and the search (receipt, slip number, buyer
     * name or ID, GCash reference).
     *
     * @param  Filters  $filters
     * @return Builder<Payment>
     */
    public static function query(array $filters): Builder
    {
        $from = CarbonImmutable::parse($filters['date_from'])->startOfDay();
        $to = CarbonImmutable::parse($filters['date_to'])->endOfDay();
        $search = $filters['search'];

        return Payment::query()
            ->whereBetween('paid_at', [$from, $to])
            ->when($filters['method'] !== '', fn (Builder $query) => $query->where('method', $filters['method']))
            ->when($filters['type'] === 'order', fn (Builder $query) => $query->whereNotNull('order_id'))
            ->when($filters['type'] === 'preorder', fn (Builder $query) => $query->whereNotNull('preorder_slip_id'))
            ->when($filters['status'] === 'paid', fn (Builder $query) => $query->whereNull('voided_at'))
            ->when($filters['status'] === 'void', fn (Builder $query) => $query->whereNotNull('voided_at'))
            ->when($search !== '', fn (Builder $query) => $query->where(function (Builder $query) use ($search): void {
                $like = '%'.mb_strtolower($search).'%';
                $digits = (string) preg_replace('/\D+/', '', $search);
                $query->whereRaw('lower(receipt_number) like ?', [$like])
                    ->orWhereHas('order', fn (Builder $order) => $order->whereRaw('lower(number) like ?', [$like]))
                    ->orWhereHas('preorderSlip', fn (Builder $slip) => $slip->whereRaw('lower(number) like ?', [$like]))
                    ->orWhereHas('buyer', fn (Builder $buyer) => self::buyerMatches($buyer, $like))
                    // A GCash reference is found by its digits (typed with or without spaces).
                    ->when(strlen($digits) >= 4, fn (Builder $query) => $query->orWhere('gcash_reference', 'like', "%{$digits}%"));
            }));
    }

    /**
     * A buyer whose name, Student ID or Employee ID contains the search.
     *
     * @param  Builder<User>  $buyer
     * @return Builder<User>
     */
    private static function buyerMatches(Builder $buyer, string $like): Builder
    {
        return $buyer->where(fn (Builder $buyer) => $buyer->whereRaw('lower(name) like ?', [$like])
            ->orWhereRaw("lower(coalesce(student_id, '')) like ?", [$like])
            ->orWhereRaw("lower(coalesce(employee_id, '')) like ?", [$like]));
    }

    /**
     * Payment History: the latest first, 20 a page, with the totals of every
     * payment matching the filters (not only this page).
     *
     * @param  Filters  $filters
     * @return array{payments: LengthAwarePaginator<int, PaymentRow>, totals: Totals}
     */
    public static function history(array $filters): array
    {
        $payments = self::query($filters)
            ->with(['cashier', 'voider', 'buyer', 'order', 'preorderSlip.preorders'])
            ->latest('paid_at')
            ->latest('id')
            ->paginate(self::PER_PAGE)
            ->withQueryString()
            ->through(fn (Payment $payment): array => self::row($payment));

        return ['payments' => $payments, 'totals' => self::totals(self::query($filters))];
    }

    /**
     * What the payments add up to: the standing ones by method, the void ones apart.
     *
     * @param  Builder<Payment>  $payments
     * @return Totals
     */
    public static function totals(Builder $payments): array
    {
        $sums = $payments->toBase()
            ->selectRaw('coalesce(sum(case when voided_at is null then 1 else 0 end), 0) as count')
            ->selectRaw('coalesce(sum(case when voided_at is null then amount_centavos else 0 end), 0) as total')
            ->selectRaw("coalesce(sum(case when voided_at is null and method = 'cash' then 1 else 0 end), 0) as cash_count")
            ->selectRaw("coalesce(sum(case when voided_at is null and method = 'cash' then amount_centavos else 0 end), 0) as cash")
            ->selectRaw("coalesce(sum(case when voided_at is null and method = 'gcash' then 1 else 0 end), 0) as gcash_count")
            ->selectRaw("coalesce(sum(case when voided_at is null and method = 'gcash' then amount_centavos else 0 end), 0) as gcash")
            ->selectRaw('coalesce(sum(case when voided_at is not null then 1 else 0 end), 0) as void_count')
            ->selectRaw('coalesce(sum(case when voided_at is not null then amount_centavos else 0 end), 0) as void_total')
            ->first();

        return [
            'count' => (int) ($sums->count ?? 0),
            'total_centavos' => (int) ($sums->total ?? 0),
            'cash_count' => (int) ($sums->cash_count ?? 0),
            'cash_centavos' => (int) ($sums->cash ?? 0),
            'gcash_count' => (int) ($sums->gcash_count ?? 0),
            'gcash_centavos' => (int) ($sums->gcash ?? 0),
            'void_count' => (int) ($sums->void_count ?? 0),
            'void_centavos' => (int) ($sums->void_total ?? 0),
        ];
    }

    /**
     * Collections: the totals of the period, and one row a day or a month
     * (only days or months with payments), the latest first.
     *
     * @param  Filters  $filters
     * @return array{totals: Totals, rows: list<array{period: string, label: string, count: int, total_centavos: int, cash_centavos: int, gcash_centavos: int, void_count: int}>}
     */
    public static function collections(array $filters): array
    {
        $byMonth = $filters['group'] === 'month';
        $rows = [];

        self::query($filters)->orderBy('paid_at')->each(function (Payment $payment) use (&$rows, $byMonth): void {
            $key = $byMonth ? $payment->paid_at->format('Y-m') : $payment->paid_at->toDateString();
            $rows[$key] ??= [
                'period' => $key,
                'label' => $byMonth ? $payment->paid_at->format('F Y') : $payment->paid_at->format('M j, Y (D)'),
                'count' => 0, 'total_centavos' => 0, 'cash_centavos' => 0, 'gcash_centavos' => 0, 'void_count' => 0,
            ];

            if ($payment->isVoid()) {
                $rows[$key]['void_count']++;

                return;
            }

            $rows[$key]['count']++;
            $rows[$key]['total_centavos'] += $payment->amount_centavos;
            $rows[$key][$payment->method === PaymentMethod::Cash ? 'cash_centavos' : 'gcash_centavos'] += $payment->amount_centavos;
        });

        return ['totals' => self::totals(self::query($filters)), 'rows' => array_values(array_reverse($rows))];
    }

    /**
     * The daily collection report: the day's totals by method, every
     * standing receipt (the earliest first) and the void ones apart.
     *
     * @return array{date: string, totals: Totals, receipts: list<PaymentRow>, voided: list<PaymentRow>}
     */
    public static function daily(CarbonImmutable $day): array
    {
        $filters = ['period' => 'custom', 'date_from' => $day->toDateString(), 'date_to' => $day->toDateString(), 'method' => '', 'type' => '', 'status' => '', 'search' => '', 'group' => 'day'];
        $payments = self::query($filters)->with(['cashier', 'voider', 'buyer', 'order', 'preorderSlip.preorders'])->orderBy('paid_at')->orderBy('id')->get();

        return [
            'date' => $day->toDateString(),
            'totals' => self::totals(self::query($filters)),
            'receipts' => array_values($payments->reject(fn (Payment $payment): bool => $payment->isVoid())->map(fn (Payment $payment): array => self::row($payment))->all()),
            'voided' => array_values($payments->filter(fn (Payment $payment): bool => $payment->isVoid())->map(fn (Payment $payment): array => self::row($payment))->all()),
        ];
    }

    /**
     * What the cashier sees on opening the account: today's collections by
     * method, what is awaiting payment, today's void payments, the latest
     * payments and the slips waiting the longest.
     *
     * @return array{today: Totals, awaiting: array{orders: int, slips: int, total_centavos: int}, latest: list<PaymentRow>, oldest_awaiting: list<AwaitingRow>}
     */
    public static function dashboard(): array
    {
        $today = CarbonImmutable::today()->toDateString();
        $filters = ['period' => 'today', 'date_from' => $today, 'date_to' => $today, 'method' => '', 'type' => '', 'status' => '', 'search' => '', 'group' => 'day'];
        $awaitingOrders = self::awaitingOrdersQuery('');
        $awaitingSlips = self::awaitingSlipsQuery('')->with(['student', 'product'])->get();

        return [
            'today' => self::totals(self::query($filters)),
            'awaiting' => [
                'orders' => (clone $awaitingOrders)->count(),
                'slips' => $awaitingSlips->count(),
                'total_centavos' => (int) (clone $awaitingOrders)->sum('total_centavos') + (int) $awaitingSlips->sum(fn (PreorderSlip $slip): int => $slip->amountDue()),
            ],
            'latest' => array_values(self::query($filters)
                ->with(['cashier', 'voider', 'buyer', 'order', 'preorderSlip.preorders'])
                ->latest('paid_at')->latest('id')->limit(5)->get()
                ->map(fn (Payment $payment): array => self::row($payment))->all()),
            'oldest_awaiting' => array_values($awaitingOrders->with('student')->oldest('created_at')->oldest('id')->limit(5)->get()
                ->map(fn (Order $order): array => self::awaitingOrderRow($order))->all()),
        ];
    }

    /**
     * Orders awaiting payment, the oldest first, 20 a page; search by order
     * number, buyer name or ID.
     *
     * @return LengthAwarePaginator<int, AwaitingRow>
     */
    public static function awaitingOrders(string $search): LengthAwarePaginator
    {
        return self::awaitingOrdersQuery($search)
            ->with('student')
            ->oldest('created_at')
            ->oldest('id')
            ->paginate(self::PER_PAGE, pageName: 'orders_page')
            ->withQueryString()
            ->through(fn (Order $order): array => self::awaitingOrderRow($order));
    }

    /**
     * Preorder slips awaiting payment (with preorders still waiting), the
     * oldest first, 20 a page; search by slip number, buyer name or ID.
     *
     * @return LengthAwarePaginator<int, AwaitingRow>
     */
    public static function awaitingSlips(string $search): LengthAwarePaginator
    {
        return self::awaitingSlipsQuery($search)
            ->with(['student', 'product'])
            ->oldest('created_at')
            ->oldest('id')
            ->paginate(self::PER_PAGE, pageName: 'slips_page')
            ->withQueryString()
            ->through(fn (PreorderSlip $slip): array => [
                'kind' => 'preorder',
                'id' => $slip->id,
                'number' => $slip->number,
                'buyer_name' => $slip->student->name,
                'buyer_id' => $slip->student->idNumber(),
                'is_staff' => $slip->student->isEmployee(),
                'for' => $slip->product->name,
                'amount_centavos' => $slip->amountDue(),
                'since' => $slip->created_at?->toIso8601String(),
                'pay_until' => $slip->product->preorders_close_on?->toDateString(),
            ]);
    }

    /**
     * @return Builder<Order>
     */
    private static function awaitingOrdersQuery(string $search): Builder
    {
        return Order::query()
            ->where('status', OrderStatus::Placed)
            ->when($search !== '', fn (Builder $query) => $query->where(function (Builder $query) use ($search): void {
                $like = '%'.mb_strtolower($search).'%';
                $query->whereRaw('lower(number) like ?', [$like])
                    ->orWhereHas('student', fn (Builder $buyer) => self::buyerMatches($buyer, $like));
            }));
    }

    /**
     * @return Builder<PreorderSlip>
     */
    private static function awaitingSlipsQuery(string $search): Builder
    {
        return PreorderSlip::query()
            ->whereNull('paid_at')
            ->whereHas('preorders', fn (Builder $preorders) => $preorders->where('status', PreorderStatus::Active))
            ->when($search !== '', fn (Builder $query) => $query->where(function (Builder $query) use ($search): void {
                $like = '%'.mb_strtolower($search).'%';
                $query->whereRaw('lower(number) like ?', [$like])
                    ->orWhereHas('student', fn (Builder $buyer) => self::buyerMatches($buyer, $like));
            }));
    }

    /**
     * @return AwaitingRow
     */
    private static function awaitingOrderRow(Order $order): array
    {
        return [
            'kind' => 'order',
            'id' => $order->id,
            'number' => $order->number,
            'buyer_name' => $order->student->name,
            'buyer_id' => $order->student->idNumber(),
            'is_staff' => $order->student->isEmployee(),
            'for' => $order->itemsText(),
            'amount_centavos' => $order->total_centavos,
            'since' => $order->created_at?->toIso8601String(),
            'pay_until' => null,
        ];
    }

    /** Whether what was paid for has been handed over. */
    private static function released(Payment $payment): bool
    {
        if ($payment->order_id !== null) {
            return $payment->order?->status === OrderStatus::PickedUp;
        }

        return $payment->preorderSlip !== null && PreorderPayment::released($payment->preorderSlip);
    }
}
