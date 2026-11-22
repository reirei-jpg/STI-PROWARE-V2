<?php

use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Preorder;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockMovement;
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
    $this->schoolAdmin = User::factory()->schoolAdmin()->create(['name' => 'Liza Garcia']);
    $this->juan = User::factory()->student()->create(['name' => 'Juan Dela Cruz', 'student_id' => '02000123456']);
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

test('signing in takes the cashier to the Dashboard; the Specialist and buyers cannot open the cashier pages', function () {
    $order = lanyardOrder($this->juan, 1);

    $this->actingAs($this->cashier)->get(route('dashboard'))->assertRedirect(route('cashier.index'));
    $this->get(route('cashier.index'))->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('cashier/dashboard')
        ->where('today.count', 0)
        ->where('awaiting.orders', 1)
        ->where('awaiting.total_centavos', 8000)
        ->where('oldest_awaiting.0.number', $order->number));
    $this->get(route('orders.index'))->assertForbidden();
    $this->get(route('products.index'))->assertForbidden();

    foreach ([$this->specialist, $this->juan] as $other) {
        $this->actingAs($other);

        foreach (['cashier.index', 'cashier.record', 'cashier.awaiting.index', 'cashier.payments.index', 'cashier.collections.index', 'cashier.payments.export', 'cashier.collections.daily'] as $page) {
            $this->get(route($page))->assertForbidden();
        }

        $this->post(route('cashier.orders.paid', $order), paidInCash())->assertForbidden();
    }

    Sanctum::actingAs($this->specialist);
    $this->postJson(route('api.v1.cashier.orders.paid', $order), paidInCash())->assertForbidden();
    $this->getJson(route('api.v1.cashier.payments'))->assertForbidden();
    expect($order->refresh()->status)->toBe(OrderStatus::Placed)->and(Payment::count())->toBe(0);
});

test('a cash payment issues a Payment Receipt with the change; the buyer is told, the Specialist only that it is paid', function () {
    Notification::fake();
    $order = lanyardOrder($this->juan, 2);
    $this->actingAs($this->cashier);

    $this->get(route('cashier.record', ['code' => $order->slip_code]))->assertInertia(fn (Assert $page) => $page
        ->component('cashier/record')
        ->where('result.can_mark_paid', true)
        ->where('result.to_collect_centavos', 16000)
        ->where('result.receipt', null));

    $response = $this->post(route('cashier.orders.paid', $order), ['method' => 'cash', 'amount_received' => '200']);
    $payment = Payment::sole();
    $response->assertRedirect(route('cashier.receipts.show', $payment))
        ->assertInertiaFlash('toast.message', "Order {$order->number}: payment of ₱160.00 from Juan Dela Cruz has been recorded. The items are reserved for pickup at the PROWARE office.");

    expect($payment)
        ->receipt_number->toBe('RCT-2026-'.str_pad((string) $payment->id, 6, '0', STR_PAD_LEFT))
        ->method->toBe(PaymentMethod::Cash)
        ->amount_centavos->toBe(16000)
        ->amount_received_centavos->toBe(20000)
        ->change_centavos->toBe(4000)
        ->received_by->toBe($this->cashier->id)
        ->and($payment->snapshot['lines'])->toBe([['quantity' => 2, 'item' => 'STI Lanyard', 'unit_price_centavos' => 8000, 'amount_centavos' => 16000]])
        ->and($order->refresh())->status->toBe(OrderStatus::Paid)
        ->and($this->lanyard->refresh())->held_pieces->toBe(2);

    $this->get(route('cashier.receipts.show', $payment))->assertInertia(fn (Assert $page) => $page
        ->component('cashier/receipt')
        ->where('canPrint', true)
        ->where('receipt.row.receipt_number', $payment->receipt_number)
        ->where('receipt.row.buyer_name', 'Juan Dela Cruz')
        ->where('receipt.row.buyer_id', '02000123456')
        ->where('receipt.row.cashier', 'Cashier 1')
        ->where('receipt.for_label', "Order {$order->number}")
        ->where('receipt.note', 'This is not an official receipt or sales invoice. Keep it as proof of your payment to PROWARE.'));

    Notification::assertSentTo($this->juan, OrderPaid::class, fn (OrderPaid $notice): bool => $notice->toPush($this->juan)['body']
        === "₱160.00 has been received (Payment Receipt {$payment->receipt_number}). Present your issuance slip at the PROWARE office to claim your items.");
    Notification::assertSentTo($this->specialist, PaymentRecorded::class, function (PaymentRecorded $notice) use ($order): bool {
        expect($notice->toPush($this->specialist))->title->toBe("Paid: {$order->number} · Juan Dela Cruz")->body->toBe('₱160.00 paid. Ready for release.')
            ->and($notice->toArray($this->specialist))->not->toHaveKeys(['cashier', 'method', 'receipt_number']);

        return true;
    });
});

