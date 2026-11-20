<?php

use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use App\Notifications\OrderPaid;
use App\Notifications\OrderReleased;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-09 10:00', 'Asia/Manila'));
    $this->specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
});

/**
 * An Available STI Lanyard at ₱80 a piece with $stock pieces on the shelf.
 */
function lanyard(int $stock): ProductVariant
{
    $variant = ProductVariant::factory()
        ->for(Product::factory()->create(['name' => 'STI Lanyard', 'price_centavos' => 8000, 'status' => ProductStatus::Available, 'low_stock_alert_at' => 0]))
        ->create(['stock_on_hand' => $stock]);
    StockMovement::factory()->for($variant, 'variant')->create();

    return $variant;
}

/**
 * The buyer places an order of $pieces lanyards through the cart.
 */
function orderLanyards(User $student, ProductVariant $variant, int $pieces)
{
    CartItem::factory()->for($student, 'student')->for($variant, 'variant')->create(['quantity' => $pieces]);

    return test()->actingAs($student)->post(route('my-orders.store'));
}

test('an order does not hold stock, so another buyer can still order the same pieces', function () {
    $variant = lanyard(stock: 2);
    $other = User::factory()->student()->create();
    orderLanyards(User::factory()->student()->create(), $variant, 2)->assertSessionHasNoErrors();

    $this->actingAs($other)
        ->post(route('cart.store', $variant->product_id), ['product_variant_id' => $variant->id, 'quantity' => '2'])
        ->assertSessionHasNoErrors();
    $this->get(route('storefront.product', $variant->product_id))
        ->assertJsonPath('sold_out', false)
        ->assertJsonPath('variants.0.stock_pieces', 2);

    expect($variant->refresh())->stock_on_hand->toBe(2)->held_pieces->toBe(0)
        ->and(Order::sole()->pick_up_by)->toBeNull();
});

test('whoever pays first at the cashier gets the stock, and a buyer who pays later gets what is left', function () {
    $variant = lanyard(stock: 3);
    $juan = User::factory()->student()->create(['name' => 'Juan Dela Cruz']);
    $bea = User::factory()->student()->create(['name' => 'Bea Villareal']);
    orderLanyards($juan, $variant, 2)->assertSessionHasNoErrors();
    orderLanyards($bea, $variant, 2)->assertSessionHasNoErrors();
    [$juansOrder, $beasOrder] = Order::query()->orderBy('id')->get()->all();

    // Bea pays first: both are set aside for her.
    expect(payAtCashier($beasOrder))->toBe("Order {$beasOrder->number} is paid: ₱160.00 from Bea Villareal. The items are set aside; the buyer gets them at the PROWARE office.")
        ->and($variant->refresh())->stock_on_hand->toBe(3)->held_pieces->toBe(2);

    // Juan pays later: only 1 is left, so he pays for 1 and the other is short.
    expect(payAtCashier($juansOrder))->toBe("Order {$juansOrder->number} is paid: ₱80.00 from Juan Dela Cruz. The items are set aside; the buyer gets them at the PROWARE office. Not charged (already sold to buyers who paid first): 1 pc of STI Lanyard.");

    $this->actingAs($this->specialist)
        ->post(route('orders.release', $beasOrder))
        ->assertInertiaFlash('toast.message', "Order {$beasOrder->number} has been released to Bea Villareal. Paid at the cashier: ₱160.00.");
    $this->post(route('orders.release', $juansOrder))
        ->assertInertiaFlash('toast.message', "Order {$juansOrder->number} has been released to Juan Dela Cruz. Paid at the cashier: ₱80.00.");

    expect($juansOrder->refresh())->status->toBe(OrderStatus::PickedUp)->total_centavos->toBe(8000)
        ->and($juansOrder->items->sole())->quantity->toBe(2)->quantity_short->toBe(1)->line_total_centavos->toBe(8000)
        ->and($variant->refresh())->stock_on_hand->toBe(0)->held_pieces->toBe(0)
        ->and(StockMovement::query()->where('order_item_id', $juansOrder->items->sole()->id)->sole())->quantity->toBe(-1)->balance_after->toBe(0);
});

