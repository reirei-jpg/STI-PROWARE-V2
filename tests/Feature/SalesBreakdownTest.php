<?php

use App\Enums\OrderStatus;
use App\Enums\ProductCategory;
use App\Enums\StockMovementType;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\Reports\SalesBreakdown;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Panel revision D1: Sales Reports by size, color and grade level, and the
 * stock trend.
 */

beforeEach(function () {
    $this->specialist = User::factory()->specialist()->create();
});

/**
 * A released order line of this many pieces at ₱100 each.
 *
 * @param  list<array{option: string, choice: string}>  $choices
 */
function releasedOptionPieces(Product $product, array $choices, int $pieces): ProductVariant
{
    $variant = ProductVariant::factory()->for($product)->create([
        'combination' => implode(' | ', array_map(fn (array $c): string => "{$c['option']}: {$c['choice']}", $choices)),
        'choices' => $choices,
    ]);

    OrderItem::factory()
        ->for(Order::factory()->create(['status' => OrderStatus::PickedUp, 'picked_up_at' => now()]))
        ->create(['product_id' => $product->id, 'product_variant_id' => $variant->id, 'product_name' => $product->name, 'quantity' => $pieces, 'quantity_short' => 0, 'pieces_per_unit' => 1, 'line_total_centavos' => $pieces * 10000]);

    return $variant;
}

test('sales are grouped by size, color and grade level, and each table adds up to the total', function () {
    $polo = Product::factory()->create(['name' => 'BSIT Polo', 'category' => ProductCategory::TertiaryUniform]);
    $shirt = Product::factory()->create(['name' => 'Bagong Product', 'category' => ProductCategory::ProwareMerchandise]);
    $pen = Product::factory()->create(['name' => 'STI Ballpen', 'category' => ProductCategory::ProwareMerchandise]);

    releasedOptionPieces($polo, [['option' => 'Size', 'choice' => 'M']], 5);
    releasedOptionPieces($shirt, [['option' => 'Size', 'choice' => 'M'], ['option' => 'Program', 'choice' => 'Grade 11 (Senior High)'], ['option' => 'Color', 'choice' => 'Red']], 3);
    releasedOptionPieces($pen, [], 2);

    $report = SalesBreakdown::byOption(now()->startOfMonth()->toImmutable(), now()->endOfDay()->toImmutable());
    $sum = fn (array $rows): int => array_sum(array_column($rows, 'pieces'));

    expect($report['pieces'])->toBe(10)
        ->and($report['price_total_centavos'])->toBe(100000)
        ->and($sum($report['size']))->toBe(10)
        ->and($sum($report['color']))->toBe(10)
        ->and($sum($report['grade']))->toBe(10)
        ->and($report['size'][0])->toMatchArray(['label' => 'M', 'pieces' => 8, 'share' => 80.0, 'top' => 'BSIT Polo 5, Bagong Product 3'])
        ->and(collect($report['size'])->firstWhere('label', 'No size')['pieces'])->toBe(2)
        ->and(collect($report['color'])->firstWhere('label', 'Red')['pieces'])->toBe(3)
        ->and(collect($report['grade'])->pluck('pieces', 'label')->all())->toBe(['College' => 5, 'Grade 11' => 3, 'Not grade-specific' => 2]);
});

test('grade levels come from the Program option, then the category', function (?string $program, ?ProductCategory $category, string $grade) {
    expect(SalesBreakdown::gradeOf($program, $category))->toBe($grade);
})->with([
    ['Grade 12 (Senior High)', null, 'Grade 12'],
    ['BSIT', null, 'College'],
    [null, ProductCategory::TertiaryUniform, 'College'],
    [null, ProductCategory::ShsUniform, 'Senior High'],
    [null, ProductCategory::ProwareMerchandise, 'Not grade-specific'],
]);

test('the stock trend shows what came in and went out each day, and the stock at the end', function () {
    $this->travelTo(CarbonImmutable::parse('2026-11-24 15:00', 'Asia/Manila'));
    $variant = ProductVariant::factory()->for(Product::factory()->create())->create(['stock_on_hand' => 12]);
    $move = fn (StockMovementType $type, int $quantity, string $at) => StockMovement::factory()->for($variant, 'variant')->create(['type' => $type, 'quantity' => $quantity, 'balance_after' => 0, 'created_at' => $at]);
    $move(StockMovementType::Delivery, 20, '2026-11-02 09:00');
    $move(StockMovementType::Sale, -5, '2026-11-02 10:00');
    $move(StockMovementType::Correction, -1, '2026-11-10 10:00');
    $move(StockMovementType::Sale, -2, '2026-11-24 09:00');

    $trend = SalesBreakdown::stockTrend(CarbonImmutable::parse('2026-11-01'), CarbonImmutable::parse('2026-11-24')->endOfDay(), $variant->product_id);
    $byDay = collect($trend['rows'])->keyBy('from');

    expect($trend['by'])->toBe('day')
        ->and($byDay['2026-11-02'])->toMatchArray(['received' => 20, 'sold' => 5, 'stock_at_end' => 15])
        ->and($byDay['2026-11-10'])->toMatchArray(['corrections' => -1, 'stock_at_end' => 14])
        ->and($byDay['2026-11-24'])->toMatchArray(['sold' => 2, 'stock_at_end' => 12]);
});

test('the Sales Reports page has the two tabs, and refuses a product that does not exist', function () {
    $this->actingAs($this->specialist);

    $this->get(route('sales-reports.index', ['tab' => 'options']))
        ->assertInertia(fn (Assert $page) => $page->has('options.size')->where('trend', null));
    $this->get(route('sales-reports.index', ['tab' => 'trend']))
        ->assertInertia(fn (Assert $page) => $page->has('trend.rows')->has('trend_products'));
    $this->get(route('sales-reports.index', ['tab' => 'trend', 'product' => 999999]))
        ->assertSessionHasErrors(['product' => 'That product was not found. Choose one from the list, or All products.']);
});
