<?php

use App\Enums\OrderStatus;
use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Enums\StockMovementType;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\Preorder;
use App\Models\Product;
use App\Models\ProductPack;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use App\Notifications\OrderCancelled;
use App\Notifications\OrderPlaced;
use App\Notifications\OrderReady;
use App\Notifications\PreorderArrived;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-03 10:00', 'Asia/Manila'));
    $this->student = User::factory()->student()->create(['name' => 'Juan Dela Cruz', 'email' => 'delacruz.123456@sti.edu.ph']);
    $this->specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
});

/**
 * An Available ballpen at ₱15 a piece, also sold by the Box of 12 for ₱150,
 * with $stock pieces.
 *
 * @return array{0: Product, 1: ProductVariant, 2: ProductPack}
 */
function ballpen(int $stock = 30, ProductStatus $status = ProductStatus::Available): array
{
    $product = Product::factory()->create(['name' => 'STI Ballpen', 'price_centavos' => 1500, 'status' => $status, 'low_stock_alert_at' => 0]);
    $variant = ProductVariant::factory()->for($product)->create(['stock_on_hand' => $stock]);
    $box = ProductPack::factory()->for($product)->soldToStudents(15000)->create(['name' => 'Box', 'pieces' => 12]);

    return [$product, $variant, $box];
}

/**
 * Juan's order of $pieces ballpens, placed through the cart.
 */
function placedOrder(ProductVariant $variant, int $pieces = 2): Order
{
    test()->actingAs(test()->student);
    CartItem::factory()->for(test()->student, 'student')->for($variant, 'variant')->create(['quantity' => $pieces]);
    test()->post(route('my-orders.store'))->assertSessionHasNoErrors();

    return Order::query()->latest('id')->firstOrFail();
}

test('adding the same item again adds to its quantity in the cart', function () {
    [$product, $variant, $box] = ballpen();
    $this->actingAs($this->student);

    $this->post(route('cart.store', $product), ['product_variant_id' => $variant->id, 'quantity' => '2'])
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.message', 'Added 2 pcs of STI Ballpen to your cart.');
    $this->post(route('cart.store', $product), ['product_variant_id' => $variant->id, 'quantity' => '3']);
    $this->post(route('cart.store', $product), ['product_variant_id' => $variant->id, 'product_pack_id' => $box->id, 'quantity' => '1'])
        ->assertInertiaFlash('toast.message', 'Added 1 Box of STI Ballpen to your cart.');

    expect($this->student->cartItems()->orderBy('id')->get(['product_pack_id', 'quantity'])->toArray())
        ->toBe([['product_pack_id' => null, 'quantity' => 5], ['product_pack_id' => $box->id, 'quantity' => 1]]);

    $this->get('/')->assertInertia(fn (Assert $page) => $page->where('cart_count', 2));
});

test('the cart refuses more than the stock, counting what is already in it', function () {
    [$product, $variant, $box] = ballpen(stock: 15);
    $this->actingAs($this->student);

    $this->post(route('cart.store', $product), ['product_variant_id' => $variant->id, 'product_pack_id' => $box->id, 'quantity' => '2'])
        ->assertSessionHasErrors(['quantity' => 'You can have at most 1 Box (12 pcs) of STI Ballpen in your cart (only 15 pcs left).']);

    $this->post(route('cart.store', $product), ['product_variant_id' => $variant->id, 'product_pack_id' => $box->id, 'quantity' => '1'])
        ->assertSessionHasNoErrors();

    // A box (12 pcs) is already in the cart, so only 3 pieces can be added.
    $this->post(route('cart.store', $product), ['product_variant_id' => $variant->id, 'quantity' => '4'])
        ->assertSessionHasErrors(['quantity' => 'You can have at most 3 pcs of STI Ballpen in your cart (only 15 pcs left).']);

    $this->patch(route('cart.update', $this->student->cartItems()->sole()), ['quantity' => '2'])
        ->assertSessionHasErrors(['quantity' => 'You can have at most 1 Box (12 pcs) of STI Ballpen in your cart (only 15 pcs left).']);

    expect($this->student->cartItems()->sole()->quantity)->toBe(1);
});

test('only items students can buy now go in the cart', function (ProductStatus $status) {
    [$product, $variant] = ballpen(status: $status);

    $this->actingAs($this->student)
        ->post(route('cart.store', $product), ['product_variant_id' => $variant->id, 'quantity' => '1'])
        ->assertSessionHasErrors(['quantity' => 'STI Ballpen cannot be bought right now.']);

    expect(CartItem::count())->toBe(0);
})->with([ProductStatus::Draft, ProductStatus::Preorder]);

