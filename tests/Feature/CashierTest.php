<?php

use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use App\Notifications\OrderPaid;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-11-20 10:00', 'Asia/Manila'));
    $this->cashier = User::factory()->cashier()->create(['name' => 'Cashier 1']);
    $this->specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
    $this->juan = User::factory()->student()->create(['name' => 'Juan Dela Cruz']);
    // STI Lanyard at ₱80, 3 in stock.
    $this->lanyard = ProductVariant::factory()
        ->for(Product::factory()->create(['name' => 'STI Lanyard', 'price_centavos' => 8000, 'status' => ProductStatus::Available, 'low_stock_alert_at' => 0]))
        ->create(['stock_on_hand' => 3]);
    StockMovement::factory()->for($this->lanyard, 'variant')->create();
});

/** The buyer orders $pieces lanyards through the cart. */
function lanyardOrder(User $buyer, int $pieces): Order
{
    CartItem::factory()->for($buyer, 'student')->for(test()->lanyard, 'variant')->create(['quantity' => $pieces]);
    test()->actingAs($buyer)->post(route('my-orders.store'))->assertSessionHasNoErrors();

    return Order::query()->where('user_id', $buyer->id)->latest('id')->firstOrFail();
}

test('signing in takes the cashier to Payments, the only page they have', function () {
    $this->actingAs($this->cashier)->get(route('dashboard'))->assertRedirect(route('cashier.index'));

    $this->get(route('cashier.index'))->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('cashier/index')
        ->where('result', null)
        ->where('paidToday', ['rows' => [], 'total_centavos' => 0]));
    $this->get(route('orders.index'))->assertForbidden();
    $this->get(route('products.index'))->assertForbidden();
});

test('only the cashier takes payments', function () {
    $order = lanyardOrder($this->juan, 1);

    $this->actingAs($this->specialist)->get(route('cashier.index'))->assertForbidden();
    $this->post(route('cashier.orders.paid', $order))->assertForbidden();
    $this->actingAs($this->juan)->post(route('cashier.orders.paid', $order))->assertForbidden();
    Sanctum::actingAs($this->specialist);
    $this->postJson(route('api.v1.cashier.orders.paid', $order))->assertForbidden();

    expect($order->refresh()->status)->toBe(OrderStatus::Placed);
});

test('the cashier scans the slip, collects the amount and marks it paid: the items are set aside and the buyer is told', function () {
    Notification::fake();
    $order = lanyardOrder($this->juan, 2);
    $this->actingAs($this->cashier);

    $this->get(route('cashier.index', ['code' => $order->slip_code]))->assertInertia(fn (Assert $page) => $page
        ->where('result.kind', 'order')
        ->where('result.order.number', $order->number)
        ->where('result.can_mark_paid', true)
        ->where('result.to_collect_centavos', 16000)
        ->where('result.short', []));

    $this->post(route('cashier.orders.paid', $order))
        ->assertInertiaFlash('toast.message', "Order {$order->number} is paid: ₱160.00 from Juan Dela Cruz. The items are set aside; the buyer gets them at the PROWARE office.");

    expect($order->refresh())
        ->status->toBe(OrderStatus::Paid)
        ->paid_to->toBe($this->cashier->id)
        ->and($this->lanyard->refresh())->stock_on_hand->toBe(3)->held_pieces->toBe(2)->freeToSell()->toBe(1);
    Notification::assertSentTo($this->juan, OrderPaid::class);

    // Not twice; typing the number finds it; it is in today's payments.
    $this->post(route('cashier.orders.paid', $order))->assertInertiaFlash('toast.message', "Order {$order->number} is already paid.");
    $this->get(route('cashier.index', ['code' => strtolower((string) $order->number)]))->assertInertia(fn (Assert $page) => $page
        ->where('result.can_mark_paid', false)
        ->where('result.refusal', "Order {$order->number} is already paid.")
        ->where('paidToday.total_centavos', 16000)
        ->where('paidToday.rows.0.number', $order->number)
        ->where('paidToday.rows.0.buyer', 'Juan Dela Cruz'));
});

