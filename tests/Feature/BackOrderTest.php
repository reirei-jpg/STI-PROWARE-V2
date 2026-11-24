<?php

use App\Enums\PreorderKind;
use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\Preorder;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\Preorders\BackOrders;
use App\Services\Stock\ReorderPoints;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Panel revision A2: a sold-out size of an item in the store is a Back
 * Order, kept apart from Coming Soon preorders, with its own statuses,
 * counts and export.
 */

beforeEach(function () {
    $this->specialist = User::factory()->specialist()->create();
    $this->student = User::factory()->student()->create();
});

test('a sold-out size of an item in the store is a back order; a Coming Soon item is a preorder', function () {
    $tee = Product::factory()->create(['name' => 'STI Classic Tee', 'status' => ProductStatus::Available]);
    $soldOut = ProductVariant::factory()->for($tee)->create(['stock_on_hand' => 0]);
    $shirt = Product::factory()->create(['name' => 'Event Shirt', 'status' => ProductStatus::Preorder, 'preorders_close_on' => now()->addDays(10)->toDateString()]);
    $comingSoon = ProductVariant::factory()->for($shirt)->create();
    $this->actingAs($this->student);

    $this->post(route('my-preorders.store', $tee), ['product_variant_id' => $soldOut->id, 'quantity' => '2'])->assertSessionHasNoErrors();
    $this->post(route('my-preorders.store', $shirt), ['product_variant_id' => $comingSoon->id, 'quantity' => '1'])->assertSessionHasNoErrors();

    expect(Preorder::query()->where('product_id', $tee->id)->sole()->kind)->toBe(PreorderKind::BackOrder)
        ->and(Preorder::query()->where('product_id', $shirt->id)->sole()->kind)->toBe(PreorderKind::Preorder);
});

test('back orders are counted by status, apart from each other', function () {
    $variant = ProductVariant::factory()->for(Product::factory()->create(['status' => ProductStatus::Available]))->create(['stock_on_hand' => 0]);
    $backOrder = fn (PreorderStatus $status, int $pieces) => Preorder::factory()->create([
        'product_id' => $variant->product_id, 'product_variant_id' => $variant->id, 'quantity' => $pieces, 'status' => $status, 'kind' => PreorderKind::BackOrder,
    ]);
    $backOrder(PreorderStatus::Active, 3);
    $backOrder(PreorderStatus::Active, 2);
    $backOrder(PreorderStatus::Arrived, 4);
    $backOrder(PreorderStatus::Cancelled, 1);
    $backOrder(PreorderStatus::NotPaid, 1);
    $backOrder(PreorderStatus::NotRestocked, 6);
    // A Coming Soon preorder is not a back order.
    Preorder::factory()->create(['product_variant_id' => $variant->id, 'product_id' => $variant->product_id, 'quantity' => 9, 'status' => PreorderStatus::Active, 'kind' => PreorderKind::Preorder]);

    expect(collect(BackOrders::counts())->map(fn (array $count): int => $count['pieces'])->all())
        ->toBe(['pending' => 5, 'filled' => 4, 'cancelled' => 2, 'not_restocked' => 6]);

    $this->actingAs($this->specialist)
        ->get(route('preorders.index'))
        ->assertInertia(fn (Assert $page) => $page->where('backOrders.pending.pieces', 5)->where('backOrders.pending.sizes', 1));

    $csv = $this->get(route('preorders.back-orders.export'))->assertOk()->streamedContent();

    expect($csv)->toContain('Pending')->toContain('Filled')->toContain('Cancelled')->toContain('Not restocked')
        ->toContain('Returned orders: none. A release is final and there are no refunds.');
});

test('the suggested reorder covers the pending back orders', function () {
    $variant = ProductVariant::factory()->for(Product::factory()->create(['status' => ProductStatus::Available, 'low_stock_alert_at' => 5]))->create(['stock_on_hand' => 0]);
    Preorder::factory()->create(['product_id' => $variant->product_id, 'product_variant_id' => $variant->id, 'quantity' => 4, 'status' => PreorderStatus::Active, 'kind' => PreorderKind::BackOrder]);

    $backOrdered = BackOrders::pendingPieces([$variant])[$variant->id];

    // Reorder Point 5, nothing sold: 6 to be above it, + 4 back-ordered.
    expect($backOrdered)->toBe(4)
        ->and(ReorderPoints::view($variant->refresh(), 0, $backOrdered))->toMatchArray(['back_ordered' => 4, 'suggested' => 10]);
});

test('only the Specialist exports back orders', function () {
    foreach ([User::factory()->schoolAdmin()->create(), User::factory()->cashier()->create(), $this->student] as $user) {
        $this->actingAs($user)->get(route('preorders.back-orders.export'))->assertForbidden();
    }
});