test('a product sold only by the pack needs a pack, and only packs sold to students', function () {
    [$product, $variant] = ballpen();
    $product->update(['sold_by_piece' => false, 'price_centavos' => null]);
    $headOfficeCase = ProductPack::factory()->for($product)->create(['name' => 'Case', 'pieces' => 100]);
    $this->actingAs($this->student);

    $this->post(route('cart.store', $product), ['product_variant_id' => $variant->id, 'quantity' => '1'])
        ->assertSessionHasErrors(['product_pack_id' => 'STI Ballpen is sold by the pack only. Choose a pack.']);
    $this->post(route('cart.store', $product), ['product_variant_id' => $variant->id, 'product_pack_id' => $headOfficeCase->id, 'quantity' => '1'])
        ->assertSessionHasErrors(['product_pack_id' => 'Choose one of the packs shown.']);
});

test('placing an order takes the stock, keeps today\'s prices and tells the specialist', function () {
    Notification::fake();
    [$product, $variant, $box] = ballpen(stock: 30);
    $product->update(['status' => ProductStatus::OnSale, 'sale_price_centavos' => 1000]);
    $box->update(['sale_price_centavos' => 12000]);
    CartItem::factory()->for($this->student, 'student')->for($variant, 'variant')->create(['quantity' => 3]);
    CartItem::factory()->for($this->student, 'student')->for($variant, 'variant')->create(['product_pack_id' => $box->id, 'quantity' => 2]);

    $this->actingAs($this->student)
        ->post(route('my-orders.store'))
        ->assertRedirect(route('my-orders.index'))
        ->assertInertiaFlash('toast.message', 'Order PW-0001 placed. Pick it up and pay in cash at the PROWARE office by Oct 6, 2026.');

    $order = Order::sole();
    expect($order)
        ->number->toBe('PW-0001')
        ->status->toBe(OrderStatus::Placed)
        ->total_centavos->toBe(3 * 1000 + 2 * 12000)
        ->and($order->pick_up_by->toDateTimeString())->toBe('2026-10-06 23:59:59')
        ->and($order->items()->orderBy('id')->get(['unit_name', 'pieces_per_unit', 'quantity', 'unit_price_centavos', 'line_total_centavos'])->toArray())->toBe([
            ['unit_name' => 'Piece', 'pieces_per_unit' => 1, 'quantity' => 3, 'unit_price_centavos' => 1000, 'line_total_centavos' => 3000],
            ['unit_name' => 'Box', 'pieces_per_unit' => 12, 'quantity' => 2, 'unit_price_centavos' => 12000, 'line_total_centavos' => 24000],
        ])
        ->and($variant->refresh()->stock_on_hand)->toBe(30 - 3 - 24)
        ->and(StockMovement::query()->where('type', StockMovementType::Sale)->orderBy('id')->pluck('balance_after')->all())->toBe([27, 3])
        ->and($this->student->cartItems()->count())->toBe(0);

    Notification::assertSentTo($this->specialist, OrderPlaced::class, fn (OrderPlaced $notice) => $notice->toArray($this->specialist) === [
        'kind' => 'order_placed', 'order_id' => $order->id, 'order_number' => 'PW-0001', 'student_name' => 'Juan Dela Cruz', 'total_centavos' => 27000, 'items_count' => 2,
    ]);

    // The pick-up date is a plain date: My Orders formats it as a day.
    $this->get(route('my-orders.index'))->assertInertia(fn (Assert $page) => $page
        ->component('storefront/my-orders')
        ->where('orders.data.0.number', 'PW-0001')
        ->where('orders.data.0.pick_up_by', '2026-10-06')
    );
    expect((new OrderReady($order))->toArray($this->student)['pick_up_by'])->toBe('2026-10-06');
});

test('an order cannot be placed when stock ran out after it went in the cart', function () {
    [, $variant] = ballpen(stock: 5);
    CartItem::factory()->for($this->student, 'student')->for($variant, 'variant')->create(['quantity' => 4]);
    $variant->forceFill(['stock_on_hand' => 3])->save();

    $this->actingAs($this->student)
        ->post(route('my-orders.store'))
        ->assertSessionHasErrors(['cart' => 'Only 3 pcs of STI Ballpen are left. Change your cart.']);

    expect(Order::count())->toBe(0)
        ->and($variant->refresh()->stock_on_hand)->toBe(3);

    $this->get(route('cart.index'))->assertInertia(fn (Assert $page) => $page
        ->component('storefront/cart')
        ->where('can_place_order', false)
        ->where('lines.0.most_allowed', 3)
        ->where('lines.0.problem', 'Only 3 pcs can be ordered now. Lower the quantity.')
    );
});

