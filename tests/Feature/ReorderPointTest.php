<?php

use App\Enums\ProductStatus;
use App\Enums\StockMovementType;
use App\Models\Product;
use App\Models\ProductPack;
use App\Models\ProductVariant;
use App\Models\Setting;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\Stock\LowStockAlerts;
use App\Services\Stock\ReorderPoints;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->specialist = User::factory()->specialist()->create();
});

/**
 * An Available STI Classic Tee (Black / M) with this many pieces and a
 * safety stock of 5, and the pieces it sold this many days ago.
 *
 * @param  array<int, int>  $soldDaysAgo  pieces by days ago, e.g. [5 => 30]
 */
function classicTee(int $pieces, array $soldDaysAgo = [], ?ProductPack $pack = null): ProductVariant
{
    $product = Product::factory()->create(['name' => 'STI Classic Tee', 'status' => ProductStatus::Available, 'low_stock_alert_at' => 5]);
    $variant = ProductVariant::factory()->for($product)->create([
        'combination' => 'Color: Black | Size: M',
        'choices' => [['option' => 'Color', 'choice' => 'Black'], ['option' => 'Size', 'choice' => 'M']],
        'estore_item_code' => 'CT-01-BLACK-M',
        'estore_pack_id' => $pack?->id,
        'stock_on_hand' => $pieces,
    ]);

    foreach ($soldDaysAgo as $daysAgo => $sold) {
        StockMovement::factory()->for($variant, 'variant')->create([
            'type' => StockMovementType::Sale,
            'quantity' => -$sold,
            'balance_after' => $pieces,
            'units_received' => null,
            'created_at' => now()->subDays($daysAgo),
        ]);
    }

    app(ReorderPoints::class)->refreshVariant($variant);

    return $variant->refresh();
}

test('the Reorder Point is the pieces used per day times the delivery days plus the safety stock', function () {
    // 30 sold in the last 30 days = 1 a day; 14 days to deliver; 5 safety stock.
    $tee = classicTee(40, [5 => 20, 25 => 10, 45 => 50]);

    expect($tee->used_last_30_days)->toBe(30)
        ->and($tee->reorder_point)->toBe(19)
        ->and(ReorderPoints::formula($tee))->toBe('30 pcs used in the last 30 days (1 a day) × 14 days to deliver + 5 pcs safety stock = 19 pcs.');
});

test('a size that sold nothing in 30 days reorders at its safety stock', function () {
    $tee = classicTee(40, [60 => 30]);

    expect($tee->reorder_point)->toBe(5)
        ->and(ReorderPoints::formula($tee))->toBe('Nothing used in the last 30 days, so the Reorder Point is the safety stock: 5 pcs.');
});

test('each size gets a status and a suggested order', function (int $pieces, int $coming, string $status, int $suggested) {
    $tee = classicTee($pieces, [5 => 30]);

    if ($coming > 0) {
        orderWith(['CT-01-BLACK-M' => $coming]);
    }

    expect(ReorderPoints::view($tee, ReorderPoints::onOrder([$tee])[$tee->id] ?? 0))
        ->toMatchArray(['reorder_point' => 19, 'status' => $status, 'suggested' => $suggested, 'on_order' => $coming]);
})->with([
    // Above the Reorder Point of 19.
    'enough' => [20, 0, 'ok', 0],
    // 19 + 30 days of sales (30) - 15 left = 34.
    'at the Reorder Point' => [15, 0, 'reorder', 34],
    'none left' => [0, 0, 'out_of_stock', 49],
    // 20 already coming on an eStore order: 34 - 20 = 14 more.
    'partly on order' => [15, 20, 'reorder', 14],
    'enough on order' => [15, 40, 'on_order', 0],
]);

test('the suggested order is rounded up to the packs Head Office sends', function () {
    $pack = ProductPack::factory()->create(['pieces' => 10]);
    $tee = classicTee(15, [5 => 30], $pack);

    // 34 pieces needed = 4 packs of 10.
    expect(ReorderPoints::view($tee)['suggested'])->toBe(40);
});

test('the Specialist is warned at the Reorder Point, before the safety stock is reached', function () {
    $tee = classicTee(25, [5 => 30]);
    $this->actingAs($this->specialist);

    $this->post(route('products.stock.correct', $tee->product_id), ['product_variant_id' => $tee->id, 'reason' => 'damaged', 'pieces_to_remove' => '6'])
        ->assertSessionHasNoErrors();

    expect($this->specialist->notifications()->sole()->data)->toMatchArray([
        'kind' => 'low_stock',
        'stock_on_hand' => 19,
        'alert_at' => 19,
        'suggested' => 30,
    ]);
});

