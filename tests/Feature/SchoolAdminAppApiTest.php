<?php

use App\Models\Delivery;
use App\Models\User;
use App\Notifications\PurchaseOrderReminder;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-11-23 10:00', 'Asia/Manila'));
    $this->admin = User::factory()->schoolAdmin()->create(['name' => 'Liza Garcia', 'password' => 'Demo@2026!']);
    $this->specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
});

test('the School Admin signs in on the phone and sees the eStore orders, sales and locked accounts', function () {
    $token = $this->postJson(route('api.v1.auth.login'), ['email' => $this->admin->email, 'password' => 'Demo@2026!', 'device_name' => 'Phone'])
        ->assertOk()
        ->assertJsonPath('user.role', 'school_admin')
        ->json('token');
    $this->withToken($token)->getJson(route('api.v1.auth.me'))->assertOk()->assertJsonPath('user.name', 'Liza Garcia');

    orderWith(['UTMP02-03' => 10], ['order_number' => '30650', 'date_ordered' => '2026-10-01']);
    orderWith(['UTMS02-03' => 5], ['order_number' => '30722', 'date_ordered' => '2026-11-20']);

    // It opens on Partially Received, like the website; Awaiting Delivery holds these two.
    $this->withToken($token)->getJson(route('api.v1.admin.overview'))->assertOk()->assertJsonPath('deliveries.tab', 'ongoing');
    $this->withToken($token)->getJson(route('api.v1.admin.overview', ['tab' => 'coming']))->assertOk()
        ->assertJsonPath('deliveries.tab', 'coming')
        ->assertJsonPath('deliveries.counts.coming', 2)
        ->assertJsonPath('deliveries.counts.coming_late', 1)
        ->assertJsonPath('deliveries.orders.data.0.order_number', '30650')
        ->assertJsonPath('deliveries.orders.data.0.is_late', true)
        ->assertJsonPath('deliveries.orders.data.0.can_remind', true)
        ->assertJsonPath('sales.period', 'month')
        ->assertJsonPath('locked_accounts', []);

    // A search by Order #, and a wrong tab is refused with the reason.
    $this->withToken($token)->getJson(route('api.v1.admin.overview', ['tab' => 'coming', 'search' => '722']))->assertJsonPath('deliveries.orders.total', 1);
    $this->withToken($token)->getJson(route('api.v1.admin.overview', ['tab' => 'xyz']))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['tab' => 'Choose Awaiting Delivery, Partially Received or Completed.']);
});

test('the School Admin opens an order and reminds the Specialist about a late one, once a week', function () {
    Notification::fake();
    $late = orderWith(['UTMP02-03' => 10], ['order_number' => '30650', 'date_ordered' => '2026-10-01']);
    $recent = orderWith(['UTMS02-03' => 5], ['order_number' => '30722', 'date_ordered' => '2026-11-20']);
    Sanctum::actingAs($this->admin);

    $this->getJson(route('api.v1.admin.purchase-orders.show', $late))->assertOk()
        ->assertJsonPath('order_number', '30650')
        ->assertJsonPath('items.0.item_code', 'UTMP02-03')
        ->assertJsonPath('is_late', true);

    $this->postJson(route('api.v1.admin.purchase-orders.remind-specialist', $recent))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['reminder' => 'Order #30722 is not late, so there is nothing to remind the Specialist about.']);

    // Sent to every Specialist (the test orders were uploaded by others too).
    $reminded = $this->postJson(route('api.v1.admin.purchase-orders.remind-specialist', $late))->assertOk();
    expect($reminded->json('message'))->toStartWith('The reminder has been sent to ')->toContain('Carlo Mendoza');
    $reminded
        ->assertJsonPath('reminded_by', 'Liza Garcia')
        ->assertJsonPath('can_remind', false)
        ->assertJsonPath('remind_again_on', '2026-11-30');
    Notification::assertSentTo($this->specialist, PurchaseOrderReminder::class);

    $this->postJson(route('api.v1.admin.purchase-orders.remind-specialist', $late))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['reminder' => 'The Specialist was already reminded about Order #30650. The next reminder can be sent on Nov 30, 2026.']);
});

