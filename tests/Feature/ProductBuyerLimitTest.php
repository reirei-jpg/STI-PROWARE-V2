<?php

use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\Preorder;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-11-20 10:00', 'Asia/Manila'));
    $this->student = User::factory()->student()->create(['name' => 'Juan Dela Cruz']);
    // STI Shirt: 10 in stock (5 S, 5 M), at most 2 per buyer.
    $this->shirt = Product::factory()->create(['name' => 'STI Shirt', 'price_centavos' => 35000, 'status' => ProductStatus::Available, 'low_stock_alert_at' => 0, 'most_per_buyer' => 2]);
    $this->small = ProductVariant::factory()->for($this->shirt)->create(['combination' => 'Size: S', 'choices' => [['option' => 'Size', 'choice' => 'S']], 'stock_on_hand' => 5, 'position' => 0]);
    $this->medium = ProductVariant::factory()->for($this->shirt)->create(['combination' => 'Size: M', 'choices' => [['option' => 'Size', 'choice' => 'M']], 'stock_on_hand' => 5, 'position' => 1]);
    StockMovement::factory()->for($this->small, 'variant')->create();
    StockMovement::factory()->for($this->medium, 'variant')->create();
});

test('a buyer gets at most the product\'s Most per buyer, all sizes together', function () {
    $this->actingAs($this->student);

    $this->post(route('cart.store', $this->shirt), ['product_variant_id' => $this->small->id, 'quantity' => '1'])->assertSessionHasNoErrors();
    $this->post(route('cart.store', $this->shirt), ['product_variant_id' => $this->medium->id, 'quantity' => '2'])
        ->assertSessionHasErrors(['quantity' => 'Each buyer can get at most 2 pcs of STI Shirt. You already have 1 pc in your cart, orders or preorders, so you can get 1 pc more.']);
    $this->post(route('cart.store', $this->shirt), ['product_variant_id' => $this->medium->id, 'quantity' => '1'])->assertSessionHasNoErrors();

    $smallLine = CartItem::query()->where('product_variant_id', $this->small->id)->sole();
    $this->patch(route('cart.update', $smallLine), ['quantity' => '2'])
        ->assertSessionHasErrors(['quantity' => 'Each buyer can get at most 2 pcs of STI Shirt. You already have 1 pc in your cart, orders or preorders, so you can get 1 pc more.']);
    expect($smallLine->refresh()->quantity)->toBe(1);

    // Another buyer still gets their own 2.
    $this->actingAs(User::factory()->student()->create())
        ->post(route('cart.store', $this->shirt), ['product_variant_id' => $this->small->id, 'quantity' => '2'])
        ->assertSessionHasNoErrors();
});

test('several sizes added at once are refused together when they go over it', function () {
    $this->actingAs($this->student)
        ->post(route('cart.store', $this->shirt), ['items' => [
            ['product_variant_id' => $this->small->id, 'product_pack_id' => '', 'quantity' => '1'],
            ['product_variant_id' => $this->medium->id, 'product_pack_id' => '', 'quantity' => '2'],
        ]])
        ->assertSessionHasErrors(['items.1.quantity' => 'Each buyer can get at most 2 pcs of STI Shirt. You already have 1 pc in your cart, orders or preorders, so you can get 1 pc more.']);

    expect(CartItem::count())->toBe(0);
});

test('orders count toward it until they are cancelled', function () {
    $this->actingAs($this->student);
    $this->post(route('cart.store', $this->shirt), ['product_variant_id' => $this->small->id, 'quantity' => '2']);
    $this->post(route('my-orders.store'), ['section' => 'BSIT 1-A'])->assertSessionHasNoErrors();

    $this->post(route('cart.store', $this->shirt), ['product_variant_id' => $this->medium->id, 'quantity' => '1'])
        ->assertSessionHasErrors(['quantity' => 'Each buyer can get at most 2 pcs of STI Shirt, and you already have 2 pcs in your cart, orders or preorders.']);

    Order::sole()->forceFill(['status' => OrderStatus::Cancelled])->save();

    $this->post(route('cart.store', $this->shirt), ['product_variant_id' => $this->medium->id, 'quantity' => '2'])->assertSessionHasNoErrors();
});

test('a cart above a limit set later shows the problem and cannot be ordered', function () {
    $this->shirt->forceFill(['most_per_buyer' => null])->save();
    $this->actingAs($this->student)->post(route('cart.store', $this->shirt), ['product_variant_id' => $this->small->id, 'quantity' => '3']);
    $this->shirt->forceFill(['most_per_buyer' => 2])->save();

    $this->get(route('cart.index'))->assertInertia(fn (Assert $page) => $page
        ->where('can_place_order', false)
        ->where('lines.0.most_allowed', 2)
        ->where('lines.0.stopped_by_product', true)
        ->where('lines.0.problem', 'Each buyer can get at most 2 pcs of STI Shirt, counting your orders and preorders. Lower the quantity to 2 pcs.'));
    $this->post(route('my-orders.store'), ['section' => 'BSIT 1-A'])
        ->assertSessionHasErrors(['cart' => 'Each buyer can get at most 2 pcs of STI Shirt, and your cart has 3 pcs. Lower the quantity in your cart.']);

    expect(Order::count())->toBe(0);
});

test('preorders stop at it too, and changing a preorder counts the others only', function () {
    $eventShirt = Product::factory()->create(['name' => 'Event Shirt', 'status' => ProductStatus::Preorder, 'preorders_close_on' => '2026-11-30', 'most_per_buyer' => 2]);
    $size = ProductVariant::factory()->for($eventShirt)->create();
    $this->actingAs($this->student);

    $this->post(route('my-preorders.store', $eventShirt), ['product_variant_id' => $size->id, 'quantity' => '3'])
        ->assertSessionHasErrors(['quantity' => 'Each buyer can get at most 2 pcs of Event Shirt.']);
    $this->post(route('my-preorders.store', $eventShirt), ['product_variant_id' => $size->id, 'quantity' => '1'])->assertSessionHasNoErrors();

    $preorder = Preorder::sole();
    $this->patch(route('my-preorders.update', $preorder), ['product_variant_id' => $size->id, 'quantity' => '3'])
        ->assertSessionHasErrors(['quantity' => 'Each buyer can get at most 2 pcs of Event Shirt.']);
    $this->patch(route('my-preorders.update', $preorder), ['product_variant_id' => $size->id, 'quantity' => '2'])->assertSessionHasNoErrors();

    expect($preorder->refresh()->quantity)->toBe(2);
});

test('the item view tells each buyer the limit and how many more they can get', function () {
    $this->getJson(route('storefront.product', $this->shirt))
        ->assertJsonPath('most_per_buyer', 2)
        ->assertJsonPath('per_buyer_left', 2);

    $this->actingAs($this->student)->post(route('cart.store', $this->shirt), ['product_variant_id' => $this->small->id, 'quantity' => '1']);

    $this->getJson(route('storefront.product', $this->shirt))->assertJsonPath('per_buyer_left', 1);
    Sanctum::actingAs($this->student);
    $this->getJson(route('api.v1.storefront.product', $this->shirt))
        ->assertJsonPath('most_per_buyer', 2)
        ->assertJsonPath('per_buyer_left', 1);
});
