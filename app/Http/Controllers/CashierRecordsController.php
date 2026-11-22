<?php

namespace App\Http\Controllers;

use App\Http\Requests\FilterPaymentsRequest;
use App\Services\Shop\CashierRecords;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The cashier's records: Awaiting Payment (who still has to pay), Payment
 * History (every receipt, filtered), Collections (the money collected by
 * day or month), their CSV downloads for Excel, and the printable daily
 * collection report. The School Admin can view Payment History and
 * Collections, read-only. The Specialist cannot open any of it.
 */
class CashierRecordsController extends Controller
{
    /**
     * Orders and preorder slips awaiting payment, the oldest first; search by number, buyer name or ID.
     */
    public function awaiting(Request $request): Response
    {
        $search = trim((string) ($request->validate(
            ['search' => ['nullable', 'string', 'max:100']],
            ['search.max' => 'The search may not be longer than 100 characters.'],
        )['search'] ?? ''));

        return Inertia::render('cashier/awaiting', [
            'search' => $search,
            'orders' => CashierRecords::awaitingOrders($search),
            'slips' => CashierRecords::awaitingSlips($search),
        ]);
    }

    /**
     * Payment History: today by default; the latest first, 20 a page, with the totals of what matches.
     */
    public function history(FilterPaymentsRequest $request): Response
    {
        $filters = $request->filters();

        return Inertia::render('cashier/payments', [
            ...CashierRecords::history($filters),
            'filters' => $filters,
            'readOnly' => ! $request->user()->isCashier(),
        ]);
    }

    /**
     * Collections: this month by default, by day or by month.
     */
    public function collections(FilterPaymentsRequest $request): Response
    {
        $filters = $request->filters('month');

        return Inertia::render('cashier/collections', [
            ...CashierRecords::collections($filters),
            'filters' => $filters,
            'readOnly' => ! $request->user()->isCashier(),
        ]);
    }

    /**
     * The payments matching the filters, one row each, for Excel.
     */
    public function historyCsv(FilterPaymentsRequest $request): StreamedResponse
    {
        $filters = $request->filters();
        $payments = CashierRecords::query($filters)->with(['cashier', 'voider', 'buyer', 'order', 'preorderSlip.preorders'])->orderBy('paid_at')->orderBy('id');

        return $this->csv("payment-history-{$filters['date_from']}-to-{$filters['date_to']}.csv", [
            'Receipt No.', 'Date and time', 'For', 'Slip No.', 'Buyer', 'ID', 'Method', 'Amount', 'Amount received', 'Change', 'GCash reference', 'Received by', 'Status', 'Reason for voiding',
        ], function () use ($payments): iterable {
            foreach ($payments->lazy() as $payment) {
                $row = CashierRecords::row($payment);

                yield [
                    $row['receipt_number'],
                    $payment->paid_at->format('Y-m-d g:i A'),
                    $row['kind'] === 'order' ? 'Order' : 'Preorder',
                    $row['number'],
                    $row['buyer_name'],
                    $row['buyer_id'],
                    $row['method_label'],
                    self::amount($row['amount_centavos']),
                    $row['amount_received_centavos'] === null ? '' : self::amount($row['amount_received_centavos']),
                    $row['change_centavos'] === null ? '' : self::amount($row['change_centavos']),
                    // As text, so Excel keeps all 13 digits.
                    $row['gcash_reference'] === null ? '' : "=\"{$row['gcash_reference']}\"",
                    $row['cashier'],
                    $row['void'] ? 'VOID' : 'Paid',
                    $row['void_reason'],
                ];
            }
        });
    }

    /**
     * Collections by day or month, for Excel.
     */
    public function collectionsCsv(FilterPaymentsRequest $request): StreamedResponse
    {
        $filters = $request->filters('month');
        $collections = CashierRecords::collections($filters);

        return $this->csv("collections-{$filters['date_from']}-to-{$filters['date_to']}.csv", [
            $filters['group'] === 'month' ? 'Month' : 'Day', 'Payments', 'Cash', 'GCash', 'Total collected', 'Voided payments',
        ], function () use ($collections): iterable {
            foreach (array_reverse($collections['rows']) as $row) {
                yield [$row['label'], $row['count'], self::amount($row['cash_centavos']), self::amount($row['gcash_centavos']), self::amount($row['total_centavos']), $row['void_count']];
            }

            $totals = $collections['totals'];

            yield ['Total', $totals['count'], self::amount($totals['cash_centavos']), self::amount($totals['gcash_centavos']), self::amount($totals['total_centavos']), $totals['void_count']];
        });
    }

    /**
     * The daily collection report, for paper: today by default.
     */
    public function daily(Request $request): Response
    {
        $date = $request->validate(
            ['date' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today']],
            ['date.date_format' => 'Choose a valid date.', 'date.before_or_equal' => 'The date cannot be after today.'],
        )['date'] ?? null;

        return Inertia::render('print/daily-collection-report', [
            ...CashierRecords::daily($date === null ? CarbonImmutable::today() : CarbonImmutable::parse($date)),
            'preparedBy' => $request->user()->name,
        ]);
    }

    /**
     * A CSV file Excel opens with ₱ and names intact (UTF-8 with its mark).
     *
     * @param  list<string>  $header
     * @param  Closure(): iterable<array<int, string|int|null>>  $rows
     */
    private function csv(string $filename, array $header, Closure $rows): StreamedResponse
    {
        return response()->streamDownload(function () use ($header, $rows): void {
            $out = fopen('php://output', 'w');

            if ($out === false) {
                return;
            }

            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, $header, escape: '\\');

            foreach ($rows() as $row) {
                fputcsv($out, $row, escape: '\\');
            }

            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private static function amount(int $centavos): string
    {
        return number_format($centavos / 100, 2, '.', '');
    }
}
