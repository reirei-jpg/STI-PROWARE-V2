<?php

use App\Enums\ProductStatus;
use App\Models\CartItem;
use App\Models\Preorder;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Setting;
use App\Models\User;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-03 10:00', 'Asia/Manila'));
    $this->student = User::factory()->student()->create(['name' => 'Juan Dela Cruz', 'email' => 'delacruz.123456@sti.edu.ph']);
    $this->specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
    $this->product = Product::factory()->create(['name' => 'STI Lanyard', 'price_centavos' => 5000, 'status' => ProductStatus::Available, 'low_stock_alert_at' => 0]);
    $this->variant = ProductVariant::factory()->for($this->product)->create(['stock_on_hand' => 600]);
});

test('a buyer can get at most 99 of one item, even with more in stock', function () {
    $this->actingAs($this->student);

    $this->post(route('cart.store', $this->product), ['product_variant_id' => $this->variant->id, 'quantity' => '100'])
        ->assertSessionHasErrors(['quantity' => 'You can get at most 99 of one item. Contact the PROWARE office to get more.']);
    $this->post(route('cart.store', $this->product), ['product_variant_id' => $this->variant->id, 'quantity' => '99'])->assertSessionHasNoErrors();
    $this->patch(route('cart.update', CartItem::sole()), ['quantity' => '100'])
        ->assertSessionHasErrors(['quantity' => 'You can get at most 99 of one item. Contact the PROWARE office to get more.']);

    expect(CartItem::sole()->quantity)->toBe(99);
    $this->get(route('cart.index'))->assertInertia(fn (Assert $page) => $page
        ->where('buyer_limit', 99)
        ->where('lines.0.most_allowed', 99));
});

test('when fewer are in stock than the limit, the buyer is told how many are left', function () {
    $this->variant->forceFill(['stock_on_hand' => 40])->save();

    $this->actingAs($this->student)
        ->post(route('cart.store', $this->product), ['product_variant_id' => $this->variant->id, 'quantity' => '50'])
        ->assertSessionHasErrors(['quantity' => 'You can have at most 40 pcs of STI Lanyard in your cart (only 40 pcs left).']);
});

test('a buyer the Specialist allowed more can order and preorder more than everyone else', function () {
    $this->actingAs($this->specialist)
        ->post(route('maintenance.buyers-allowed-more.store'), ['email' => ' DelaCruz.123456@sti.edu.ph ', 'most_per_item' => '500'])
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.message', 'Juan Dela Cruz can now get at most 500 of one item.');

    $this->actingAs($this->student->refresh())
        ->post(route('cart.store', $this->product), ['product_variant_id' => $this->variant->id, 'quantity' => '500'])
        ->assertSessionHasNoErrors();
    $this->post(route('cart.store', $this->product), ['product_variant_id' => $this->variant->id, 'quantity' => '1'])
        ->assertSessionHasErrors(['quantity' => 'You can get at most 500 of one item. Contact the PROWARE office to get more.']);

    $shirt = Product::factory()->create(['name' => 'Event Shirt', 'status' => ProductStatus::Preorder, 'preorders_close_on' => '2026-10-20']);
    $size = ProductVariant::factory()->for($shirt)->create();
    $this->post(route('my-preorders.store', $shirt), ['product_variant_id' => $size->id, 'quantity' => '300'])->assertSessionHasNoErrors();
    expect(Preorder::sole()->quantity)->toBe(300);

    // Everyone else still stops at 99.
    $other = User::factory()->student()->create();
    $this->actingAs($other)
        ->post(route('my-preorders.store', $shirt), ['product_variant_id' => $size->id, 'quantity' => '100'])
        ->assertSessionHasErrors(['quantity' => 'You can get at most 99 of one item. Contact the PROWARE office to get more.']);
});

test('the item view tells each buyer the most they can get', function () {
    $this->student->forceFill(['most_per_item' => 500])->save();

    $this->getJson(route('storefront.product', $this->product))->assertJsonPath('most_per_item', 99);
    $this->actingAs($this->student)->getJson(route('storefront.product', $this->product))->assertJsonPath('most_per_item', 500);

    Sanctum::actingAs($this->student);
    $this->getJson(route('api.v1.storefront.product', $this->product))->assertJsonPath('most_per_item', 500);
    $this->getJson(route('api.v1.storefront.home'))->assertJsonPath('most_per_item', 500);
});

