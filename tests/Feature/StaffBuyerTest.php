<?php

use App\Enums\ProductStatus;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-27 10:00', 'Asia/Manila'));
    $this->teacher = User::factory()->employee()->create(['name' => 'Ana Lopez', 'password' => 'Demo@2026!']);
    $this->teacher->forceFill(['employee_id' => 'EMP-0421', 'section' => 'Faculty - IT'])->save();
});

/**
 * An Available STI Tumbler at ₱450 a piece with $stock pieces on the shelf.
 */
function staffTumbler(int $stock): ProductVariant
{
    $variant = ProductVariant::factory()
        ->for(Product::factory()->create(['name' => 'STI Tumbler', 'price_centavos' => 45000, 'status' => ProductStatus::Available, 'low_stock_alert_at' => 0]))
        ->create(['stock_on_hand' => $stock]);
    StockMovement::factory()->for($variant, 'variant')->create();

    return $variant;
}

test('an STI teacher buys on the website, and the Specialist sees a Staff order with the Employee ID', function () {
    $variant = staffTumbler(stock: 3);

    $this->actingAs($this->teacher)
        ->post(route('cart.store', $variant->product_id), ['product_variant_id' => $variant->id, 'quantity' => '2'])
        ->assertSessionHasNoErrors();
    $this->post(route('my-orders.store'))->assertSessionHasNoErrors();

    $order = Order::query()->sole();
    expect($order->user_id)->toBe($this->teacher->id)
        ->and($order->student_section)->toBe('Faculty - IT')
        ->and($variant->refresh()->held_pieces)->toBe(2);

    $this->actingAs(User::factory()->specialist()->create())
        ->get(route('orders.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('orders.data.0.student_name', 'Ana Lopez')
            ->where('orders.data.0.is_staff', true)
            ->where('orders.data.0.student_id', 'EMP-0421')
            ->where('orders.data.0.student_section', 'Faculty - IT'));
    $this->get(route('orders.slip.print', $order))
        ->assertInertia(fn (Assert $page) => $page
            ->where('slip.is_staff', true)
            ->where('slip.student_id', 'EMP-0421')
            ->where('slip.section', 'Faculty - IT'));
});

test('a student\'s order is not marked as a Staff order', function () {
    $variant = staffTumbler(stock: 3);
    $student = User::factory()->student()->create(['student_id' => '02000345671']);

    $this->actingAs($student)
        ->post(route('cart.store', $variant->product_id), ['product_variant_id' => $variant->id, 'quantity' => '1']);
    $this->post(route('my-orders.store'))->assertSessionHasNoErrors();

    $this->actingAs(User::factory()->specialist()->create())
        ->get(route('orders.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('orders.data.0.is_staff', false)
            ->where('orders.data.0.student_id', '02000345671'));
});

test('an STI teacher can preorder a sold-out item', function () {
    $variant = staffTumbler(stock: 0);

    $this->actingAs($this->teacher)
        ->post(route('my-preorders.store', $variant->product_id), ['items' => [['product_variant_id' => $variant->id, 'quantity' => '1']]])
        ->assertSessionHasNoErrors();

    expect($this->teacher->preorders()->sole()->product_variant_id)->toBe($variant->id);
});

test('an STI teacher signs in on the phone app and orders there', function () {
    $variant = staffTumbler(stock: 3);

    $token = $this->postJson(route('api.v1.auth.login'), [
        'email' => $this->teacher->email,
        'password' => 'Demo@2026!',
        'device_name' => 'realme RMX3999',
    ])->assertOk()->assertJsonPath('user.role', 'employee')->json('token');

    $this->withToken($token)
        ->postJson(route('api.v1.cart.store', $variant->product_id), ['product_variant_id' => $variant->id, 'quantity' => 1])
        ->assertSuccessful();
    $this->withToken($token)
        ->postJson(route('api.v1.orders.store'))
        ->assertCreated()
        ->assertJsonPath('order.is_staff', true)
        ->assertJsonPath('order.student_id', 'EMP-0421');
});

test('an STI teacher opens My Account and changes their password', function () {
    $this->actingAs($this->teacher)
        ->get(route('profile.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('storefront/account'));
    $this->get(route('security.edit'))->assertRedirect(route('profile.edit'));

    $this->put(route('user-password.update'), [
        'current_password' => 'Demo@2026!',
        'password' => 'Staff@2027!',
        'password_confirmation' => 'Staff@2027!',
    ])->assertSessionHasNoErrors();
});

test('STI staff cannot open the Specialist\'s pages', function () {
    $this->actingAs($this->teacher)->get(route('orders.index'))->assertForbidden();
    $this->get(route('dashboard'))->assertRedirect(route('home'));
});