test('printing a receipt counts each print, so every copy after the first says REPRINT', function () {
    $order = lanyardOrder($this->juan, 1);
    $this->actingAs($this->cashier)->post(route('cashier.orders.paid', $order), paidInCash('80'));
    $payment = Payment::sole();

    $this->get(route('cashier.receipts.print', $payment))->assertInertia(fn (Assert $page) => $page->component('print/payment-receipt')->where('receipt.prints', 1));
    $this->get(route('cashier.receipts.print', $payment))->assertInertia(fn (Assert $page) => $page->where('receipt.prints', 2));

    // The buyer sees and prints their own copy (not counted); another buyer cannot.
    $this->actingAs($this->juan)->get(route('my-receipts.show', $payment))->assertInertia(fn (Assert $page) => $page->component('storefront/payment-receipt'));
    $this->get(route('my-receipts.print', $payment))->assertInertia(fn (Assert $page) => $page->where('buyerCopy', true));
    $this->get(route('my-orders.slip', $order))->assertInertia(fn (Assert $page) => $page->where('receipt.receipt_number', $payment->receipt_number));
    $this->actingAs(User::factory()->student()->create())->get(route('my-receipts.show', $payment))->assertNotFound();
    expect($payment->refresh()->prints)->toBe(2);
});

test('a GCash payment needs its 13-digit reference, used on one payment only', function () {
    $order = lanyardOrder($this->juan, 1);
    $other = lanyardOrder(User::factory()->student()->create(), 1);
    $this->actingAs($this->cashier);

    $this->post(route('cashier.orders.paid', $order), ['method' => 'gcash'])
        ->assertSessionHasErrors(['gcash_reference' => 'Enter the 13-digit GCash reference number.']);
    $this->post(route('cashier.orders.paid', $order), ['method' => 'gcash', 'gcash_reference' => '12345'])
        ->assertSessionHasErrors(['gcash_reference' => 'The GCash reference number must be exactly 13 digits.']);
    $this->post(route('cashier.orders.paid', $order), ['method' => 'gcash', 'gcash_reference' => '1234 567 89012A'])
        ->assertSessionHasErrors(['gcash_reference' => 'The GCash reference number must be exactly 13 digits.']);

    // Typed with spaces: read as its digits.
    $this->post(route('cashier.orders.paid', $order), ['method' => 'gcash', 'gcash_reference' => '1234 567 890123'])->assertSessionHasNoErrors();
    $payment = Payment::sole();
    expect($payment)->method->toBe(PaymentMethod::GCash)->gcash_reference->toBe('1234567890123')->amount_received_centavos->toBeNull()->change_centavos->toBeNull();

    $this->post(route('cashier.orders.paid', $other), ['method' => 'gcash', 'gcash_reference' => '1234567890123'])
        ->assertSessionHasErrors(['gcash_reference' => "GCash reference 1234567890123 was already recorded on receipt {$payment->receipt_number}."]);
    expect($other->refresh()->status)->toBe(OrderStatus::Placed)->and(Payment::count())->toBe(1);
});

