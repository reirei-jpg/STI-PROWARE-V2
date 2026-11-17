<?php

use App\Enums\OrderStatus;
use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Preorder;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-11-13 10:00', 'Asia/Manila'));
    $this->specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
});

test('the dashboard shows low stock and this month\'s best sellers', function () {
    $lanyard = Product::factory()->create(['name' => 'STI Lanyard', 'status' => ProductStatus::Available, 'low_stock_alert_at' => 5]);
    $lanyardVariant = ProductVariant::factory()->for($lanyard)->create(['stock_on_hand' => 2]);
    $umbrella = Product::factory()->create(['name' => 'STI Umbrella', 'status' => ProductStatus::Available, 'low_stock_alert_at' => 5]);
    ProductVariant::factory()->for($umbrella)->create(['stock_on_hand' => 0]);
    Product::factory()->create(['name' => 'STI Ballpen', 'status' => ProductStatus::Available, 'low_stock_alert_at' => 5])
        ->variants()->save(ProductVariant::factory()->make(['stock_on_hand' => 50]));

    $order = Order::factory()->create(['status' => OrderStatus::PickedUp, 'picked_up_at' => now()]);
    OrderItem::factory()->for($order)->for($lanyardVariant, 'variant')->create(['product_id' => $lanyard->id, 'product_name' => 'STI Lanyard', 'quantity' => 3, 'pieces_per_unit' => 1]);

    $this->actingAs($this->specialist)->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page
        ->where('stockCards.low_stock.count', 2)
        ->where('stockCards.low_stock.items.0.product_name', 'STI Umbrella')
        ->where('stockCards.low_stock.items.0.out_of_stock', true)
        ->where('stockCards.low_stock.items.1.pieces_left', 2)
        ->where('stockCards.best_sellers.from', '2026-11-01')
        ->where('stockCards.best_sellers.items.0', ['product_id' => $lanyard->id, 'product_name' => 'STI Lanyard', 'pieces' => 3]));

    // The phone's To-do has the same cards.
    Sanctum::actingAs($this->specialist);
    $this->getJson(route('api.v1.specialist.tasks'))
        ->assertJsonPath('stock_cards.low_stock.count', 2);
});

test('a low item with sizes names the sizes that are low, not its total', function () {
    $hat = Product::factory()->create(['name' => 'STI Bucket Hat', 'status' => ProductStatus::Available, 'low_stock_alert_at' => 3]);
    ProductVariant::factory()->for($hat)->create(['combination' => 'Size: S/M', 'choices' => [['option' => 'Size', 'choice' => 'S/M']], 'stock_on_hand' => 1]);
    ProductVariant::factory()->for($hat)->create(['combination' => 'Size: L/XL', 'choices' => [['option' => 'Size', 'choice' => 'L/XL']], 'stock_on_hand' => 4]);
    ProductVariant::factory()->for($hat)->create(['combination' => 'Size: XXL', 'choices' => [['option' => 'Size', 'choice' => 'XXL']], 'stock_on_hand' => 0]);

    $this->actingAs($this->specialist)->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page
        ->where('stockCards.low_stock.items.0.pieces_left', 5)
        ->where('stockCards.low_stock.items.0.low_sizes', 'XXL: none left, S/M: 1 pc left'));
});

test('Ready to order and Preorders to set up are no longer on the dashboard or in Maintenance', function () {
    $hoodie = Product::factory()->create(['name' => 'STI Batch 2027 Hoodie', 'status' => ProductStatus::Preorder, 'preorders_close_on' => '2026-11-30']);
    $variant = ProductVariant::factory()->for($hoodie)->create();
    markPreorderPaid(Preorder::factory()->forVariant($variant)->create(['quantity' => 25, 'status' => PreorderStatus::Active]));
    Preorder::factory()->forVariant($variant)->create(['quantity' => 3, 'status' => PreorderStatus::Active]);

    $this->actingAs($this->specialist)->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page
        ->missing('stockCards.ready_to_order')
        ->missing('stockCards.preorders_to_set_up')
        ->has('stockCards.preorder_slips'));
    $this->get(route('maintenance.index'))->assertInertia(fn (Assert $page) => $page->missing('preordersBeforeOrdering'));

    Sanctum::actingAs($this->specialist);
    $this->getJson(route('api.v1.specialist.tasks'))
        ->assertJsonMissingPath('stock_cards.ready_to_order')
        ->assertJsonMissingPath('stock_cards.preorders_to_set_up');
});
