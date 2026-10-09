<?php

use App\Enums\OrderStatus;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ProductVariant;
use App\Models\Setting;
use App\Models\User;
use App\Services\Shop\OrderRules;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-09 10:00', 'Asia/Manila'));
    $this->student = User::factory()->student()->create(['name' => 'Juan Dela Cruz']);
    $this->specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
});

/**
 * Juan's order of 2 STI Hoodies (M) at ₱450, for BSIT 1-A.
 */
function juansHoodieOrder(OrderStatus $status = OrderStatus::Placed): Order
{
    $order = Order::factory()->for(test()->student, 'student')->create([
        'status' => $status,
        'student_section' => 'BSIT 1-A',
        'total_centavos' => 90000,
    ]);
    $order->forceFill(['number' => 'PW-0042'])->save();
    OrderItem::factory()->for($order)->create([
        'product_name' => 'STI Hoodie',
        'variant_label' => 'M',
        'quantity' => 2,
        'unit_price_centavos' => 45000,
        'line_total_centavos' => 90000,
    ]);

    return $order;
}

test('the student sees their order\'s issuance slip with its QR, as on the paper form', function () {
    $order = juansHoodieOrder();

    $this->actingAs($this->student)->get(route('my-orders.slip', $order))->assertInertia(fn (Assert $page) => $page
        ->component('storefront/issuance-slip')
        ->where('slip.school', 'STI COLLEGE-ORMOC, INC.')
        ->where('slip.address_lines', ['Ormoc Centrum Bldg., Barangay South 6541', 'Ormoc City, Leyte Philippines'])
        ->where('slip.number', 'PW-0042')
        ->where('slip.date', '2026-10-09')
        ->where('slip.student_name', 'Juan Dela Cruz')
        ->where('slip.section', 'BSIT 1-A')
        ->where('slip.items', [['quantity' => 2, 'item' => 'STI Hoodie (M)', 'unit_price_centavos' => 45000, 'amount_centavos' => 90000]])
        ->where('slip.total_centavos', 90000)
        ->where('slip.issued_by', null)
        ->where('slip.qr_svg', fn (string $svg) => str_starts_with($svg, '<svg') && $svg !== '')
    );
    $this->get(route('my-orders.slip.print', $order))->assertInertia(fn (Assert $page) => $page
        ->component('print/issuance-slip')
        ->where('slip.number', 'PW-0042')
    );
});

test('each slip\'s QR is different, because each order has its own random code', function () {
    $first = juansHoodieOrder();
    $second = Order::factory()->for($this->student, 'student')->create();

    $svgOf = fn (Order $order): string => $this->actingAs($this->student)->get(route('my-orders.slip', $order))->inertiaProps('slip.qr_svg');

    expect($svgOf($first))->not->toBe($svgOf($second))
        ->and($first->slip_code)->not->toBe($second->slip_code);
});

test('a student cannot see another student\'s slip', function () {
    $order = juansHoodieOrder();

    $this->actingAs(User::factory()->student()->create())->get(route('my-orders.slip', $order))->assertNotFound();
    $this->get(route('my-orders.slip.print', $order))->assertNotFound();
});

test('a released slip shows when it was released and who issued it', function () {
    $order = juansHoodieOrder(OrderStatus::Ready);
    $order->items()->update(['product_variant_id' => ProductVariant::factory()->create(['stock_on_hand' => 5, 'held_pieces' => 2])->id]);
    $this->actingAs($this->specialist)->post(route('orders.release', $order), ['paid' => true]);

    $this->actingAs($this->student)->get(route('my-orders.slip', $order))->assertInertia(fn (Assert $page) => $page
        ->where('slip.status_label', 'Released')
        ->where('slip.released_on', '2026-10-09')
        ->where('slip.issued_by', 'Carlo Mendoza')
    );
});