test('the paid and release notices name what the buyer got and what was sold out before they paid', function () {
    Notification::fake();
    $lanyard = lanyard(stock: 1);
    $cap = lanyard(stock: 1);
    $cap->product->update(['name' => 'STI Cap']);
    $juan = User::factory()->student()->create(['name' => 'Juan Dela Cruz']);
    CartItem::factory()->for($juan, 'student')->for($lanyard, 'variant')->create(['quantity' => 1]);
    orderLanyards($juan, $cap, 1)->assertSessionHasNoErrors();
    $juansOrder = Order::sole();
    // Bea pays first for the only cap.
    orderLanyards(User::factory()->student()->create(['name' => 'Bea Villareal']), $cap, 1);
    payAtCashier(Order::query()->latest('id')->first());

    payAtCashier($juansOrder);
    $this->actingAs($this->specialist)->post(route('orders.release', $juansOrder))->assertSessionHasNoErrors();

    Notification::assertSentTo($juan, OrderPaid::class, function (OrderPaid $notice) use ($juan): bool {
        expect($notice->toArray($juan))->items->toBe('STI Lanyard')->total_centavos->toBe(8000)->short->toBe('1 pc of STI Cap')
            ->and($notice->toPush($juan))->title->toBe('Paid: STI Lanyard')
            ->body->toBe('₱80.00 paid. Get your items at the PROWARE office with your issuance slip. Sold out before you paid, so you were not charged for: 1 pc of STI Cap.');

        return true;
    });
    Notification::assertSentTo($juan, OrderReleased::class, function (OrderReleased $notice) use ($juan): bool {
        expect($notice->toArray($juan))->items->toBe('STI Lanyard')->short->toBe('1 pc of STI Cap')
            ->and($notice->toPush($juan))->title->toBe('Released to you: STI Lanyard')
            ->body->toBe('Sold out before you paid, so you were not charged for: 1 pc of STI Cap.');

        return true;
    });
});

test('an order with nothing left in stock cannot be paid', function () {
    $variant = lanyard(stock: 1);
    orderLanyards(User::factory()->student()->create(), $variant, 1);
    orderLanyards(User::factory()->student()->create(), $variant, 1);
    [$first, $second] = Order::query()->orderBy('id')->get()->all();

    payAtCashier($second);

    expect(fn () => payAtCashier($first))->toThrow(ValidationException::class, "Nothing of order {$first->number} is left in stock, so it cannot be paid. The buyer can cancel it and order again when it is back.")
        ->and($first->refresh()->status)->toBe(OrderStatus::Placed);
});
test('a buyer can have several orders waiting at once', function () {
    $variant = lanyard(stock: 10);
    $student = User::factory()->student()->create();

    foreach (range(1, 3) as $order) {
        orderLanyards($student, $variant, 1)->assertSessionHasNoErrors();
    }

    expect(Order::count())->toBe(3)
        ->and($variant->refresh()->held_pieces)->toBe(0);
});

test('the Specialist finds an order by its slip\'s QR code or its order number, and a made-up code is not a slip', function () {
    $student = User::factory()->student()->create(['name' => 'Juan Dela Cruz']);
    $order = Order::factory()->for($student, 'student')->create(['student_section' => 'BSIT 1-A']);
    OrderItem::factory()->for($order)->create();
    $other = Order::factory()->for($student, 'student')->create();
    Sanctum::actingAs($this->specialist);

    $this->getJson(route('api.v1.specialist.slips.show', $order->slip_code))
        ->assertOk()
        ->assertJsonPath('order.number', $order->number)
        ->assertJsonPath('order.student_section', 'BSIT 1-A')
        ->assertJsonPath('other_open_orders', [['id' => $other->id, 'number' => $other->number, 'status_label' => 'Waiting for payment']]);
    $this->getJson(route('api.v1.specialist.slips.show', strtolower($order->number)))
        ->assertJsonPath('order.id', $order->id);
    $this->getJson(route('api.v1.specialist.slips.show', 'not-a-real-code'))
        ->assertNotFound()
        ->assertJsonPath('message', 'This is not a PROWARE issuance slip.');
});

test('a student cannot look up issuance slips', function () {
    $order = Order::factory()->create();
    Sanctum::actingAs(User::factory()->student()->create());

    $this->getJson(route('api.v1.specialist.slips.show', $order->slip_code))->assertForbidden();
});

test('orders waiting for payment do not stop a stock correction', function () {
    $variant = lanyard(stock: 10);
    orderLanyards(User::factory()->student()->create(), $variant, 4)->assertSessionHasNoErrors();

    $this->actingAs($this->specialist)
        ->post(route('products.stock.correct', $variant->product_id), [
            'product_variant_id' => $variant->id,
            'reason' => 'damaged',
            'pieces_to_remove' => '7',
            'confirmed' => true,
        ])
        ->assertSessionDoesntHaveErrors('pieces_to_remove');

    expect($variant->refresh()->stock_on_hand)->toBe(3);
});