test('only the ticked items are ordered and the unticked ones stay in the cart', function () {
    [, $ballpen] = ballpen(stock: 10);
    $umbrella = ProductVariant::factory()->for(Product::factory()->create(['name' => 'STI Umbrella', 'price_centavos' => 35000]))->create(['stock_on_hand' => 5]);
    CartItem::factory()->for($this->student, 'student')->for($ballpen, 'variant')->create(['quantity' => 2]);
    $later = CartItem::factory()->for($this->student, 'student')->for($umbrella, 'variant')->create(['quantity' => 1, 'selected' => false]);

    $this->actingAs($this->student)->post(route('my-orders.store'))->assertSessionHasNoErrors();

    expect(Order::query()->sole()->items()->pluck('product_name')->all())->toBe(['STI Ballpen'])
        ->and(Order::query()->sole()->total_centavos)->toBe(3000)
        ->and($this->student->cartItems()->pluck('id')->all())->toBe([$later->id])
        ->and($ballpen->refresh()->stock_on_hand)->toBe(8)
        ->and($umbrella->refresh()->stock_on_hand)->toBe(5);
});

test('the cart totals only ticked items, and an unticked item\'s problem does not block the order', function () {
    [, $ballpen] = ballpen(stock: 10);
    $soldOut = ProductVariant::factory()->for(Product::factory()->create(['name' => 'STI Umbrella', 'price_centavos' => 35000]))->create(['stock_on_hand' => 0]);
    CartItem::factory()->for($this->student, 'student')->for($ballpen, 'variant')->create(['quantity' => 2]);
    CartItem::factory()->for($this->student, 'student')->for($soldOut, 'variant')->create(['quantity' => 1, 'selected' => false]);

    $this->actingAs($this->student)->get(route('cart.index'))->assertInertia(fn (Assert $page) => $page
        ->where('selected_count', 1)
        ->where('total_centavos', 3000)
        ->where('can_place_order', true)
        ->where('lines.1.selected', false)
        ->where('lines.1.problem', 'Out of stock. Remove it, or untick it to order the rest.')
    );
});

test('a ticked line counts only other ticked lines of the same size when checking stock', function () {
    [, $variant, $box] = ballpen(stock: 12);
    CartItem::factory()->for($this->student, 'student')->for($variant, 'variant')->create(['quantity' => 12]);
    CartItem::factory()->for($this->student, 'student')->for($variant, 'variant')->for($box, 'pack')->create(['quantity' => 1, 'selected' => false]);

    $this->actingAs($this->student)->get(route('cart.index'))->assertInertia(fn (Assert $page) => $page
        ->where('can_place_order', true)
        ->where('lines.0.problem', null)
    );
});

test('a student ticks and unticks only their own cart lines', function () {
    [, $variant] = ballpen();
    $mine = CartItem::factory()->for($this->student, 'student')->for($variant, 'variant')->create();
    $theirs = CartItem::factory()->for($variant, 'variant')->create();

    $this->actingAs($this->student)
        ->patch(route('cart.select'), ['cart_item_ids' => [$mine->id, $theirs->id], 'selected' => false])
        ->assertSessionHasNoErrors();

    expect($mine->refresh()->selected)->toBeFalse()
        ->and($theirs->refresh()->selected)->toBeTrue();
});

test('placing an order with nothing ticked asks to tick the items, and adding an item again ticks it', function () {
    [$product, $variant] = ballpen();
    $line = CartItem::factory()->for($this->student, 'student')->for($variant, 'variant')->create(['selected' => false]);

    $this->actingAs($this->student)
        ->post(route('my-orders.store'))
        ->assertSessionHasErrors(['cart' => 'Tick the items you want to order.']);
    expect(Order::count())->toBe(0);

    $this->post(route('cart.store', $product), ['product_variant_id' => $variant->id, 'quantity' => '1']);

    expect($line->refresh()->selected)->toBeTrue();
});

test('a student can cancel a placed order and the stock goes back', function () {
    [, $variant] = ballpen(stock: 10);
    $order = placedOrder($variant, 4);

    $this->post(route('my-orders.cancel', $order))
        ->assertInertiaFlash('toast.message', 'Order PW-0001 was cancelled.');

    expect($order->refresh())
        ->status->toBe(OrderStatus::Cancelled)
        ->cancel_reason->toBe('Cancelled by the student.')
        ->and($variant->refresh()->stock_on_hand)->toBe(10)
        ->and(StockMovement::query()->latest('id')->first())
        ->type->toBe(StockMovementType::OrderCancelled)
        ->quantity->toBe(4)
        ->balance_after->toBe(10);

    expect($this->student->notifications()->count())->toBe(0);
});

