<?php

use App\Enums\OrderStatus;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ProductVariant;
use App\Models\Setting;
use App\Models\User;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-09 10:00', 'Asia/Manila'));
    $this->student = User::factory()->student()->create(['name' => 'Juan Dela Cruz', 'student_id' => '02000123456']);
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
        ->where('slip.student_id', '02000123456')
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
    $order = juansHoodieOrder();
    $order->items()->update(['product_variant_id' => ProductVariant::factory()->create(['stock_on_hand' => 5])->id]);
    $this->actingAs($this->specialist)->post(route('orders.release', $order), ['paid' => true]);

    $this->actingAs($this->student)->get(route('my-orders.slip', $order))->assertInertia(fn (Assert $page) => $page
        ->where('slip.status_label', 'Released')
        ->where('slip.released_on', '2026-10-09')
        ->where('slip.issued_by', 'Carlo Mendoza')
    );
});

test('the Scan issuance slip page opens empty before anything is scanned', function () {
    $this->actingAs($this->specialist)->get(route('orders.slip'))->assertInertia(fn (Assert $page) => $page
        ->component('orders/slip')
        ->where('code', '')
        ->where('result', null)
    );
});

test('the Specialist finds the order by scanning its slip or typing its number, ready to release', function () {
    $order = juansHoodieOrder();
    $this->actingAs($this->specialist);

    $this->get(route('orders.slip', ['code' => $order->slip_code]))->assertInertia(fn (Assert $page) => $page
        ->component('orders/slip')
        ->where('result.order.id', $order->id)
        ->where('result.order.student_section', 'BSIT 1-A')
        ->where('result.order.student_id', '02000123456')
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

test('only the Specialist can open and change Maintenance', function () {
    foreach ([$this->student, User::factory()->schoolAdmin()->create()] as $user) {
        $this->actingAs($user)->get(route('maintenance.index'))->assertForbidden();
        $this->patch(route('maintenance.most-per-item'), ['most_per_item' => 500])->assertForbidden();
    }

    expect(Setting::integer(Setting::MOST_PER_ITEM, 99))->toBe(99);
});

test('the cart shows the saved section', function () {
    $this->student->forceFill(['section' => 'BSIT 1-A'])->save();
    CartItem::factory()->for($this->student, 'student')->create();

    $this->actingAs($this->student)->get(route('cart.index'))->assertInertia(fn (Assert $page) => $page
        ->where('section', 'BSIT 1-A')
        ->missing('order_refusal')
        ->missing('pick_up_by')
    );
});
