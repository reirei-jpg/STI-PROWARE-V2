<?php

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\User;
use Carbon\CarbonImmutable;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-11-13 18:00', 'Asia/Manila'));
    $this->specialist = User::factory()->specialist()->create();
});

/**
 * An order released at $releasedAt, with one item.
 *
 * @param  array<string, mixed>  $item
 */
function releasedSale(string $releasedAt, string $buyer, array $item): Order
{
    $order = Order::factory()
        ->for(User::factory()->student()->create(['name' => $buyer]), 'student')
        ->create(['status' => OrderStatus::PickedUp, 'picked_up_at' => CarbonImmutable::parse($releasedAt, 'Asia/Manila')]);
    OrderItem::factory()->for($order)->create($item);

    return $order;
}

test('the CSV lists every sale of the chosen dates with its date, in the order they happened, then a total and the summary', function () {
    $afternoon = releasedSale('2026-11-12 14:30', 'Bea Villareal', ['product_name' => 'STI Lanyard', 'quantity' => 2, 'unit_price_centavos' => 8000, 'line_total_centavos' => 16000, 'cost_centavos' => 10000]);
    $morning = releasedSale('2026-11-12 08:15', 'Juan Dela Cruz', ['product_name' => 'STI Umbrella', 'variant_label' => 'Black', 'quantity' => 1, 'unit_price_centavos' => 25000, 'line_total_centavos' => 25000, 'cost_centavos' => 18000]);
    // Released short: 3 ordered, 1 handed over.
    releasedSale('2026-11-12 16:00', 'Carla Reyes', ['product_name' => 'STI Hoodie', 'quantity' => 3, 'quantity_short' => 2, 'unit_price_centavos' => 75000, 'line_total_centavos' => 75000]);
    // Outside the chosen dates.
    releasedSale('2026-11-10 09:00', 'Mark Santos', ['product_name' => 'STI Cap', 'quantity' => 1, 'unit_price_centavos' => 20000, 'line_total_centavos' => 20000]);

    $csv = $this->actingAs($this->specialist)
        ->get(route('sales-reports.export', ['period' => 'custom', 'date_from' => '2026-11-11', 'date_to' => '2026-11-12']))
        ->assertDownload('sales-2026-11-11-to-2026-11-12.csv')
        ->streamedContent();
    $lines = array_values(array_filter(explode("\n", ltrim($csv, "\xEF\xBB\xBF"))));

    expect($lines[0])->toBe('"STI PROWARE Sales Report"')
        ->and($lines[1])->toBe('Period,"Nov 11, 2026 to Nov 12, 2026"')
        ->and($lines[2])->toStartWith('Date,"Order #",Buyer,Item,')
        ->and($lines[3])->toBe("\"Nov 12, 2026\",{$morning->number},\"Juan Dela Cruz\",\"STI Umbrella\",Black,Piece,1,1,250.00,,250.00,180.00,70.00")
        ->and($lines[4])->toBe("\"Nov 12, 2026\",{$afternoon->number},\"Bea Villareal\",\"STI Lanyard\",,Piece,2,2,80.00,,160.00,100.00,60.00")
        ->and($lines[5])->toContain('"STI Hoodie",,Piece,1,1,750.00,,750.00,,')
        ->and($lines[6])->toBe('TOTAL,,,,,,4,4,,,1160.00,280.00,130.00')
        ->and($lines[7])->toBe('SUMMARY,"Nov 11, 2026 to Nov 12, 2026"')
        ->and($csv)->not->toContain('STI Cap')
        ->toContain("Sales\n\"Orders released\",3\n\"Pieces sold\",4\n\"Total sales\",\"₱1,160.00\"")
        ->toContain("Profit\n\"Cost of the items sold\",₱280.00\nProfit,₱130.00")
        ->toContain("Expenses\n\"Spent on eStore orders\",₱0.00\n\"Sales minus expenses\",\"₱1,160.00\"")
        ->not->toContain('Lost on items sold below cost')
        ->toContain('1 sold item has no Cost yet');
});