test('once the order is ready the student can no longer cancel it', function () {
    [, $variant] = ballpen();
    $order = placedOrder($variant);
    $order->forceFill(['status' => OrderStatus::Ready])->save();

    $this->post(route('my-orders.cancel', $order))
        ->assertInertiaFlash('toast.message', 'Order PW-0001 is already prepared, so it can no longer be cancelled here. Please talk to the PROWARE office.');

    expect($order->refresh()->status)->toBe(OrderStatus::Ready);
});

test('a student cannot see or cancel another student\'s order', function () {
    [, $variant] = ballpen();
    $order = placedOrder($variant);

    $this->actingAs(User::factory()->student()->create())
        ->post(route('my-orders.cancel', $order))
        ->assertNotFound();

    $this->get(route('my-orders.index'))->assertInertia(fn (Assert $page) => $page->has('orders.data', 0));
});

test('the specialist marks an order ready, then picked up, and can undo a pickup the same day', function () {
    [, $variant] = ballpen();
    $order = placedOrder($variant, 2);
    $this->actingAs($this->specialist);

    $this->post(route('orders.ready', $order))
        ->assertInertiaFlash('toast.message', 'Order PW-0001 is ready for pickup. Juan Dela Cruz was notified.');
    expect($order->refresh()->status)->toBe(OrderStatus::Ready)
        ->and($this->student->notifications()->sole()->type)->toBe(OrderReady::class);

    $this->post(route('orders.picked-up', $order))
        ->assertInertiaFlash('toast.message', 'Order PW-0001 picked up · ₱30.00 paid in cash.');
    expect($order->refresh())->status->toBe(OrderStatus::PickedUp)->handled_by->toBe($this->specialist->id);

    $this->post(route('orders.undo-pickup', $order));
    expect($order->refresh())->status->toBe(OrderStatus::Ready)->picked_up_at->toBeNull();

    $this->post(route('orders.picked-up', $order));
    $this->travel(1)->day();
    $this->post(route('orders.undo-pickup', $order))
        ->assertInertiaFlash('toast.message', 'Order PW-0001\'s pickup can only be undone on the day it was marked.');
    expect($order->refresh()->status)->toBe(OrderStatus::PickedUp);
});

test('the specialist cancels with a reason, the stock goes back and the student is told', function () {
    [, $variant] = ballpen(stock: 10);
    $order = placedOrder($variant, 3);
    $this->actingAs($this->specialist);

    $this->post(route('orders.cancel', $order), ['reason' => ''])
        ->assertSessionHasErrors(['reason' => 'Write why the order is cancelled. The student will see it.']);

    $this->post(route('orders.cancel', $order), ['reason' => 'The ballpens were damaged.'])
        ->assertInertiaFlash('toast.message', 'Order PW-0001 was cancelled and its items went back to stock. Juan Dela Cruz was notified.');

    expect($order->refresh())
        ->status->toBe(OrderStatus::Cancelled)
        ->handled_by->toBe($this->specialist->id)
        ->and($variant->refresh()->stock_on_hand)->toBe(10)
        ->and($this->student->notifications()->sole()->data)->toMatchArray(['kind' => 'order_cancelled', 'reason' => 'The ballpens were damaged.']);

    // A picked-up order cannot be cancelled.
    $pickedUp = placedOrder($variant, 1);
    $pickedUp->forceFill(['status' => OrderStatus::PickedUp])->save();
    $this->actingAs($this->specialist)->post(route('orders.cancel', $pickedUp), ['reason' => 'Mistake'])
        ->assertInertiaFlash('toast.message', 'Order PW-0002 is Picked up, so it cannot be cancelled.');
});

test('orders not picked up by their date cancel themselves', function () {
    [, $variant] = ballpen(stock: 10);
    $late = placedOrder($variant, 2);
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Manila'));
    $onTime = placedOrder($variant, 1);

    $this->travelTo(CarbonImmutable::parse('2026-10-07 00:30', 'Asia/Manila'));
    $this->artisan('orders:cancel-unclaimed')->assertSuccessful();

    expect($late->refresh())
        ->status->toBe(OrderStatus::Cancelled)
        ->cancel_reason->toBe('Not picked up by Oct 6, 2026.')
        ->and($onTime->refresh()->status)->toBe(OrderStatus::Placed)
        ->and($variant->refresh()->stock_on_hand)->toBe(9)
        ->and($this->student->notifications()->sole()->type)->toBe(OrderCancelled::class);
});