test('the payment method and the cash received are required and checked; nothing is saved when refused', function () {
    $order = lanyardOrder($this->juan, 2);
    $this->actingAs($this->cashier);

    $this->post(route('cashier.orders.paid', $order), [])->assertSessionHasErrors(['method' => 'Select the payment method.']);
    $this->post(route('cashier.orders.paid', $order), ['method' => 'card'])->assertSessionHasErrors(['method' => 'Select Cash or GCash as the payment method.']);
    $this->post(route('cashier.orders.paid', $order), ['method' => 'cash'])->assertSessionHasErrors(['amount_received' => 'Enter the amount received.']);
    $this->post(route('cashier.orders.paid', $order), paidInCash('abc'))->assertSessionHasErrors(['amount_received' => 'Enter the amount received as a number, e.g. 500 or 500.50.']);
    // One reason at a time: letters are not also told about decimal places.
    $this->postJson(route('api.v1.cashier.orders.paid', $order), paidInCash('abc'))
        ->assertJsonPath('errors.amount_received', ['Enter the amount received as a number, e.g. 500 or 500.50.']);
    $this->post(route('cashier.orders.paid', $order), paidInCash('160.555'))->assertSessionHasErrors(['amount_received' => 'Enter the amount received with up to 2 decimal places, e.g. 500.50.']);
    $this->post(route('cashier.orders.paid', $order), paidInCash('0'))->assertSessionHasErrors(['amount_received' => 'The amount received must be more than ₱0.00.']);
    $this->post(route('cashier.orders.paid', $order), paidInCash('100000.01'))->assertSessionHasErrors(['amount_received' => 'The amount received cannot be more than ₱100,000.00.']);
    $this->post(route('cashier.orders.paid', $order), paidInCash('159.99'))
        ->assertSessionHasErrors(['amount_received' => 'The amount received (₱159.99) is less than the amount due (₱160.00).']);

    expect($order->refresh()->status)->toBe(OrderStatus::Placed)
        ->and(Payment::count())->toBe(0)
        ->and($this->lanyard->refresh()->held_pieces)->toBe(0);

    // Exact cash, written with a peso sign and a comma: no change.
    $this->post(route('cashier.orders.paid', $order), paidInCash('₱160.00'))->assertSessionHasNoErrors();
    expect(Payment::sole()->change_centavos)->toBe(0);
});

test('when fewer are left than ordered, the cashier collects only for what is left', function () {
    $bea = User::factory()->student()->create(['name' => 'Bea Villareal']);
    $juansOrder = lanyardOrder($this->juan, 2);
    payAtCashier(lanyardOrder($bea, 2), $this->cashier);

    $this->actingAs($this->cashier)->get(route('cashier.record', ['code' => $juansOrder->number]))->assertInertia(fn (Assert $page) => $page
        ->where('result.to_collect_centavos', 8000)
        ->where('result.short', ['1 pc of STI Lanyard']));
    $this->post(route('cashier.orders.paid', $juansOrder), paidInCash('100'));

    expect(Payment::query()->where('order_id', $juansOrder->id)->sole())
        ->amount_centavos->toBe(8000)->change_centavos->toBe(2000)
        ->snapshot->lines->toBe([['quantity' => 1, 'item' => 'STI Lanyard', 'unit_price_centavos' => 8000, 'amount_centavos' => 8000]]);
});

test('a paid order can no longer be cancelled by the buyer, and the Specialist releases it without seeing the cashier record', function () {
    $order = lanyardOrder($this->juan, 2);
    payAtCashier($order, $this->cashier);

    $this->actingAs($this->juan)->post(route('my-orders.cancel', $order), ['reason' => 'ordered_by_mistake'])
        ->assertInertiaFlash('toast.message', "Order {$order->number} has already been paid, so it can no longer be cancelled. Claim your items at the PROWARE office.");

    $this->actingAs($this->specialist)->get(route('orders.index'))->assertInertia(fn (Assert $page) => $page
        ->where('filters.show', 'paid')
        ->where('orders.data.0.number', $order->number)
        ->where('orders.data.0.status_label', 'Paid · Ready for pickup')
        ->missing('orders.data.0.paid_to'));
    $this->get(route('orders.slip', ['code' => $order->number]))->assertInertia(fn (Assert $page) => $page
        ->missing('result.order.paid_to')
        ->missing('result.receipt'));

    $this->post(route('orders.release', $order))->assertInertiaFlash('toast.type', 'success');
    expect($order->refresh()->status)->toBe(OrderStatus::PickedUp)
        ->and($this->lanyard->refresh())->stock_on_hand->toBe(1)->held_pieces->toBe(0);
});