test('the Products list shows the sizes to reorder with their Reorder Point and suggested order', function () {
    classicTee(15, [5 => 30]);
    classicTee(20, [5 => 30])->product->update(['name' => 'STI Classic Tee Two']);

    $this->actingAs($this->specialist)
        ->get(route('products.index', ['stock' => 'low']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('lowStockCount', 1)
            ->where('products.data.0.name', 'STI Classic Tee')
            ->where('products.data.0.stock_sizes.0.label', 'Black / M')
            ->where('products.data.0.stock_sizes.0.reorder.reorder_point', 19)
            ->where('products.data.0.stock_sizes.0.reorder.status_label', 'Reorder now')
            ->where('products.data.0.stock_sizes.0.reorder.suggested', 34));
});

test('Draft sizes and products not for sale have no Reorder status', function () {
    $tee = classicTee(2, [5 => 30]);

    $tee->forceFill(['status' => ProductStatus::Draft])->save();
    expect(ReorderPoints::view($tee->refresh()))->toBeNull();

    $tee->forceFill(['status' => ProductStatus::Available])->save();
    $tee->product->update(['status' => ProductStatus::Preorder]);
    expect(ReorderPoints::view($tee->refresh()))->toBeNull();
});

test('changing the safety stock works the Reorder Points out again', function () {
    $tee = classicTee(40, [5 => 30]);

    $tee->product->update(['low_stock_alert_at' => 10]);
    app(LowStockAlerts::class)->rearm($tee->product);

    expect($tee->refresh()->reorder_point)->toBe(24);
});

test('the Specialist sets the days Head Office takes to deliver on the Maintenance page', function () {
    $tee = classicTee(40, [5 => 30]);
    $this->actingAs($this->specialist);

    $this->get(route('maintenance.index'))
        ->assertInertia(fn (Assert $page) => $page->where('reorderLeadDays.value', 14)->where('reorderLeadDays.changed_by', null));

    $this->from(route('maintenance.index'))
        ->patch(route('maintenance.reorder-lead-days'), ['lead_days' => '7'])
        ->assertRedirect(route('maintenance.index'))
        ->assertInertiaFlash('toast.message', 'Head Office now takes 7 days to deliver. The Reorder Points have been worked out again: 1 changed.');

    // 1 a day × 7 days + 5 safety stock.
    expect($tee->refresh()->reorder_point)->toBe(12)
        ->and(Setting::integer(Setting::REORDER_LEAD_DAYS, 0))->toBe(7);

    $this->get(route('maintenance.index'))
        ->assertInertia(fn (Assert $page) => $page->where('reorderLeadDays.value', 7)->where('reorderLeadDays.changed_by', $this->specialist->name));
});

test('the delivery days must be a whole number from 1 to 180', function (mixed $days) {
    $this->actingAs($this->specialist)
        ->from(route('maintenance.index'))
        ->patch(route('maintenance.reorder-lead-days'), ['lead_days' => $days])
        ->assertSessionHasErrors(['lead_days' => 'Enter a whole number of days from 1 to 180.']);

    expect(Setting::query()->find(Setting::REORDER_LEAD_DAYS))->toBeNull();
})->with(['empty' => [''], 'zero' => ['0'], 'too many' => ['181'], 'not a number' => ['two weeks'], 'decimal' => ['1.5']]);

test('only the Specialist changes the delivery days', function () {
    foreach ([User::factory()->schoolAdmin()->create(), User::factory()->cashier()->create(), User::factory()->student()->create()] as $user) {
        $this->actingAs($user)->patch(route('maintenance.reorder-lead-days'), ['lead_days' => '7'])->assertForbidden();
    }

    expect(Setting::query()->find(Setting::REORDER_LEAD_DAYS))->toBeNull();
});

test('each night the Reorder Points are worked out again, and sizes that reach theirs are warned once', function () {
    $tee = classicTee(15, [5 => 30]);
    // Worked out yesterday, before these sales were counted.
    $tee->forceFill(['reorder_point' => 5, 'used_last_30_days' => 0])->save();

    $this->artisan('stock:reorder-points')->assertSuccessful();
    $this->artisan('stock:reorder-points')->assertSuccessful();

    expect($tee->refresh()->reorder_point)->toBe(19)
        ->and($this->specialist->notifications()->count())->toBe(1);
});

test('the first run only marks the sizes already at their Reorder Point, without a notice for each', function () {
    $tee = classicTee(15, [5 => 30]);
    $tee->forceFill(['reorder_point' => 5, 'used_last_30_days' => 0])->save();

    $this->artisan('stock:reorder-points', ['--without-notices' => true])->assertSuccessful();

    expect($tee->refresh()->reorder_point)->toBe(19)
        ->and($tee->low_stock_notified_at)->not->toBeNull()
        ->and($this->specialist->notifications()->count())->toBe(0);
});
