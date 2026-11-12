<?php

use App\Enums\OrderStatus;
use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Preorder;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Setting;
use App\Models\User;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-11-13 10:00', 'Asia/Manila'));
    $this->specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
});

/**
 * A Coming Soon item taking preorders until Nov 30, with $pieces preordered.
 */
function comingSoonHoodie(int $pieces, string $name = 'STI Batch 2027 Hoodie'): Product
{
    $product = Product::factory()->create(['name' => $name, 'status' => ProductStatus::Preorder, 'preorders_close_on' => '2026-11-30']);
    $variant = ProductVariant::factory()->for($product)->create();
    Preorder::factory()->forVariant($variant)->create(['quantity' => $pieces, 'status' => PreorderStatus::Active]);

    return $product;
}

test('the dashboard shows low stock, this month\'s best sellers, and the items ready to order', function () {
    $lanyard = Product::factory()->create(['name' => 'STI Lanyard', 'status' => ProductStatus::Available, 'low_stock_alert_at' => 5]);
    $lanyardVariant = ProductVariant::factory()->for($lanyard)->create(['stock_on_hand' => 2]);
    $umbrella = Product::factory()->create(['name' => 'STI Umbrella', 'status' => ProductStatus::Available, 'low_stock_alert_at' => 5]);
    ProductVariant::factory()->for($umbrella)->create(['stock_on_hand' => 0]);
    Product::factory()->create(['name' => 'STI Ballpen', 'status' => ProductStatus::Available, 'low_stock_alert_at' => 5])
        ->variants()->save(ProductVariant::factory()->make(['stock_on_hand' => 50]));

    $order = Order::factory()->create(['status' => OrderStatus::PickedUp, 'picked_up_at' => now()]);
    OrderItem::factory()->for($order)->for($lanyardVariant, 'variant')->create(['product_id' => $lanyard->id, 'product_name' => 'STI Lanyard', 'quantity' => 3, 'pieces_per_unit' => 1]);

    $hoodie = comingSoonHoodie(22);
    comingSoonHoodie(19, 'STI Cap');

    $this->actingAs($this->specialist)->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page
        ->where('stockCards.low_stock.count', 2)
        ->where('stockCards.low_stock.items.0.product_name', 'STI Umbrella')
        ->where('stockCards.low_stock.items.0.out_of_stock', true)
        ->where('stockCards.low_stock.items.1.pieces_left', 2)
        ->where('stockCards.best_sellers.from', '2026-11-01')
        ->where('stockCards.best_sellers.items.0', ['product_id' => $lanyard->id, 'product_name' => 'STI Lanyard', 'pieces' => 3])
        ->where('stockCards.ready_to_order.threshold', 20)
        ->where('stockCards.ready_to_order.count', 1)
        ->where('stockCards.ready_to_order.items.0', ['product_id' => $hoodie->id, 'product_name' => 'STI Batch 2027 Hoodie', 'pieces' => 22, 'preorders_close_on' => '2026-11-30']));

    // The phone's To-do has the same cards.
    Sanctum::actingAs($this->specialist);
    $this->getJson(route('api.v1.specialist.tasks'))
        ->assertJsonPath('stock_cards.ready_to_order.items.0.pieces', 22)
        ->assertJsonPath('stock_cards.low_stock.count', 2);
});

test('the number of preorders before ordering is set on Maintenance', function () {
    comingSoonHoodie(12);
    $this->actingAs($this->specialist);

    foreach (['0', '10001', 'many'] as $wrong) {
        $this->patch(route('maintenance.preorders-before-ordering'), ['preorders_before_ordering' => $wrong])
            ->assertSessionHasErrors(['preorders_before_ordering' => 'Enter a whole number from 1 to 10,000.']);
    }

    $this->patch(route('maintenance.preorders-before-ordering'), ['preorders_before_ordering' => '10'])
        ->assertInertiaFlash('toast.message', 'Coming Soon items now show as Ready to order on the dashboard once 10 pieces are preordered.');

    expect(Setting::integer(Setting::PREORDERS_BEFORE_ORDERING, 0))->toBe(10);
    $this->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page
        ->where('stockCards.ready_to_order.threshold', 10)
        ->where('stockCards.ready_to_order.count', 1));
});

test('Create PO closes the item\'s preorders so it moves to To order', function () {
    $hoodie = comingSoonHoodie(22);
    $this->actingAs($this->specialist);

    $this->post(route('preorders.create-po', $hoodie))
        ->assertInertiaFlash('toast.message', 'Preorders for STI Batch 2027 Hoodie are closed: 22 pcs are now in To order on the Preorders page. Order them in the eStore, then scan the PO.');

    expect($hoodie->refresh()->preorders_close_on->toDateString())->toBe('2026-11-12')
        ->and($hoodie->acceptsPreorders())->toBeFalse();
    $this->get(route('preorders.index', ['stage' => 'to_order']))->assertInertia(fn (Assert $page) => $page
        ->where('products.data.0.id', $hoodie->id));
    $this->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page->where('stockCards.ready_to_order.count', 0));

    $this->post(route('preorders.create-po', $hoodie))
        ->assertInertiaFlash('toast.type', 'error')
        ->assertInertiaFlash('toast.message', 'STI Batch 2027 Hoodie is no longer taking preorders, so there is nothing to change. See it on the Preorders page.');
});

test('Leave it hides the item until 10 more pieces are preordered', function () {
    $hoodie = comingSoonHoodie(22);
    $this->actingAs($this->specialist);

    $this->post(route('preorders.leave', $hoodie))
        ->assertInertiaFlash('toast.message', 'STI Batch 2027 Hoodie keeps taking preorders. It shows here again at 32 pcs preordered.');

    expect($hoodie->refresh())->preorder_alert_left_at->toBe(22)->acceptsPreorders()->toBeTrue();
    $this->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page->where('stockCards.ready_to_order.count', 0));

    Preorder::factory()->forVariant($hoodie->variants()->sole())->create(['quantity' => 10, 'status' => PreorderStatus::Active]);
    $this->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page
        ->where('stockCards.ready_to_order.count', 1)
        ->where('stockCards.ready_to_order.items.0.pieces', 32));
});

test('the phone can Create PO and Leave it, as on the website', function () {
    $hoodie = comingSoonHoodie(22);
    $cap = comingSoonHoodie(25, 'STI Cap');
    Sanctum::actingAs($this->specialist);

    $this->postJson(route('api.v1.specialist.preorders.leave', $cap))
        ->assertOk()
        ->assertJsonPath('message', 'STI Cap keeps taking preorders. It shows here again at 35 pcs preordered.');
    $this->postJson(route('api.v1.specialist.preorders.create-po', $hoodie))->assertOk();
    $this->postJson(route('api.v1.specialist.preorders.create-po', $hoodie))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['product' => 'STI Batch 2027 Hoodie is no longer taking preorders, so there is nothing to change. See it on the Preorders page.']);
});

test('only the Specialist can Create PO or Leave it', function () {
    $hoodie = comingSoonHoodie(22);

    $this->actingAs(User::factory()->schoolAdmin()->create())->post(route('preorders.create-po', $hoodie))->assertForbidden();
    $this->actingAs(User::factory()->student()->create())->post(route('preorders.leave', $hoodie))->assertForbidden();

    expect($hoodie->refresh())->acceptsPreorders()->toBeTrue()->preorder_alert_left_at->toBeNull();
});
