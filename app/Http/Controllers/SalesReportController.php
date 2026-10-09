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
 * orders, what was sold (Cost, Price, Profit), what was sold below cost,
 * and what free uniforms (promo) were worth; setting the Cost of items
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
     * The items sold in the period, as a CSV file for Excel.
     */
    public function export(SalesReportRequest $request): StreamedResponse
    {
        [$from, $to] = $request->range();
        $rows = SalesReport::allSold($from, $to);
        $peso = fn (?int $centavos): string => $centavos === null ? '' : number_format($centavos / 100, 2, '.', '');

        return response()->streamDownload(function () use ($rows, $peso): void {
            $file = fopen('php://output', 'w');

            if ($file === false) {
                return;
            }

            // Lets Excel read the file as UTF-8 (₱, ñ).
            fwrite($file, "\xEF\xBB\xBF");
            fputcsv($file, ['Item', 'Size / Color', 'Unit', 'Quantity Sold', 'Cost Each (PHP)', 'Price Each (PHP)', 'Normal Price Each (PHP)', 'Total Price (PHP)', 'Total Cost (PHP)', 'Profit (PHP)', 'Sold Below Cost'], escape: '');

            foreach ($rows as $row) {
                fputcsv($file, [
                    $row['product_name'],
                    $row['variant_label'] ?? '',
                    $row['unit_name'],
                    $row['quantity'],
                    $peso($row['cost_each_centavos']),
                    $peso($row['price_each_centavos']),
                    $peso($row['normal_each_centavos']),
                    $peso($row['price_total_centavos']),
                    $peso($row['cost_total_centavos']),
                    $peso($row['profit_centavos']),
                    $row['below_cost'] ? 'Yes' : '',
                ], escape: '');
            }

            fclose($file);
        }, "sales-{$from->toDateString()}-to-{$to->toDateString()}.csv", ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * Set the Cost per piece of stock that came in without one; its sales
     * are worked out again.
     */
    public function setPrice(Request $request, ProductVariant $variant): RedirectResponse
    {
        $centavos = (int) round((float) $request->validate(
            ['unit_cost' => ['required', 'numeric', 'min:0.01', 'max:'.SaveProductRequest::MAX_PRICE_PESOS]],
            [
                'unit_cost.max' => 'The Cost per piece cannot be more than ₱100,000.00.',
                'unit_cost.required' => 'Enter the Cost per piece, e.g. 250 or 18.50.',
                'unit_cost.numeric' => 'Enter the Cost per piece, e.g. 250 or 18.50.',
                'unit_cost.min' => 'Enter the Cost per piece, e.g. 250 or 18.50.',
            ],
        )['unit_cost'] * 100);

        StockCost::setMissingPrice($variant, $centavos);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => "Cost of {$variant->displayName()} set to ₱".number_format($centavos / 100, 2).' per piece. Its sales were worked out again.',
        ]);

        return back();
    }
}
