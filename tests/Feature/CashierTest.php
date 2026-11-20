<?php

use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\UndonePayment;
use App\Models\User;
use App\Notifications\OrderPaid;
use App\Notifications\PaymentRecorded;
use App\Notifications\PaymentUndone;
use App\Notifications\PaymentUndoneForStaff;
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
        ->assertInertiaFlash('toast.message', "Order {$order->number}: payment of ₱160.00 from Juan Dela Cruz has been recorded. The items are reserved for pickup at the PROWARE office.");

    expect($order->refresh())
        ->status->toBe(OrderStatus::Paid)
        ->paid_to->toBe($this->cashier->id)
        ->and($this->lanyard->refresh())->stock_on_hand->toBe(3)->held_pieces->toBe(2)->freeToSell()->toBe(1);
    Notification::assertSentTo($this->juan, OrderPaid::class);

    // Not twice; typing the number finds it; it is in today's payments.
    $this->post(route('cashier.orders.paid', $order))->assertInertiaFlash('toast.message', "Order {$order->number} has already been paid.");
    $this->get(route('cashier.index', ['code' => strtolower((string) $order->number)]))->assertInertia(fn (Assert $page) => $page
        ->where('result.can_mark_paid', false)
        ->where('result.refusal', "Order {$order->number} has already been paid.")
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
        ->assertInertiaFlash('toast.message', "Order {$order->number} has already been paid, so it can no longer be cancelled. Claim your items at the PROWARE office.");
    expect($order->refresh()->status)->toBe(OrderStatus::Paid);

    $this->actingAs($this->specialist)->get(route('orders.index'))->assertInertia(fn (Assert $page) => $page
        ->where('filters.show', 'paid')
        ->where('orders.data.0.number', $order->number)
        ->where('orders.data.0.status_label', 'Paid · Ready for pickup')
        ->where('orders.data.0.paid_to', 'Cashier 1'));

    $this->post(route('orders.release', $order))->assertInertiaFlash('toast.type', 'success');
    expect($order->refresh()->status)->toBe(OrderStatus::PickedUp)
        ->and($this->lanyard->refresh())->stock_on_hand->toBe(1)->held_pieces->toBe(0);
});

test('a cancelled order or a made-up code cannot be paid', function () {
    $order = lanyardOrder($this->juan, 1);
    $this->actingAs($this->juan)->post(route('my-orders.cancel', $order), ['reason' => 'ordered_by_mistake']);

    $this->actingAs($this->cashier)->post(route('cashier.orders.paid', $order))
        ->assertInertiaFlash('toast.message', "Order {$order->number} has been cancelled, so the payment cannot be accepted.");
    $this->get(route('cashier.index', ['code' => 'NOT-A-SLIP']))->assertInertia(fn (Assert $page) => $page->where('result', null));
    $this->from(route('cashier.index'))->get(route('cashier.index', ['code' => str_repeat('X', 121)]))
        ->assertSessionHasErrors(['code' => 'The slip number is too long. Check the number or scan the QR code again.']);

    Sanctum::actingAs($this->cashier);
    $this->getJson(route('api.v1.cashier.slip', ['code' => 'NOT-A-SLIP']))->assertNotFound()
        ->assertJsonPath('message', 'No PROWARE slip matches this code. Check the number or scan the QR code again.');
    $this->getJson(route('api.v1.cashier.slip'))->assertUnprocessable()
        ->assertJsonValidationErrors(['code' => 'Scan the slip or enter its number.']);
    $this->getJson(route('api.v1.cashier.slip', ['code' => str_repeat('X', 121)]))->assertUnprocessable()
        ->assertJsonValidationErrors(['code' => 'The slip number is too long. Check the number or scan the QR code again.']);
});

