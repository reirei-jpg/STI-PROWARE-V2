<?php

namespace App\Http\Controllers;

use App\Http\Requests\SalesReportRequest;
use App\Models\ProductVariant;
use App\Services\Reports\SalesReport;
use App\Services\Stock\StockCost;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The Specialist's Sales Reports: what released orders collected in a
 * period, what their pieces cost on the eStore, the profit, the discounts
 * given while items were on sale, per product and size; the stock that
 * still needs its eStore price (and entering it); and a CSV for Excel.
 */
class SalesReportController extends Controller
{
    public function index(SalesReportRequest $request): Response
    {
        [$from, $to] = $request->range();

        return Inertia::render('sales-reports/index', [
            'summary' => SalesReport::summary($from, $to),
            'products' => SalesReport::byProduct($from, $to, $request->search()),
            'needingPrice' => SalesReport::needingPrice(),
            'details' => Inertia::optional(fn (): ?array => $request->filled('details') ? SalesReport::details($request->integer('details'), $from, $to) : null),
            'filters' => [
                'period' => $request->period(),
                'date_from' => $from->toDateString(),
                'date_to' => $to->toDateString(),
                'search' => $request->search(),
            ],
        ]);
    }

    /**
     * The period's sales per product and size, as a CSV file for Excel.
     */
    public function export(SalesReportRequest $request): StreamedResponse
    {
        [$from, $to] = $request->range();
        $rows = SalesReport::allByProduct($from, $to);
        $peso = fn (int $centavos): string => number_format($centavos / 100, 2, '.', '');

        return response()->streamDownload(function () use ($rows, $peso): void {
            $file = fopen('php://output', 'w');

            if ($file === false) {
                return;
            }

            // Lets Excel read the file as UTF-8 (₱, ñ).
            fwrite($file, "\xEF\xBB\xBF");
            fputcsv($file, ['Product', 'Size / Color', 'Pieces Sold', 'Sales (PHP)', 'eStore Cost (PHP)', 'Profit (PHP)', 'Discounts Given (PHP)', 'Pieces Sold on Sale', 'Sales Without Cost'], escape: '');

            foreach ($rows as $row) {
                fputcsv($file, [
                    $row['product_name'],
                    $row['variant_label'] ?? '',
                    $row['pieces'],
                    $peso($row['sales_centavos']),
                    $peso($row['cost_centavos']),
                    $peso($row['profit_centavos']),
                    $peso($row['discount_centavos']),
                    $row['on_sale_pieces'],
                    $row['uncosted_lines'],
                ], escape: '');
            }

            fclose($file);
        }, "sales-{$from->toDateString()}-to-{$to->toDateString()}.csv", ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * Enter the eStore price per piece of stock that came in without one;
     * its sales are costed again.
     */
    public function setPrice(Request $request, ProductVariant $variant): RedirectResponse
    {
        $centavos = (int) round((float) $request->validate(
            ['unit_cost' => ['required', 'numeric', 'min:0.01', 'max:1000000']],
            [
                'unit_cost.required' => 'Enter the eStore price per piece, e.g. 250 or 18.50.',
                'unit_cost.numeric' => 'Enter the eStore price per piece, e.g. 250 or 18.50.',
                'unit_cost.min' => 'Enter the eStore price per piece, e.g. 250 or 18.50.',
            ],
        )['unit_cost'] * 100);

        StockCost::setMissingPrice($variant, $centavos);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => "eStore price of {$variant->displayName()} set to ₱".number_format($centavos / 100, 2).' per piece. Its sales were costed again.',
        ]);

        return back();
    }
}