test('a cancelled order or a made-up code cannot be paid', function () {
    $order = lanyardOrder($this->juan, 1);
    $this->actingAs($this->juan)->post(route('my-orders.cancel', $order), ['reason' => 'ordered_by_mistake']);

    $this->actingAs($this->cashier)->post(route('cashier.orders.paid', $order), paidInCash())
        ->assertInertiaFlash('toast.message', "Order {$order->number} has been cancelled, so the payment cannot be accepted.");
    $this->get(route('cashier.record', ['code' => 'NOT-A-SLIP']))->assertInertia(fn (Assert $page) => $page->where('result', null));
    $this->from(route('cashier.record'))->get(route('cashier.record', ['code' => str_repeat('X', 121)]))
        ->assertSessionHasErrors(['code' => 'The slip number is too long. Check the number or scan the QR code again.']);

    Sanctum::actingAs($this->cashier);
    $this->getJson(route('api.v1.cashier.slip', ['code' => 'NOT-A-SLIP']))->assertNotFound()
        ->assertJsonPath('message', 'No PROWARE slip matches this code. Check the number or scan the QR code again.');
    $this->getJson(route('api.v1.cashier.slip'))->assertUnprocessable()
        ->assertJsonValidationErrors(['code' => 'Scan the slip or enter its number.']);
    expect(Payment::count())->toBe(0);
});

test('the cashier pays on the phone too, and gets the receipt back', function () {
    $order = lanyardOrder($this->juan, 1);
    Sanctum::actingAs($this->cashier);

    $this->postJson(route('api.v1.cashier.orders.paid', $order), ['method' => 'cash'])->assertUnprocessable()
        ->assertJsonValidationErrors(['amount_received' => 'Enter the amount received.']);
    $this->postJson(route('api.v1.cashier.orders.paid', $order), ['method' => 'cash', 'amount_received' => '50'])->assertUnprocessable()
        ->assertJsonValidationErrors(['amount_received' => 'The amount received (₱50.00) is less than the amount due (₱80.00).']);
    $this->postJson(route('api.v1.cashier.orders.paid', $order), ['method' => 'cash', 'amount_received' => '100'])->assertOk()
        ->assertJsonPath('message', "Order {$order->number}: payment of ₱80.00 from Juan Dela Cruz has been recorded. The items are reserved for pickup at the PROWARE office.")
        ->assertJsonPath('receipt.row.change_centavos', 2000)
        ->assertJsonPath('result.can_mark_paid', false)
        ->assertJsonPath('result.receipt.receipt_number', Payment::sole()->receipt_number);
    $this->postJson(route('api.v1.cashier.orders.paid', $order), paidInCash())->assertUnprocessable()
        ->assertJsonValidationErrors(['order' => "Order {$order->number} has already been paid."]);
    $this->getJson(route('api.v1.cashier.paid-today'))->assertOk()->assertJsonPath('total_centavos', 8000)->assertJsonPath('rows.0.method_label', 'Cash');
    $this->getJson(route('api.v1.cashier.dashboard'))->assertOk()->assertJsonPath('today.cash_centavos', 8000);
    $this->getJson(route('api.v1.cashier.receipts.show', Payment::sole()))->assertOk()->assertJsonPath('row.amount_received_centavos', 10000);

    // The buyer reads their receipt on the phone; another buyer cannot.
    Sanctum::actingAs($this->juan);
    $this->getJson(route('api.v1.orders.show', $order))->assertJsonPath('receipt.receipt_number', Payment::sole()->receipt_number);
    $this->getJson(route('api.v1.my-receipts.show', Payment::sole()))->assertOk()->assertJsonPath('row.buyer_name', 'Juan Dela Cruz');
    Sanctum::actingAs(User::factory()->student()->create());
    $this->getJson(route('api.v1.my-receipts.show', Payment::sole()))->assertNotFound();
});

test('an order of an older held preorder, paid at the cashier, is in today\'s payments', function () {
    $order = lanyardOrder($this->juan, 1);
    // Before 14 Nov an arrived preorder was held 24 hours and then ordered like any order.
    Preorder::factory()->forVariant($this->lanyard)->create([
        'user_id' => $this->juan->id, 'status' => PreorderStatus::Ordered, 'order_id' => $order->id, 'held_until' => now()->subDays(7),
    ]);
    payAtCashier($order, $this->cashier);

    $this->actingAs($this->cashier)->get(route('cashier.record'))->assertInertia(fn (Assert $page) => $page
        ->where('paidToday.total_centavos', 8000)
        ->where('paidToday.rows.0.number', $order->number));
});