test('the School Admin views Stock In, Payment History and Collections, but not the cashier\'s or the Specialist\'s orders', function () {
    Sanctum::actingAs($this->admin);

    $this->getJson(route('api.v1.admin.deliveries.index'))->assertOk();
    $this->getJson(route('api.v1.cashier.payments'))->assertOk()->assertJsonPath('filters.period', 'today');
    $this->getJson(route('api.v1.cashier.collections'))->assertOk()->assertJsonPath('filters.period', 'month');

    // Payments and orders stay the cashier's and the Specialist's (she records deliveries since 24 Nov 2026).
    $this->getJson(route('api.v1.cashier.dashboard'))->assertForbidden();
    $this->getJson(route('api.v1.cashier.awaiting'))->assertForbidden();
    $this->getJson(route('api.v1.specialist.orders.index'))->assertForbidden();
});

test('only the School Admin opens the School Admin screens', function () {
    $order = orderWith(['UTMP02-03' => 10], ['order_number' => '30650', 'date_ordered' => '2026-10-01']);

    foreach ([User::factory()->student()->create(), $this->specialist, User::factory()->cashier()->create()] as $other) {
        Sanctum::actingAs($other);
        $this->getJson(route('api.v1.admin.overview'))->assertForbidden();
        $this->getJson(route('api.v1.admin.purchase-orders.show', $order))->assertForbidden();
        $this->postJson(route('api.v1.admin.purchase-orders.remind-specialist', $order))->assertForbidden();
    }
});

test('the cashier can now sign out on the phone, which ends that phone sign-in', function () {
    $cashier = User::factory()->cashier()->create(['password' => 'Demo@2026!']);
    $token = $this->postJson(route('api.v1.auth.login'), ['email' => $cashier->email, 'password' => 'Demo@2026!', 'device_name' => 'Phone'])->json('token');
    $this->withToken($token)->getJson(route('api.v1.auth.me'))->assertOk();
    $this->withToken($token)->postJson(route('api.v1.auth.logout'))->assertSuccessful();
    expect($cashier->tokens()->count())->toBe(0);
});

test('the website keeps one route to an eStore order, so its link helper still works', function () {
    // The phone has its own action: two routes on one action would turn
    // the website's PurchaseOrderController.show helper into a list.
    $routes = collect(Route::getRoutes()->getRoutes())
        ->filter(fn ($route): bool => $route->getActionName() === 'App\Http\Controllers\PurchaseOrderController@show');

    expect($routes)->toHaveCount(1)
        ->and($routes->first()->uri())->toBe('purchase-orders/{purchaseOrder}');
});

test('the School Admin uses the stock lookup and records a delivery on the phone, but not the Specialist\'s orders', function () {
    $admin = User::factory()->schoolAdmin()->create();
    $order = orderWith(['PRUM01-01' => 5]);
    Sanctum::actingAs($admin);

    $this->getJson(route('api.v1.specialist.stock.index', ['low' => 1]))->assertOk()->assertJsonStructure(['data', 'total']);
    $this->getJson(route('api.v1.specialist.deliveries.waiting'))->assertOk();
    $this->postJson(route('api.v1.specialist.deliveries.store'), [...papers(),
        'items' => [['purchase_order_item_id' => itemOf($order, 'PRUM01-01'), 'quantity_received' => 5]],
    ])->assertCreated();

    expect($order->refresh()->quantity_received_total)->toBe(5)
        ->and(Delivery::sole()->recorded_by)->toBe($admin->id);

    $this->getJson(route('api.v1.specialist.tasks'))->assertForbidden();
    $this->getJson(route('api.v1.specialist.orders.index'))->assertForbidden();
});
