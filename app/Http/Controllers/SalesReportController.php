<?php

namespace App\Http\Controllers;

use App\Http\Requests\SalesReportRequest;
use App\Http\Requests\SaveProductRequest;
use App\Models\ProductVariant;
use App\Services\Reports\SalesReport;
use App\Services\Stock\StockCost;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The Specialist's Sales Reports for a period: what was spent on eStore
 * orders, what was sold (Cost, Price, Profit), the best sellers, what was
 * sold below cost, and what free uniforms (promo) were worth; setting the Cost of items
 * that have none; and a CSV of the items sold.
 */
class SalesReportController extends Controller
{
    public function index(SalesReportRequest $request): Response
    {
        [$from, $to] = $request->range();
        $tab = $request->tab();

        return Inertia::render('sales-reports/index', [
            'summary' => SalesReport::summary($from, $to),
            'spent' => $tab === 'spent' ? SalesReport::spent($from, $to) : null,
            'sold' => $tab === 'sold' ? SalesReport::sold($from, $to, $request->search()) : null,
            'best' => $tab === 'best' ? SalesReport::bestSellers($from, $to) : null,
            'free' => $tab === 'free' ? SalesReport::free($from, $to) : null,
            'filters' => [
                'tab' => $tab,
                'period' => $request->period(),
                'date_from' => $from->toDateString(),
                'date_to' => $to->toDateString(),
                'search' => $request->search(),
            ],
        ]);
    }

    /**
     * The period's sales as a CSV file for Excel, like a report card: a
     * title with the period, every sale (one row per item of a released
     * order) with its date, in the order they happened (morning first), a TOTAL
     * row, and the summary at the bottom (sales, cost, profit, and the
     * eStore orders spent on in the same period).
     */
    public function export(SalesReportRequest $request): StreamedResponse
    {
        [$from, $to] = $request->range();
        $sales = SalesReport::salesLog($from, $to);
        $summary = SalesReport::summary($from, $to);
        $peso = fn (?int $centavos): string => $centavos === null ? '' : number_format($centavos / 100, 2, '.', '');

        return response()->streamDownload(function () use ($sales, $summary, $from, $to, $peso): void {
            $file = fopen('php://output', 'w');

            if ($file === false) {
                return;
            }

            $row = fn (array $cells) => fputcsv($file, $cells, escape: '');

            // Lets Excel read the file as UTF-8 (₱, ñ).
            fwrite($file, "\xEF\xBB\xBF");
            $row(['STI PROWARE Sales Report']);
            $row(['Period', $from->format('M j, Y').' to '.$to->format('M j, Y')]);
            $row([]);
            $row(['Date', 'Order #', 'Buyer', 'Item', 'Size / Color', 'Unit', 'Quantity Sold', 'Pieces', 'Price Each (PHP)', 'Lower Price Because', 'Total Price (PHP)', 'Total Cost (PHP)', 'Profit (PHP)']);

            foreach ($sales as $sale) {
                $row([
                    $sale['sold_at']->format('M j, Y'),
                    $sale['order_number'] ?? '',
                    $sale['buyer'],
                    $sale['set_name'] ? "{$sale['product_name']} ({$sale['set_name']})" : $sale['product_name'],
                    $sale['variant_label'] ?? '',
                    $sale['unit_name'],
                    $sale['quantity'],
                    $sale['pieces'],
                    $peso($sale['price_each_centavos']),
                    $sale['lower_price_label'] ?? '',
                    $peso($sale['price_total_centavos']),
                    $peso($sale['cost_total_centavos']),
                    $peso($sale['profit_centavos']),
                ]);
            }

            $costed = array_filter($sales, fn (array $sale): bool => $sale['cost_total_centavos'] !== null);
            $row([
                'TOTAL', '', '', '', '', '',
                array_sum(array_column($sales, 'quantity')),
                array_sum(array_column($sales, 'pieces')),
                '', '',
                $peso(array_sum(array_column($sales, 'price_total_centavos'))),
                $peso(array_sum(array_column($costed, 'cost_total_centavos'))),
                $peso(array_sum(array_column($costed, 'profit_centavos'))),
            ]);

            $row([]);
            $row(['SUMMARY']);
            $row(['Orders released', $summary['orders']]);
            $row(['Pieces sold', $summary['pieces']]);
            $row(['Total sales (PHP)', $peso($summary['price_centavos'])]);
            $row(['Cost of the items sold (PHP)', $peso($summary['cost_centavos'])]);
            $row(['Profit (PHP)', $peso($summary['profit_centavos'])]);
            $row(['Spent on eStore orders, expenses (PHP)', $peso($summary['spent_centavos'])]);
            $row(['Sales minus expenses (PHP)', $peso($summary['price_centavos'] - $summary['spent_centavos'])]);
            $row(['Sold below cost, loss (PHP)', $peso($summary['below_cost_loss_centavos'])]);

            if ($summary['missing_cost_lines'] > 0) {
                $row(['Note', "{$summary['missing_cost_lines']} sold ".($summary['missing_cost_lines'] === 1 ? 'item has' : 'items have').' no Cost yet, so Cost and Profit count only the items with a Cost. Set their Cost on Sales Reports.']);
            }

            fclose($file);
        }, "sales-{$from->toDateString()}-to-{$to->toDateString()}.csv", ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * Set the Cost per piece of stock that came in without one; its sales
     * are recalculated.
     */
    public function setPrice(Request $request, ProductVariant $variant): RedirectResponse
    {
        $centavos = (int) round((float) $request->validate(
            ['unit_cost' => ['required', 'numeric', 'min:0.01', 'max:'.SaveProductRequest::MAX_PRICE_PESOS]],
            [
                'unit_cost.max' => 'The Cost per piece cannot be more than ₱100,000.00.',
                'unit_cost.required' => 'Enter the Cost per piece, e.g. 250 or 18.50.',
                'unit_cost.numeric' => 'Enter the Cost per piece, e.g. 250 or 18.50.',
                'unit_cost.min' => 'The Cost per piece must be more than ₱0.',
            ],
        )['unit_cost'] * 100);

        StockCost::setMissingPrice($variant, $centavos);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => "The cost of {$variant->displayName()} has been set to ₱".number_format($centavos / 100, 2).' per piece, and its sales have been recalculated.',
        ]);

        return back();
    }
}