test('the cashier undoes a payment recorded by mistake: the receipt becomes VOID and the order waits for payment again', function () {
    Notification::fake();
    $bea = User::factory()->student()->create(['name' => 'Bea Villareal']);
    $order = lanyardOrder($this->juan, 2);
    // Bea paid first for 2 of the 3, so Juan was charged for the 1 left.
    payAtCashier(lanyardOrder($bea, 2), $this->cashier);
    $this->actingAs($this->cashier)->post(route('cashier.orders.paid', $order), paidInCash('80'));
    $payment = Payment::query()->where('order_id', $order->id)->sole();
    expect($this->lanyard->refresh()->held_pieces)->toBe(3);

    $this->get(route('cashier.record', ['code' => $order->number]))->assertInertia(fn (Assert $page) => $page->where('result.can_undo', true));
    $this->post(route('cashier.orders.undo-payment', $order), ['reason' => 'Scanned the wrong slip'])
        ->assertInertiaFlash('toast.message', "The payment for order {$order->number} (₱80.00 from Juan Dela Cruz) has been undone. Payment Receipt {$payment->receipt_number} has been voided, and the order is waiting for payment again.");

    expect($order->refresh())->status->toBe(OrderStatus::Placed)->total_centavos->toBe(16000)->paid_at->toBeNull()->paid_to->toBeNull()
        ->and($order->items->sole())->quantity_short->toBe(0)->line_total_centavos->toBe(16000)
        ->and($this->lanyard->refresh())->held_pieces->toBe(2)
        ->and($payment->refresh())->isVoid()->toBeTrue()->voided_by->toBe($this->cashier->id)->void_reason->toBe('Scanned the wrong slip.')
        // The receipt keeps what was paid for.
        ->and($payment->snapshot['lines'][0]['quantity'])->toBe(1);

    Notification::assertSentTo($this->juan, PaymentUndone::class, fn (PaymentUndone $notice): bool => $notice->toPush($this->juan)['body']
        === "The cashier undid your ₱80.00 payment (Payment Receipt {$payment->receipt_number} is void): Scanned the wrong slip. Pay at the cashier again to claim your items.");
    Notification::assertSentTo($this->specialist, PaymentUndoneForStaff::class, function (PaymentUndoneForStaff $notice) use ($order): bool {
        expect($notice->toPush($this->specialist))->title->toBe("Awaiting payment again: {$order->number} · Juan Dela Cruz")
            ->body->toBe('Its payment was undone at the cashier. Release it only once it is paid.')
            ->and($notice->toArray($this->specialist))->not->toHaveKeys(['reason', 'undone_by', 'receipt_number']);

        return true;
    });

    // Today's list keeps it as VOID, out of the total; the Specialist can no longer release it.
    $this->get(route('cashier.record'))->assertInertia(fn (Assert $page) => $page
        ->where('paidToday.total_centavos', 16000)
        ->where('paidToday.rows', fn ($rows): bool => collect($rows)->where('void', true)->pluck('number')->all() === [$order->number]));
    $this->actingAs($this->specialist)->post(route('orders.release', $order))
        ->assertInertiaFlash('toast.message', "Order {$order->number} has not been paid. The buyer must pay at the cashier before the items can be released.");

    // Paid again later: a new receipt, and the old one stays VOID.
    $this->actingAs($this->cashier)->post(route('cashier.orders.paid', $order->refresh()), paidInCash('80'));
    expect(Payment::query()->where('order_id', $order->id)->count())->toBe(2)
        ->and(Payment::query()->where('order_id', $order->id)->valid()->sole()->id)->not->toBe($payment->id);
});