test('the orders page shows new orders by default and finds by order number or student', function () {
    [, $variant] = ballpen();
    placedOrder($variant);
    $ready = placedOrder($variant);
    $ready->forceFill(['status' => OrderStatus::Ready])->save();
    $this->actingAs($this->specialist);

    $this->get(route('orders.index'))->assertInertia(fn (Assert $page) => $page
        ->component('orders/index')
        ->where('filters.show', 'placed')
        ->where('counts', ['placed' => 1, 'ready' => 1, 'picked_up' => 0, 'cancelled' => 0])
        ->where('orders.data.0.number', 'PW-0001')
        ->has('orders.data', 1)
    );

    $this->get(route('orders.index', ['show' => 'all', 'search' => 'PW-0002']))
        ->assertInertia(fn (Assert $page) => $page->has('orders.data', 1)->where('orders.data.0.status', 'ready'));
    $this->get(route('orders.index', ['show' => 'all', 'search' => 'dela cruz']))
        ->assertInertia(fn (Assert $page) => $page->has('orders.data', 2));
});

test('students who preordered are told when the item arrives', function () {
    Notification::fake();
    $product = Product::factory()->create(['name' => 'Anniversary Shirt', 'status' => ProductStatus::Preorder, 'preorders_close_on' => '2026-10-20']);
    $variant = ProductVariant::factory()->for($product)->create();
    $product->photos()->create(['path' => 'products/a.jpg', 'position' => 0]);
    Preorder::factory()->for($this->student, 'student')->for($product)->for($variant, 'variant')->create();
    $cancelledStudent = User::factory()->student()->create();
    Preorder::factory()->for($cancelledStudent, 'student')->for($product)->for($variant, 'variant')->create(['status' => PreorderStatus::Cancelled]);

    $this->actingAs($this->specialist)->put(route('products.update', $product), [
        'name' => 'Anniversary Shirt', 'sold_by_piece' => '1', 'price' => '350', 'status' => 'available', 'sale_price' => '',
        'low_stock_alert_at' => '5', 'photos' => [['id' => $product->photos()->value('id'), 'label' => '']], 'packs' => [], 'options' => [],
        'variants' => [['combination' => '', 'estore_item_code' => '', 'estore_pack_key' => '', 'price' => '']],
    ])->assertSessionHasNoErrors();

    Notification::assertSentTo($this->student, PreorderArrived::class);
    Notification::assertNotSentTo($cancelledStudent, PreorderArrived::class);
});

test('only students shop, and only the specialist handles orders', function () {
    [$product, $variant] = ballpen();
    $order = placedOrder($variant);

    $this->actingAs($this->specialist)
        ->post(route('cart.store', $product), ['product_variant_id' => $variant->id, 'quantity' => '1'])
        ->assertForbidden();

    $this->actingAs(User::factory()->schoolAdmin()->create())
        ->get(route('orders.index'))
        ->assertForbidden();

    $this->actingAs($this->student)->get(route('orders.index'))->assertForbidden();
    $this->post(route('orders.ready', $order))->assertForbidden();
});

test('opening an order notice goes to the order', function () {
    [, $variant] = ballpen();
    $order = placedOrder($variant);

    $this->actingAs($this->specialist)
        ->post(route('notifications.open', $this->specialist->notifications()->sole()->id))
        ->assertRedirect(route('orders.index', ['show' => 'all', 'search' => 'PW-0001']));

    $this->post(route('orders.ready', $order));
    $this->actingAs($this->student)
        ->post(route('notifications.open', $this->student->notifications()->sole()->id))
        ->assertRedirect(route('my-orders.index'));
});

test('stock history shows the order and a cancelled order does not count as a sale', function () {
    [$product, $variant] = ballpen(stock: 10);
    StockMovement::factory()->for($variant, 'variant')->create(['created_at' => now()->subDays(30)]);
    $order = placedOrder($variant, 2);
    $this->actingAs($this->specialist);

    $this->get(route('products.stock', $product))->assertInertia(fn (Assert $page) => $page
        ->where('movements.data.0.type', 'sale')
        ->where('movements.data.0.order', ['number' => 'PW-0001', 'student_name' => 'Juan Dela Cruz'])
    );
    $this->get(route('products.index', ['stock' => 'slow']))
        ->assertInertia(fn (Assert $page) => $page->where('slowMovingCount', 0));

    $this->post(route('orders.cancel', $order), ['reason' => 'Changed mind']);

    $this->get(route('products.index', ['stock' => 'slow']))
        ->assertInertia(fn (Assert $page) => $page->where('slowMovingCount', 1)->where('products.data.0.last_sale_at', null));
});
