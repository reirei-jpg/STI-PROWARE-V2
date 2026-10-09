<?php

use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Setting;
use App\Models\StockMovement;
use App\Models\User;
use App\Notifications\OrderLastDay;
use App\Services\Shop\OrderRules;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-09 10:00', 'Asia/Manila'));
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
 * The student places an order of $pieces lanyards through the cart.
 */
function orderLanyards(User $student, ProductVariant $variant, int $pieces)
{
    CartItem::factory()->for($student, 'student')->for($variant, 'variant')->create(['quantity' => $pieces]);

    return test()->actingAs($student)->post(route('my-orders.store'));
}

test('pieces held for one student\'s order cannot be bought by another', function () {
    $variant = lanyard(stock: 2);
    $other = User::factory()->student()->create();
    orderLanyards(User::factory()->student()->create(), $variant, 2)->assertSessionHasNoErrors();

    $this->actingAs($other)
        ->post(route('cart.store', $variant->product_id), ['product_variant_id' => $variant->id, 'quantity' => '1'])
        ->assertSessionHasErrors(['quantity' => 'STI Lanyard is out of stock.']);
    $this->get(route('storefront.product', $variant->product_id))
        ->assertJsonPath('sold_out', true)
        ->assertJsonPath('variants.0.stock_pieces', 0);

    expect($variant->refresh())->stock_on_hand->toBe(2)->held_pieces->toBe(2);
});

test('a student with two orders waiting cannot place a third', function () {
    $variant = lanyard(stock: 10);
    $student = User::factory()->student()->create();
    orderLanyards($student, $variant, 1)->assertSessionHasNoErrors();
    orderLanyards($student, $variant, 1)->assertSessionHasNoErrors();

    orderLanyards($student, $variant, 1)
        ->assertSessionHasErrors(['cart' => 'You already have 2 orders waiting for pickup. Pick them up or cancel one before placing another.']);

    expect(Order::count())->toBe(2)
        ->and($variant->refresh()->held_pieces)->toBe(2);
});

test('three expired orders in a month pause ordering for a week, unless the Specialist lifts it', function () {
    $variant = lanyard(stock: 10);
    $student = User::factory()->student()->create();
    foreach (['2026-09-20', '2026-10-01', '2026-10-08'] as $day) {
        Order::factory()->for($student, 'student')->create(['status' => OrderStatus::Cancelled, 'expired_at' => "{$day} 00:30"]);
    }

    orderLanyards($student, $variant, 1)
        ->assertSessionHasErrors(['cart' => 'Ordering is paused until Oct 15, 2026, because 3 of your orders expired without being picked up. Ask the PROWARE office if this is a mistake.']);

    OrderRules::liftPause($student);

    orderLanyards($student, $variant, 1)->assertSessionHasNoErrors();
});

test('the pause ends by itself after a week, and orders the student cancelled do not count', function () {
    $variant = lanyard(stock: 10);
    $student = User::factory()->student()->create();
    foreach (['2026-09-20', '2026-10-01'] as $day) {
        Order::factory()->for($student, 'student')->create(['status' => OrderStatus::Cancelled, 'expired_at' => "{$day} 00:30"]);
    }
    Order::factory()->for($student, 'student')->create(['status' => OrderStatus::Cancelled, 'cancelled_at' => now()]);

    orderLanyards($student, $variant, 1)->assertSessionHasNoErrors();

    Order::factory()->for($student, 'student')->create(['status' => OrderStatus::Cancelled, 'expired_at' => '2026-10-02 00:30']);
    $this->travelTo(CarbonImmutable::parse('2026-10-09 11:00', 'Asia/Manila'));

    expect(OrderRules::pausedUntil($student->refresh()))->toBeNull();
});

test('an order holds its items for the Specialist\'s number of days, from 1 to 3', function (string $setting, string $holdUntil) {
    Setting::put(Setting::ORDER_HOLD_DAYS, $setting);

    expect(OrderRules::holdUntil()->toDateTimeString())->toBe($holdUntil);
})->with([
    'default (no setting) is 2 days' => ['', '2026-10-11 23:59:59'],
    '1 day' => ['1', '2026-10-10 23:59:59'],
    'more than 3 is kept at 3' => ['9', '2026-10-12 23:59:59'],
]);

test('the student is reminded once, on the morning of the order\'s last day', function () {
    Notification::fake();
    $student = User::factory()->student()->create();
    $lastDay = Order::factory()->for($student, 'student')->create(['pick_up_by' => now()->endOfDay()]);
    Order::factory()->for($student, 'student')->create(['pick_up_by' => now()->addDay()->endOfDay()]);
    Order::factory()->for($student, 'student')->create(['status' => OrderStatus::PickedUp, 'pick_up_by' => now()->endOfDay()]);

    $this->travelTo(CarbonImmutable::parse('2026-10-09 06:00', 'Asia/Manila'));
    $this->artisan('orders:remind-last-day')->assertSuccessful();
    Notification::assertNothingSent();

    $this->travelTo(CarbonImmutable::parse('2026-10-09 08:00', 'Asia/Manila'));
    $this->artisan('orders:remind-last-day')->assertSuccessful();
    $this->artisan('orders:remind-last-day')->assertSuccessful();

    Notification::assertSentToTimes($student, OrderLastDay::class, 1);
    Notification::assertSentTo($student, OrderLastDay::class, fn (OrderLastDay $notice) => $notice->order->is($lastDay)
        && $notice->toPush($student)['title'] === "Last day to get order {$lastDay->number}");
});

test('the Specialist finds an order by its slip\'s QR code or its order number, and a made-up code is not a slip', function () {
    $student = User::factory()->student()->create(['name' => 'Juan Dela Cruz']);
    $order = Order::factory()->for($student, 'student')->create(['student_section' => 'BSIT 1-A']);
    OrderItem::factory()->for($order)->create();
    $other = Order::factory()->for($student, 'student')->create(['status' => OrderStatus::Ready]);
    Sanctum::actingAs(User::factory()->specialist()->create());

    $this->getJson(route('api.v1.specialist.slips.show', $order->slip_code))
        ->assertOk()
        ->assertJsonPath('order.number', $order->number)
        ->assertJsonPath('order.student_section', 'BSIT 1-A')
        ->assertJsonPath('other_open_orders', [['id' => $other->id, 'number' => $other->number, 'status_label' => 'Ready for pickup']]);
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

test('the shelf cannot be corrected below what is held for orders', function () {
    $variant = lanyard(stock: 10);
    orderLanyards(User::factory()->student()->create(), $variant, 4)->assertSessionHasNoErrors();

    $this->actingAs(User::factory()->specialist()->create())
        ->post(route('products.stock.correct', $variant->product_id), [
            'product_variant_id' => $variant->id,
            'reason' => 'damaged',
            'pieces_to_remove' => '7',
        ])
        ->assertSessionHasErrors(['pieces_to_remove' => "4 pcs are held for students' orders, so the shelf cannot have fewer. Cancel those orders first, or count again."]);

    expect($variant->refresh()->stock_on_hand)->toBe(10);
});