test('a payment can be undone only by the cashier, with a reason, on the same day and before release', function () {
    $order = lanyardOrder($this->juan, 1);
    payAtCashier($order, $this->cashier);

    $this->actingAs($this->cashier)->post(route('cashier.orders.undo-payment', $order), ['reason' => ''])
        ->assertSessionHasErrors(['reason' => 'Enter the reason for undoing the payment.']);
    $this->post(route('cashier.orders.undo-payment', $order), ['reason' => 'no'])
        ->assertSessionHasErrors(['reason' => 'The reason must be at least 5 characters.']);

    $this->actingAs($this->specialist)->post(route('cashier.orders.undo-payment', $order), ['reason' => 'Wrong slip.'])->assertForbidden();
    $this->actingAs($this->juan)->post(route('cashier.orders.undo-payment', $order), ['reason' => 'Wrong slip.'])->assertForbidden();

    $this->travel(1)->days();
    $this->actingAs($this->cashier)->get(route('cashier.record', ['code' => $order->number]))->assertInertia(fn (Assert $page) => $page->where('result.can_undo', false));
    $this->post(route('cashier.orders.undo-payment', $order), ['reason' => 'Wrong slip.'])
        ->assertInertiaFlash('toast.message', "The payment for order {$order->number} was recorded on Nov 20, 2026. A payment can only be undone on the day it was recorded.");

    $this->travel(-1)->days();
    $this->actingAs($this->specialist)->post(route('orders.release', $order));
    $this->actingAs($this->cashier)->post(route('cashier.orders.undo-payment', $order), ['reason' => 'Wrong slip.'])
        ->assertInertiaFlash('toast.message', "Order {$order->number} has already been released, so its payment can no longer be undone.");

    $unpaid = lanyardOrder($this->juan, 1);
    $this->actingAs($this->cashier)->post(route('cashier.orders.undo-payment', $unpaid), ['reason' => 'Wrong slip.'])
        ->assertInertiaFlash('toast.message', "Order {$unpaid->number} has no recorded payment to undo.");

    expect(Payment::query()->whereNotNull('voided_at')->count())->toBe(0);
});

test('Awaiting Payment lists who still has to pay, the oldest first, and finds them by number, name or ID', function () {
    $first = lanyardOrder($this->juan, 1);
    $this->travel(5)->minutes();
    lanyardOrder(User::factory()->student()->create(['name' => 'Bea Villareal', 'student_id' => '02000999888']), 1);
    payAtCashier(lanyardOrder(User::factory()->student()->create(), 1), $this->cashier);

    $this->actingAs($this->cashier)->get(route('cashier.awaiting.index'))->assertInertia(fn (Assert $page) => $page
        ->component('cashier/awaiting')
        ->where('orders.total', 2)
        ->where('orders.data.0.number', $first->number)
        ->where('orders.data.0.amount_centavos', 8000));
    $this->get(route('cashier.awaiting.index', ['search' => 'bea']))->assertInertia(fn (Assert $page) => $page->where('orders.total', 1)->where('orders.data.0.buyer_name', 'Bea Villareal'));
    $this->get(route('cashier.awaiting.index', ['search' => '999888']))->assertInertia(fn (Assert $page) => $page->where('orders.total', 1));
    $this->get(route('cashier.awaiting.index', ['search' => strtolower((string) $first->number)]))->assertInertia(fn (Assert $page) => $page->where('orders.data.0.number', $first->number));
    $this->get(route('cashier.awaiting.index', ['search' => str_repeat('x', 101)]))->assertInertiaFlash('toast.message', 'The search may not be longer than 100 characters. The list is shown without its filters.');
});