test('when fewer are left than ordered, the cashier collects only for what is left', function () {
    $bea = User::factory()->student()->create(['name' => 'Bea Villareal']);
    $juansOrder = lanyardOrder($this->juan, 2);
    $beasOrder = lanyardOrder($bea, 2);
    payAtCashier($beasOrder, $this->cashier);

    $this->actingAs($this->cashier)->get(route('cashier.index', ['code' => $juansOrder->number]))->assertInertia(fn (Assert $page) => $page
        ->where('result.to_collect_centavos', 8000)
        ->where('result.short', ['1 pc of STI Lanyard']));
});

test('a paid order can no longer be cancelled by the buyer, and the Specialist releases it', function () {
    $order = lanyardOrder($this->juan, 2);
    payAtCashier($order, $this->cashier);

    $this->actingAs($this->juan)->post(route('my-orders.cancel', $order), ['reason' => 'ordered_by_mistake'])
        ->assertInertiaFlash('toast.message', "Order {$order->number} is already paid, so it can no longer be cancelled. Get your items at the PROWARE office.");
    expect($order->refresh()->status)->toBe(OrderStatus::Paid);

    $this->actingAs($this->specialist)->get(route('orders.index'))->assertInertia(fn (Assert $page) => $page
        ->where('filters.show', 'paid')
        ->where('orders.data.0.number', $order->number)
        ->where('orders.data.0.status_label', 'Paid · ready to release')
        ->where('orders.data.0.paid_to', 'Cashier 1'));

    $this->post(route('orders.release', $order))->assertInertiaFlash('toast.type', 'success');
    expect($order->refresh()->status)->toBe(OrderStatus::PickedUp)
        ->and($this->lanyard->refresh())->stock_on_hand->toBe(1)->held_pieces->toBe(0);
});

test('a cancelled order or a made-up code cannot be paid', function () {
    $order = lanyardOrder($this->juan, 1);
    $this->actingAs($this->juan)->post(route('my-orders.cancel', $order), ['reason' => 'ordered_by_mistake']);

    $this->actingAs($this->cashier)->post(route('cashier.orders.paid', $order))
        ->assertInertiaFlash('toast.message', "Order {$order->number} is cancelled, so it cannot be paid.");
    $this->get(route('cashier.index', ['code' => 'NOT-A-SLIP']))->assertInertia(fn (Assert $page) => $page->where('result', null));

    Sanctum::actingAs($this->cashier);
    $this->getJson(route('api.v1.cashier.slip', ['code' => 'NOT-A-SLIP']))->assertNotFound()
        ->assertJsonPath('message', 'This is not a PROWARE slip. Check the number, or scan the QR again.');
    $this->getJson(route('api.v1.cashier.slip'))->assertUnprocessable()
        ->assertJsonValidationErrors(['code' => 'Scan the slip, or type its number.']);
});

test('the cashier pays an order on the phone too', function () {
    $order = lanyardOrder($this->juan, 1);
    Sanctum::actingAs($this->cashier);

    $this->getJson(route('api.v1.cashier.slip', ['code' => $order->slip_code]))->assertOk()
        ->assertJsonPath('kind', 'order')
        ->assertJsonPath('to_collect_centavos', 8000);
    $this->postJson(route('api.v1.cashier.orders.paid', $order))->assertOk()
        ->assertJsonPath('message', "Order {$order->number} is paid: ₱80.00 from Juan Dela Cruz. The items are set aside; the buyer gets them at the PROWARE office.")
        ->assertJsonPath('result.can_mark_paid', false);
    $this->postJson(route('api.v1.cashier.orders.paid', $order))->assertUnprocessable()
        ->assertJsonValidationErrors(['order' => "Order {$order->number} is already paid."]);
    $this->getJson(route('api.v1.cashier.paid-today'))->assertOk()->assertJsonPath('total_centavos', 8000);
});