test('the Specialist sets the limit for everyone, and a buyer allowed more keeps theirs', function () {
    $this->student->forceFill(['most_per_item' => 500])->save();
    $this->actingAs($this->specialist);

    $this->get(route('maintenance.index'))->assertInertia(fn (Assert $page) => $page
        ->where('mostPerItem.value', 99)
        ->where('buyersAllowedMore.0.email', 'delacruz.123456@sti.edu.ph')
        ->where('buyersAllowedMore.0.most_per_item', 500));

    foreach (['0', '10001', 'many', ''] as $wrong) {
        $this->patch(route('maintenance.most-per-item'), ['most_per_item' => $wrong])
            ->assertSessionHasErrors(['most_per_item' => 'Enter a whole number from 1 to 10,000.']);
    }

    $this->patch(route('maintenance.most-per-item'), ['most_per_item' => '50'])
        ->assertInertiaFlash('toast.message', 'Buyers can now get at most 50 of one item. Buyers allowed more keep their own number.');

    expect(Setting::integer(Setting::MOST_PER_ITEM, 0))->toBe(50);
    $other = User::factory()->student()->create();
    $this->actingAs($other)
        ->post(route('cart.store', $this->product), ['product_variant_id' => $this->variant->id, 'quantity' => '51'])
        ->assertSessionHasErrors(['quantity' => 'You can get at most 50 of one item. Contact the PROWARE office to get more.']);
    $this->actingAs($this->student)
        ->post(route('cart.store', $this->product), ['product_variant_id' => $this->variant->id, 'quantity' => '400'])
        ->assertSessionHasNoErrors();
});

test('allowing a buyer more explains what is wrong', function () {
    $this->actingAs($this->specialist);

    $this->post(route('maintenance.buyers-allowed-more.store'), ['email' => 'nobody@sti.edu.ph', 'most_per_item' => '500'])
        ->assertSessionHasErrors(['email' => 'No buyer has this email. Check it, or ask the buyer to register first.']);
    $this->post(route('maintenance.buyers-allowed-more.store'), ['email' => $this->specialist->email, 'most_per_item' => '500'])
        ->assertSessionHasErrors(['email' => 'No buyer has this email. Check it, or ask the buyer to register first.']);
    $this->post(route('maintenance.buyers-allowed-more.store'), ['email' => '', 'most_per_item' => ''])
        ->assertSessionHasErrors([
            'email' => 'Enter the buyer\'s email.',
            'most_per_item' => 'Enter a whole number from 1 to 10,000.',
        ]);

    expect($this->student->refresh()->most_per_item)->toBeNull();
});

test('removing a buyer\'s allowance brings them back to the limit for everyone', function () {
    $this->student->forceFill(['most_per_item' => 500])->save();

    $this->actingAs($this->specialist)
        ->delete(route('maintenance.buyers-allowed-more.destroy', $this->student))
        ->assertInertiaFlash('toast.message', 'Juan Dela Cruz is back to the limit for everyone: 99 of one item.');

    expect($this->student->refresh()->most_per_item)->toBeNull();
    $this->delete(route('maintenance.buyers-allowed-more.destroy', $this->student))->assertNotFound();
});

test('only the Specialist can change the limits', function () {
    $this->actingAs($this->student);

    $this->patch(route('maintenance.most-per-item'), ['most_per_item' => '500'])->assertForbidden();
    $this->post(route('maintenance.buyers-allowed-more.store'), ['email' => $this->student->email, 'most_per_item' => '500'])->assertForbidden();

    expect($this->student->refresh()->most_per_item)->toBeNull();
});

test('a cart line above a lowered limit must be lowered before the order is placed', function () {
    $this->student->forceFill(['most_per_item' => 500])->save();
    $this->actingAs($this->student)->post(route('cart.store', $this->product), ['product_variant_id' => $this->variant->id, 'quantity' => '200']);
    $this->student->forceFill(['most_per_item' => null])->save();

    $this->get(route('cart.index'))->assertInertia(fn (Assert $page) => $page
        ->where('can_place_order', false)
        ->where('lines.0.problem', 'You can get at most 99 of one item. Lower the quantity, or contact the PROWARE office to get more.'));
    $this->post(route('my-orders.store'), ['section' => 'BSIT 1-A'])
        ->assertSessionHasErrors(['cart' => 'You can get at most 99 of one item, and your cart has 200 of STI Lanyard. Lower the quantity, or contact the PROWARE office to get more.']);
});