test('Payment History filters by period, method, Order or Preorder, Paid or Void and a search, with the totals of what matches', function () {
    $cash = lanyardOrder($this->juan, 1);
    $gcash = lanyardOrder(User::factory()->student()->create(['name' => 'Bea Villareal']), 1);
    $this->actingAs($this->cashier)->post(route('cashier.orders.paid', $cash), paidInCash('100'));
    $this->post(route('cashier.orders.paid', $gcash), ['method' => 'gcash', 'gcash_reference' => '9876543210123']);
    $this->travelTo(CarbonImmutable::parse('2026-11-21 09:00', 'Asia/Manila'));
    $voided = lanyardOrder($this->juan, 1);
    $this->actingAs($this->cashier)->post(route('cashier.orders.paid', $voided), paidInCash('80'));
    $this->post(route('cashier.orders.undo-payment', $voided), ['reason' => 'Recorded by mistake.']);

    // Today by default: the void one only, not counted.
    $this->get(route('cashier.payments.index'))->assertInertia(fn (Assert $page) => $page
        ->component('cashier/payments')
        ->where('filters.period', 'today')
        ->where('payments.total', 1)
        ->where('payments.data.0.void', true)
        ->where('totals.count', 0)
        ->where('totals.void_count', 1)
        ->where('readOnly', false));

    $week = ['period' => 'custom', 'date_from' => '2026-11-20', 'date_to' => '2026-11-21'];
    $this->get(route('cashier.payments.index', $week))->assertInertia(fn (Assert $page) => $page
        ->where('payments.total', 3)
        ->where('totals.total_centavos', 16000)
        ->where('totals.count', 2)
        ->where('totals.cash_count', 1)
        ->where('totals.cash_centavos', 8000)
        ->where('totals.gcash_count', 1)
        ->where('totals.gcash_centavos', 8000));
    $this->get(route('cashier.payments.index', [...$week, 'method' => 'gcash']))->assertInertia(fn (Assert $page) => $page->where('payments.total', 1)->where('payments.data.0.gcash_reference', '9876543210123'));
    $this->get(route('cashier.payments.index', [...$week, 'status' => 'void']))->assertInertia(fn (Assert $page) => $page->where('payments.total', 1));
    $this->get(route('cashier.payments.index', [...$week, 'status' => 'paid', 'search' => 'bea']))->assertInertia(fn (Assert $page) => $page->where('payments.total', 1)->where('payments.data.0.buyer_name', 'Bea Villareal'));
    $this->get(route('cashier.payments.index', [...$week, 'search' => '6543210']))->assertInertia(fn (Assert $page) => $page->where('payments.total', 1));
    $this->get(route('cashier.payments.index', [...$week, 'search' => strtolower((string) $cash->number)]))->assertInertia(fn (Assert $page) => $page->where('payments.total', 1));
    $this->get(route('cashier.payments.index', [...$week, 'type' => 'preorder']))->assertInertia(fn (Assert $page) => $page->where('payments.total', 0));

    // Wrong filters are refused with a reason, never dropped quietly.
    $this->get(route('cashier.payments.index', ['period' => 'custom', 'date_from' => '2026-11-21', 'date_to' => '2026-11-20']))
        ->assertInertiaFlash('toast.message', 'The "To" date cannot be before the "From" date. The list is shown without its filters.');
    $this->get(route('cashier.payments.index', ['period' => 'custom', 'date_from' => '2026-11-22', 'date_to' => '2026-11-22']))
        ->assertInertiaFlash('toast.message', 'The "From" date cannot be after today. The list is shown without its filters.');
    $this->get(route('cashier.payments.index', ['period' => 'custom', 'date_from' => '2025-01-01', 'date_to' => '2026-11-21']))
        ->assertInertiaFlash('toast.message', 'Choose a period of at most one year. The list is shown without its filters.');
    $this->get(route('cashier.payments.index', ['method' => 'card']))
        ->assertInertiaFlash('toast.message', 'Choose Cash or GCash as the payment method. The list is shown without its filters.');
    $this->get(route('cashier.payments.index', ['period' => 'custom']))
        ->assertInertiaFlash('toast.message', 'Choose the "From" date. The list is shown without its filters.');
    // A day that does not exist is not also reported as "To before From".
    $this->getJson(route('api.v1.cashier.payments', ['period' => 'custom', 'date_from' => '2026-02-30', 'date_to' => '2026-03-01']))
        ->assertUnprocessable()
        ->assertJsonPath('errors', ['date_from' => ['Choose a valid "From" date.']]);
});

