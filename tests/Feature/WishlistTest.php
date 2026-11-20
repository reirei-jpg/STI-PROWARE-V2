<?php

use App\Enums\ProductStatus;
use App\Models\CartItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\WishlistItem;
use App\Services\Shop\Wishlist;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-11-20 10:00', 'Asia/Manila'));
    $this->student = User::factory()->student()->create(['name' => 'Juan Dela Cruz']);
    // STI Shirt at ₱350: S has 6 left, M is sold out.
    $this->shirt = Product::factory()->create(['name' => 'STI Shirt', 'price_centavos' => 35000, 'status' => ProductStatus::Available, 'low_stock_alert_at' => 3]);
    $this->small = ProductVariant::factory()->for($this->shirt)->create(['combination' => 'Size: S', 'choices' => [['option' => 'Size', 'choice' => 'S']], 'stock_on_hand' => 6, 'position' => 0]);
    $this->medium = ProductVariant::factory()->for($this->shirt)->create(['combination' => 'Size: M', 'choices' => [['option' => 'Size', 'choice' => 'M']], 'stock_on_hand' => 0, 'position' => 1]);
    StockMovement::factory()->for($this->small, 'variant')->create();
    StockMovement::factory()->for($this->medium, 'variant')->create();
});

test('a buyer adds an item to the wishlist with its size, and sees it on My Wishlist', function () {
    $this->actingAs($this->student)
        ->post(route('wishlist.store', $this->shirt), ['product_variant_id' => $this->small->id])
        ->assertInertiaFlash('toast.message', 'STI Shirt (S) has been added to your wishlist.');

    // Adding it again keeps one.
    $this->post(route('wishlist.store', $this->shirt), ['product_variant_id' => $this->small->id])
        ->assertInertiaFlash('toast.message', 'STI Shirt (S) is already in your wishlist.');
    expect(WishlistItem::count())->toBe(1);

    $this->get(route('wishlist.index'))->assertInertia(fn (Assert $page) => $page
        ->component('storefront/wishlist')
        ->has('items', 1)
        ->where('items.0.product_name', 'STI Shirt')
        ->where('items.0.variant_label', 'S')
        ->where('items.0.price.piece_centavos', 35000)
        ->where('items.0.status_text', '6 pcs left')
        ->where('items.0.status_tone', 'green')
        ->where('items.0.can_buy', true)
        ->where('wishlist_count', 1));
});

test('the size and color must be chosen first, like Add to Cart', function () {
    $this->actingAs($this->student)
        ->post(route('wishlist.store', $this->shirt), ['product_variant_id' => ''])
        ->assertSessionHasErrors(['product_variant_id' => 'Choose the size and color first.']);

    Sanctum::actingAs($this->student);
    $this->postJson(route('api.v1.wishlist.store', $this->shirt), [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['product_variant_id' => 'Choose the size and color first.']);

    expect(WishlistItem::count())->toBe(0);
});

test('a sold-out size says so, and it can be preordered', function () {
    $this->actingAs($this->student)->post(route('wishlist.store', $this->shirt), ['product_variant_id' => $this->medium->id]);

    $this->get(route('wishlist.index'))->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('items.0.status_text', 'Out of stock · preorder it')
        ->where('items.0.status_tone', 'red')
        ->where('items.0.can_buy', false)
        ->where('items.0.can_preorder', true));
});

test('only the item\'s own sizes can be saved, and a Draft item cannot', function () {
    $other = ProductVariant::factory()->create();
    $draft = Product::factory()->create(['status' => ProductStatus::Draft]);

    $this->actingAs($this->student)
        ->post(route('wishlist.store', $this->shirt), ['product_variant_id' => $other->id])
        ->assertSessionHasErrors(['product_variant_id' => 'Choose one of this item\'s sizes or colors.']);
    $this->post(route('wishlist.store', $draft), ['product_variant_id' => ''])->assertNotFound();

    expect(WishlistItem::count())->toBe(0);
});

test('a full wishlist is refused with a reason', function () {
    WishlistItem::factory()->count(Wishlist::MAX_ITEMS)->for($this->student, 'buyer')->create();

    $this->actingAs($this->student)
        ->post(route('wishlist.store', $this->shirt), ['product_variant_id' => $this->small->id])
        ->assertInertiaFlash('toast.message', 'Your wishlist can have up to 100 items. Remove some first.');

    expect(WishlistItem::count())->toBe(Wishlist::MAX_ITEMS);
});

test('a cart line can be moved to the wishlist; a uniform set cannot', function () {
    $this->actingAs($this->student)->post(route('cart.store', $this->shirt), ['product_variant_id' => $this->small->id, 'quantity' => '2']);

    $this->post(route('wishlist.move-from-cart', CartItem::sole()))
        ->assertInertiaFlash('toast.message', 'STI Shirt (S) has been moved to your wishlist.');

    expect(CartItem::count())->toBe(0)
        ->and(WishlistItem::sole()->product_variant_id)->toBe($this->small->id);

    $setLine = CartItem::factory()->for($this->student, 'student')->create(['product_variant_id' => $this->small->id, 'set_key' => 'a-set']);
    $this->post(route('wishlist.move-from-cart', $setLine))
        ->assertInertiaFlash('toast.message', 'A uniform set cannot be moved to the wishlist. Remove it instead.');
    expect($setLine->fresh())->not->toBeNull();
});

test('a buyer removes their own items only', function () {
    $mine = WishlistItem::factory()->for($this->student, 'buyer')->create(['product_id' => $this->shirt->id, 'product_variant_id' => $this->small->id]);
    $theirs = WishlistItem::factory()->create();

    $this->actingAs($this->student)->delete(route('wishlist.destroy', $theirs))->assertNotFound();
    $this->delete(route('wishlist.destroy', $mine))
        ->assertInertiaFlash('toast.message', 'STI Shirt (S) has been removed from your wishlist.');

    expect(WishlistItem::query()->pluck('id')->all())->toBe([$theirs->id]);
});

test('the phone app has the same wishlist', function () {
    Sanctum::actingAs($this->student);

    $this->postJson(route('api.v1.wishlist.store', $this->shirt), ['product_variant_id' => $this->small->id])
        ->assertCreated()
        ->assertJsonPath('message', 'STI Shirt (S) has been added to your wishlist.')
        ->assertJsonPath('items.0.status_text', '6 pcs left');
    $this->getJson(route('api.v1.wishlist.index'))->assertJsonCount(1, 'items');
    $this->deleteJson(route('api.v1.wishlist.destroy', WishlistItem::sole()))
        ->assertOk()
        ->assertJsonPath('items', []);
});

test('the Specialist and guests have no wishlist', function () {
    $this->get(route('wishlist.index'))->assertRedirect(route('login'));
    $this->actingAs(User::factory()->specialist()->create())
        ->post(route('wishlist.store', $this->shirt), ['product_variant_id' => $this->small->id])
        ->assertForbidden();
});