test('the Specialist finds the order by scanning its slip or typing its number, ready to release', function () {
    $order = juansHoodieOrder();
    $this->actingAs($this->specialist);

    $this->get(route('orders.slip', ['code' => $order->slip_code]))->assertInertia(fn (Assert $page) => $page
        ->component('orders/slip')
        ->where('result.order.id', $order->id)
        ->where('result.order.student_section', 'BSIT 1-A')
        ->where('result.slip.number', 'PW-0042')
    );
    $this->get(route('orders.slip', ['code' => ' pw-0042 ']))->assertInertia(fn (Assert $page) => $page
        ->where('result.order.id', $order->id)
    );
    $this->get(route('orders.slip', ['code' => 'made-up']))->assertInertia(fn (Assert $page) => $page
        ->where('code', 'made-up')
        ->where('result', null)
    );
    $this->get(route('orders.slip.print', $order))->assertInertia(fn (Assert $page) => $page
        ->component('print/issuance-slip')
        ->where('slip.number', 'PW-0042')
    );
});

test('only the Specialist can look up and print slips', function () {
    $order = juansHoodieOrder();

    $this->actingAs($this->student)->get(route('orders.slip', ['code' => $order->slip_code]))->assertForbidden();
    $this->get(route('orders.slip.print', $order))->assertForbidden();
    $this->actingAs(User::factory()->schoolAdmin()->create())->get(route('orders.slip', ['code' => $order->slip_code]))->assertForbidden();
});

test('the Specialist sets how many days new orders hold their items on the Maintenance page', function () {
    $this->actingAs($this->specialist)->get(route('maintenance.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('maintenance/index')
            ->where('holdDays.value', 2)
            ->where('holdDays.changed_by', null));

    $this->patch(route('maintenance.hold-days'), ['hold_days' => 4])
        ->assertSessionHasErrors(['hold_days' => 'Choose 1, 2 or 3 days.']);

    $this->patch(route('maintenance.hold-days'), ['hold_days' => 3])
        ->assertInertiaFlash('toast.message', 'New orders now hold their items for 3 days. Orders already placed keep their pick-up date.');

    expect(Setting::integer(Setting::ORDER_HOLD_DAYS, 0))->toBe(3)
        ->and(OrderRules::holdUntil()->toDateString())->toBe('2026-10-12');

    $this->get(route('maintenance.index'))->assertInertia(fn (Assert $page) => $page
        ->where('holdDays.value', 3)
        ->where('holdDays.changed_by', $this->specialist->name)
        ->where('holdDays.changed_at', now()->toIso8601String()));
});

test('only the Specialist can open and change Maintenance', function () {
    foreach ([$this->student, User::factory()->schoolAdmin()->create()] as $user) {
        $this->actingAs($user)->get(route('maintenance.index'))->assertForbidden();
        $this->patch(route('maintenance.hold-days'), ['hold_days' => 1])->assertForbidden();
    }

    expect(Setting::integer(Setting::ORDER_HOLD_DAYS, 2))->toBe(2);
});

test('the Specialist sees students paused for expired orders and can let them order again', function () {
    foreach (['2026-10-01', '2026-10-05', '2026-10-08'] as $day) {
        Order::factory()->for($this->student, 'student')->create(['status' => OrderStatus::Cancelled, 'expired_at' => "{$day} 00:30"]);
    }
    $this->actingAs($this->specialist);

    $this->get(route('orders.index'))->assertInertia(fn (Assert $page) => $page
        ->where('pausedStudents', [['id' => $this->student->id, 'name' => 'Juan Dela Cruz', 'email' => $this->student->email, 'paused_until' => '2026-10-15']])
    );

    $this->post(route('students.lift-pause', $this->student))
        ->assertInertiaFlash('toast.message', 'Juan Dela Cruz can order again.');

    $this->get(route('orders.index'))->assertInertia(fn (Assert $page) => $page->where('pausedStudents', []));
    $this->post(route('students.lift-pause', $this->specialist))->assertNotFound();
});

test('the cart shows the saved section, and why an order would be refused before placing it', function () {
    $this->student->forceFill(['section' => 'BSIT 1-A'])->save();
    foreach (['2026-09-20', '2026-10-01', '2026-10-08'] as $day) {
        Order::factory()->for($this->student, 'student')->create(['status' => OrderStatus::Cancelled, 'expired_at' => "{$day} 00:30"]);
    }
    CartItem::factory()->for($this->student, 'student')->create();

    $this->actingAs($this->student)->get(route('cart.index'))->assertInertia(fn (Assert $page) => $page
        ->where('section', 'BSIT 1-A')
        ->where('order_refusal', 'Ordering is paused until Oct 15, 2026, because 3 of your orders expired without being picked up. Ask the PROWARE office if this is a mistake.')
    );
});