test('Collections add up the money by day or by month (void payments apart), and both lists download for Excel', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-15 10:00', 'Asia/Manila'));
    payAtCashier(lanyardOrder($this->juan, 1), $this->cashier);
    $this->travelTo(CarbonImmutable::parse('2026-11-20 10:00', 'Asia/Manila'));
    $november = lanyardOrder($this->juan, 1);
    $this->actingAs($this->cashier)->post(route('cashier.orders.paid', $november), ['method' => 'gcash', 'gcash_reference' => '1111222233334'])->assertSessionHasNoErrors();

    $range = ['period' => 'custom', 'date_from' => '2026-10-01', 'date_to' => '2026-11-30'];
    $this->travelTo(CarbonImmutable::parse('2026-11-30 18:00', 'Asia/Manila'));
    $this->actingAs($this->cashier)->get(route('cashier.collections.index', [...$range, 'group' => 'month']))->assertInertia(fn (Assert $page) => $page
        ->component('cashier/collections')
        ->where('rows.0.label', 'November 2026')
        ->where('rows.0.gcash_centavos', 8000)
        ->where('rows.1.label', 'October 2026')
        ->where('rows.1.cash_centavos', 8000)
        ->where('totals.total_centavos', 16000));
    $this->get(route('cashier.collections.index', $range))->assertInertia(fn (Assert $page) => $page->where('filters.group', 'day')->where('rows.0.label', 'Nov 20, 2026 (Fri)'));
    // This month by default.
    $this->get(route('cashier.collections.index'))->assertInertia(fn (Assert $page) => $page->where('filters.period', 'month')->where('totals.count', 1));

    $csv = $this->get(route('cashier.payments.export', $range))->assertOk()->assertHeader('content-type', 'text/csv; charset=UTF-8')->streamedContent();
    expect($csv)->toStartWith("\xEF\xBB\xBF".'"Receipt No.","Date and time",For,"Slip No.",Buyer,ID,Method,Amount')
        ->toContain('GCash,80.00,,,"=""1111222233334"""')
        ->toContain('"Cashier 1",Paid');
    $csv = $this->get(route('cashier.collections.export', [...$range, 'group' => 'month']))->assertOk()->streamedContent();
    expect($csv)->toContain('"Total collected","Voided payments"')
        ->toContain('"October 2026",1,80.00,0.00,80.00,0')->toContain('Total,2,80.00,80.00,160.00,0');
});

test('the daily collection report lists the day\'s receipts and totals by method, the void ones apart, for paper', function () {
    payAtCashier(lanyardOrder($this->juan, 1), $this->cashier);
    $voided = lanyardOrder($this->juan, 1);
    $this->actingAs($this->cashier)->post(route('cashier.orders.paid', $voided), paidInCash('80'));
    $this->post(route('cashier.orders.undo-payment', $voided), ['reason' => 'Recorded by mistake.']);

    $this->get(route('cashier.collections.daily', ['date' => '2026-11-20']))->assertInertia(fn (Assert $page) => $page
        ->component('print/daily-collection-report')
        ->where('date', '2026-11-20')
        ->where('totals.cash_centavos', 8000)
        ->where('totals.void_count', 1)
        ->has('receipts', 1)
        ->has('voided', 1)
        ->where('preparedBy', 'Cashier 1'));
    $this->get(route('cashier.collections.daily', ['date' => '2026-11-21']))->assertSessionHasErrors(['date' => 'The date cannot be after today.']);
    $this->get(route('cashier.collections.daily', ['date' => 'hello']))->assertSessionHasErrors(['date' => 'Choose a valid date.']);
    expect(session('errors')->get('date'))->toBe(['Choose a valid date.']);
});

test('the School Admin views Payment History, Collections and receipts read-only; recording, printing and downloads are the cashier\'s', function () {
    $order = lanyardOrder($this->juan, 1);
    payAtCashier($order, $this->cashier);
    $payment = Payment::sole();

    $this->actingAs($this->schoolAdmin)->get(route('cashier.payments.index'))->assertInertia(fn (Assert $page) => $page->where('readOnly', true)->where('payments.total', 1));
    $this->get(route('cashier.collections.index'))->assertInertia(fn (Assert $page) => $page->where('readOnly', true));
    $this->get(route('cashier.receipts.show', $payment))->assertInertia(fn (Assert $page) => $page->where('canPrint', false));

    $this->get(route('cashier.index'))->assertForbidden();
    $this->get(route('cashier.receipts.print', $payment))->assertForbidden();
    $this->get(route('cashier.payments.export'))->assertForbidden();
    $this->get(route('cashier.collections.daily'))->assertForbidden();
    $this->post(route('cashier.orders.undo-payment', $order), ['reason' => 'Recorded by mistake.'])->assertForbidden();

    // The Specialist cannot open any of it.
    $this->actingAs($this->specialist)->get(route('cashier.receipts.show', $payment))->assertForbidden();
    expect($payment->refresh()->prints)->toBe(0);
});
