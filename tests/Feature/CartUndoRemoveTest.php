<?php

use App\Enums\ProductStatus;
use App\Models\CartItem;
use App\Models\Product;
use App\Models\ProductPack;
use App\Models\ProductVariant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->student = User::factory()->student()->create();
    $this->product = Product::factory()->create(['name' => 'STI Lanyard', 'price_centavos' => 6000, 'status' => ProductStatus::Available, 'low_stock_alert_at' => 0]);
    $this->variant = ProductVariant::factory()->for($this->product)->create(['stock_on_hand' => 30]);
    $this->pack = ProductPack::factory()->for($this->product)->create(['name' => 'Pack', 'pieces' => 10, 'price_centavos' => 55000, 'sold_to_students' => true]);
});

/**
 * What the cart page's Undo sends after a line was removed.
 *
 * @return array<string, mixed>
 */
function undoRemove(CartItem $line, bool $selected): array
{
    return ['product_variant_id' => $line->product_variant_id, 'product_pack_id' => $line->product_pack_id, 'quantity' => $line->quantity, 'undo_remove' => true, 'selected' => $selected];
}

test('the cart tells each line what Undo needs to put it back', function () {
    CartItem::factory()->for($this->student, 'student')->for($this->variant, 'variant')->create(['product_pack_id' => $this->pack->id, 'quantity' => 2]);

    $this->actingAs($this->student)->get(route('cart.index'))
        ->assertInertia(fn ($page) => $page
            ->where('lines.0.product_variant_id', $this->variant->id)
            ->where('lines.0.product_pack_id', $this->pack->id)
            ->where('lines.0.set', null));
});

test('Undo after Remove puts the line back, unticked as it was, and says it is back', function () {
    $line = CartItem::factory()->for($this->student, 'student')->for($this->variant, 'variant')->create(['quantity' => 2, 'selected' => false]);
    $this->actingAs($this->student)->delete(route('cart.destroy', $line));
    expect($this->student->cartItems()->count())->toBe(0);

    $this->post(route('cart.store', $this->product), undoRemove($line, selected: false))
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.message', '2 pcs of STI Lanyard are back in your cart.');

    expect($this->student->cartItems()->sole())
        ->product_variant_id->toBe($this->variant->id)
        ->quantity->toBe(2)
        ->selected->toBeFalse();
});

test('Undo puts a ticked pack line back ticked', function () {
    $line = CartItem::factory()->for($this->student, 'student')->for($this->variant, 'variant')->create(['product_pack_id' => $this->pack->id, 'quantity' => 1, 'selected' => true]);
    $this->actingAs($this->student)->delete(route('cart.destroy', $line));

    $this->post(route('cart.store', $this->product), undoRemove($line, selected: true))
        ->assertInertiaFlash('toast.message', '1 Pack of STI Lanyard is back in your cart.');

    expect($this->student->cartItems()->sole())
        ->product_pack_id->toBe($this->pack->id)
        ->selected->toBeTrue();
});

test('Undo is checked like Add to Cart: it is refused when the pieces are gone', function () {
    $line = CartItem::factory()->for($this->student, 'student')->for($this->variant, 'variant')->create(['quantity' => 2]);
    $this->actingAs($this->student)->delete(route('cart.destroy', $line));
    $this->variant->forceFill(['stock_on_hand' => 0])->save();

    $this->post(route('cart.store', $this->product), undoRemove($line, selected: true))
        ->assertSessionHasErrors('quantity');

    expect($this->student->cartItems()->count())->toBe(0);
});

test('the phone app\'s Undo puts the line back the same way', function () {
    $line = CartItem::factory()->for($this->student, 'student')->for($this->variant, 'variant')->create(['quantity' => 3, 'selected' => false]);
    Sanctum::actingAs($this->student);
    $this->deleteJson(route('api.v1.cart.destroy', $line))->assertOk();

    $this->postJson(route('api.v1.cart.store', $this->product), undoRemove($line, selected: false))
        ->assertCreated()
        ->assertJsonPath('message', '3 pcs of STI Lanyard are back in your cart.')
        ->assertJsonPath('cart.lines.0.quantity', 3)
        ->assertJsonPath('cart.lines.0.selected', false);
});
