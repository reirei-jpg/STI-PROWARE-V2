<?php

use App\Http\Middleware\HandleInertiaRequests;
use App\Models\PurchaseOrder;
use App\Models\User;
use App\Notifications\PurchaseOrderReminder;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->specialist = User::factory()->specialist()->create();
});

test('a list opened past its last page opens the last page instead of saying it is empty', function () {
    PurchaseOrder::factory()->count(25)->create();

    $this->actingAs($this->specialist)
        ->get(route('purchase-orders.index', ['page' => 999]))
        ->assertRedirect(route('purchase-orders.index', ['page' => 2]));

    $this->get(route('purchase-orders.index', ['page' => 2]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('purchaseOrders.data', 5));
});

test('the last page keeps the filters, also when the page itself asks for it', function () {
    PurchaseOrder::factory()->count(3)->create();

    $this->actingAs($this->specialist)
        ->withHeaders(['X-Inertia' => 'true', 'X-Inertia-Version' => (string) app(HandleInertiaRequests::class)->version(request())])
        ->get(route('purchase-orders.index', ['search' => '3', 'page' => 4]))
        ->assertRedirect(route('purchase-orders.index', ['search' => '3', 'page' => 1]));
});

test('an empty list still says it is empty, on any page', function () {
    $this->actingAs($this->specialist)
        ->get(route('purchase-orders.index', ['page' => 3]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('purchaseOrders.data', 0));
});

test('the phone app still gets the empty page it asked for', function () {
    $order = PurchaseOrder::factory()->create();
    $this->specialist->notify(new PurchaseOrderReminder($order, User::factory()->schoolAdmin()->create()));
    Sanctum::actingAs($this->specialist);

    $this->getJson(route('api.v1.notifications.index', ['page' => 9]))
        ->assertOk()
        ->assertJsonCount(0, 'data');
});