test('the cashier pays an order on the phone too', function () {
    $order = lanyardOrder($this->juan, 1);
    Sanctum::actingAs($this->cashier);

    $this->getJson(route('api.v1.cashier.slip', ['code' => $order->slip_code]))->assertOk()
        ->assertJsonPath('kind', 'order')
        ->assertJsonPath('to_collect_centavos', 8000);
    $this->postJson(route('api.v1.cashier.orders.paid', $order))->assertOk()
        ->assertJsonPath('message', "Order {$order->number}: payment of ₱80.00 from Juan Dela Cruz has been recorded. The items are reserved for pickup at the PROWARE office.")
        ->assertJsonPath('result.can_mark_paid', false);
    $this->postJson(route('api.v1.cashier.orders.paid', $order))->assertUnprocessable()
        ->assertJsonValidationErrors(['order' => "Order {$order->number} has already been paid."]);
    $this->getJson(route('api.v1.cashier.paid-today'))->assertOk()->assertJsonPath('total_centavos', 8000);
});

test('the Specialist is told when the cashier records a payment, ready for release', function () {
    Notification::fake();
    $order = lanyardOrder($this->juan, 2);

    $this->actingAs($this->cashier)->post(route('cashier.orders.paid', $order));

    Notification::assertSentTo($this->specialist, PaymentRecorded::class, function (PaymentRecorded $notice) use ($order): bool {
        expect($notice->toPush($this->specialist))
            ->title->toBe("Paid: {$order->number} · Juan Dela Cruz")
            ->body->toBe('₱160.00 recorded by Cashier 1. Ready for release.');

        return true;
    });
    Notification::assertNotSentTo($this->juan, PaymentRecorded::class);
});

test('the cashier undoes a payment recorded by mistake: the order waits for payment again and everyone is told', function () {
    Notification::fake();
    $bea = User::factory()->student()->create(['name' => 'Bea Villareal']);
    $order = lanyardOrder($this->juan, 2);
    // Bea paid first for 2 of the 3, so Juan was charged for the 1 left.
    payAtCashier(lanyardOrder($bea, 2), $this->cashier);
    $this->actingAs($this->cashier)->post(route('cashier.orders.paid', $order));
    expect($this->lanyard->refresh()->held_pieces)->toBe(3);

    $this->get(route('cashier.index', ['code' => $order->number]))->assertInertia(fn (Assert $page) => $page->where('result.can_undo', true));
    $this->post(route('cashier.orders.undo-payment', $order), ['reason' => 'Scanned the wrong slip'])
        ->assertInertiaFlash('toast.message', "The payment for order {$order->number} (₱80.00 from Juan Dela Cruz) has been undone. The order is waiting for payment again.");

    // Waiting for payment again, at its full amount; the piece set aside is for sale again.
    expect($order->refresh())->status->toBe(OrderStatus::Placed)->total_centavos->toBe(16000)->paid_at->toBeNull()->paid_to->toBeNull()
        ->and($order->items->sole())->quantity_short->toBe(0)->line_total_centavos->toBe(16000)
        ->and($this->lanyard->refresh())->held_pieces->toBe(2)
        ->and(UndonePayment::sole())->order_id->toBe($order->id)->amount_centavos->toBe(8000)->paid_by->toBe($this->cashier->id)->undone_by->toBe($this->cashier->id)->reason->toBe('Scanned the wrong slip.');

    Notification::assertSentTo($this->juan, PaymentUndone::class, fn (PaymentUndone $notice): bool => $notice->toPush($this->juan) === [
        'title' => 'Payment undone: STI Lanyard',
        'body' => 'The cashier undid your ₱80.00 payment: Scanned the wrong slip. Pay at the cashier again to claim your items.',
        'data' => ['kind' => 'payment_undone', 'order_id' => $order->id, 'slip_id' => null],
    ]);
    Notification::assertSentTo($this->specialist, PaymentUndoneForStaff::class, fn (PaymentUndoneForStaff $notice): bool => $notice->toPush($this->specialist)['body']
        === '₱80.00, undone by Cashier 1: Scanned the wrong slip. It is waiting for payment again.');

    // Today's list keeps it as Undone, out of the total; the Specialist can no longer release it.
    $this->get(route('cashier.index'))->assertInertia(fn (Assert $page) => $page
        ->where('paidToday.total_centavos', 16000)
        ->where('paidToday.rows', fn ($rows): bool => collect($rows)->where('undone', true)->pluck('number')->all() === [$order->number]));
    $this->actingAs($this->specialist)->post(route('orders.release', $order))
        ->assertInertiaFlash('toast.message', "Order {$order->number} has not been paid. The buyer must pay at the cashier before the items can be released.");
});

test('a payment can be undone only by the cashier, with a reason, on the same day and before release', function () {
    $order = lanyardOrder($this->juan, 1);
    payAtCashier($order, $this->cashier);

    // A reason is required.
    $this->actingAs($this->cashier)->post(route('cashier.orders.undo-payment', $order), ['reason' => ''])
        ->assertSessionHasErrors(['reason' => 'Enter the reason for undoing the payment.']);
    $this->post(route('cashier.orders.undo-payment', $order), ['reason' => 'no'])
        ->assertSessionHasErrors(['reason' => 'The reason must be at least 5 characters.']);

    // Only the cashier.
    $this->actingAs($this->specialist)->post(route('cashier.orders.undo-payment', $order), ['reason' => 'Wrong slip.'])->assertForbidden();
    $this->actingAs($this->juan)->post(route('cashier.orders.undo-payment', $order), ['reason' => 'Wrong slip.'])->assertForbidden();

    // Not the next day.
    $this->travel(1)->days();
    $this->actingAs($this->cashier)->get(route('cashier.index', ['code' => $order->number]))->assertInertia(fn (Assert $page) => $page->where('result.can_undo', false));
    $this->post(route('cashier.orders.undo-payment', $order), ['reason' => 'Wrong slip.'])
        ->assertInertiaFlash('toast.message', "The payment for order {$order->number} was recorded on Nov 20, 2026. A payment can only be undone on the day it was recorded.");

    // Not once released.
    $this->travel(-1)->days();
    $this->actingAs($this->specialist)->post(route('orders.release', $order));
    $this->actingAs($this->cashier)->post(route('cashier.orders.undo-payment', $order), ['reason' => 'Wrong slip.'])
        ->assertInertiaFlash('toast.message', "Order {$order->number} has already been released, so its payment can no longer be undone.");

    // Nothing to undo on an unpaid order.
    $unpaid = lanyardOrder($this->juan, 1);
    $this->actingAs($this->cashier)->post(route('cashier.orders.undo-payment', $unpaid), ['reason' => 'Wrong slip.'])
        ->assertInertiaFlash('toast.message', "Order {$unpaid->number} has no recorded payment to undo.");

    expect(UndonePayment::count())->toBe(0);
});

test('the cashier undoes a payment on the phone too', function () {
    $order = lanyardOrder($this->juan, 1);
    payAtCashier($order, $this->cashier);
    Sanctum::actingAs($this->cashier);

    $this->getJson(route('api.v1.cashier.slip', ['code' => $order->number]))->assertJsonPath('can_undo', true);
    $this->postJson(route('api.v1.cashier.orders.undo-payment', $order))->assertUnprocessable()
        ->assertJsonValidationErrors(['reason' => 'Enter the reason for undoing the payment.']);
    $this->postJson(route('api.v1.cashier.orders.undo-payment', $order), ['reason' => 'The buyer did not pay.'])->assertOk()
        ->assertJsonPath('message', "The payment for order {$order->number} (₱80.00 from Juan Dela Cruz) has been undone. The order is waiting for payment again.")
        ->assertJsonPath('result.can_mark_paid', true)
        ->assertJsonPath('result.can_undo', false);
    $this->getJson(route('api.v1.cashier.paid-today'))->assertJsonPath('total_centavos', 0)->assertJsonPath('rows.0.undone', true)->assertJsonPath('rows.0.reason', 'The buyer did not pay.');

    Sanctum::actingAs($this->specialist);
    $this->postJson(route('api.v1.cashier.orders.undo-payment', $order), ['reason' => 'Wrong slip.'])->assertForbidden();
});
