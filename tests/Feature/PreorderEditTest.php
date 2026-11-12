<?php

use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\Preorder;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-03 10:00', 'Asia/Manila'));
    $this->student = User::factory()->student()->create(['name' => 'Juan Dela Cruz', 'email' => 'delacruz.123456@sti.edu.ph']);
    $this->product = Product::factory()->create(['name' => 'Event Shirt', 'status' => ProductStatus::Preorder, 'preorders_close_on' => '2026-10-20']);
    $this->small = ProductVariant::factory()->for($this->product)->create(['combination' => 'Size: S', 'choices' => [['option' => 'Size', 'choice' => 'S']], 'position' => 0]);
    $this->medium = ProductVariant::factory()->for($this->product)->create(['combination' => 'Size: M', 'choices' => [['option' => 'Size', 'choice' => 'M']], 'position' => 1]);
    $this->large = ProductVariant::factory()->for($this->product)->create(['combination' => 'Size: L', 'choices' => [['option' => 'Size', 'choice' => 'L']], 'position' => 2]);
});

/**
 * Juan preorders S x2 and M x1 with one press of Preorder, at 10:00.
 *
 * @return array{0: Preorder, 1: Preorder}
 */
function juanPreordersTwoSizes(): array
{
    test()->actingAs(test()->student)->post(route('my-preorders.store', test()->product), ['items' => [
        ['product_variant_id' => test()->small->id, 'quantity' => '2'],
        ['product_variant_id' => test()->medium->id, 'quantity' => '1'],
    ]])->assertSessionHasNoErrors();

    return [Preorder::query()->where('product_variant_id', test()->small->id)->sole(), Preorder::query()->where('product_variant_id', test()->medium->id)->sole()];
}

test('preorders placed with one press share a batch, and My Preorders lists them together', function () {
    [$small, $medium] = juanPreordersTwoSizes();
    $this->travel(1)->minutes();
    $this->post(route('my-preorders.store', $this->product), ['product_variant_id' => $this->large->id, 'quantity' => '1']);
    $large = Preorder::query()->where('product_variant_id', $this->large->id)->sole();

    expect($small->batch)->toBe($medium->batch)->not->toBe($large->batch);

    $this->get(route('my-preorders.index'))->assertInertia(fn (Assert $page) => $page
        ->where('preorders.total', 2)
        ->where('preorders.data.0.id', $large->id)
        ->where('preorders.data.1.id', $small->id)
        ->where('preorders.data.2.id', $medium->id)
        ->where('preorders.data.1.batch', $small->batch)
        ->where('preorders.data.1.can_edit', true));
});

test('lowering the quantity keeps the preorder\'s place in line', function () {
    [$small] = juanPreordersTwoSizes();
    $this->travel(2)->hours();

    $this->patch(route('my-preorders.update', $small), ['product_variant_id' => $this->small->id, 'quantity' => '1'])
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.message', 'Your preorder has been changed: 1 × Event Shirt (S). It keeps its place in line.');

    expect($small->refresh())
        ->quantity->toBe(1)
        ->created_at->toEqual(CarbonImmutable::parse('2026-10-03 10:00', 'Asia/Manila'))
        ->edited_at->toEqual(now());
});

test('raising the quantity or changing the size moves the preorder to the end of the line', function () {
    [$small, $medium] = juanPreordersTwoSizes();
    $this->travel(2)->hours();

    $this->patch(route('my-preorders.update', $small), ['product_variant_id' => $this->small->id, 'quantity' => '3'])
        ->assertInertiaFlash('toast.message', 'Your preorder has been changed: 3 × Event Shirt (S). It is now at the end of the line.');
    expect($small->refresh()->created_at)->toEqual(now());

    $this->travel(1)->hours();
    $this->patch(route('my-preorders.update', $medium), ['product_variant_id' => $this->large->id, 'quantity' => '1'])->assertSessionHasNoErrors();
    expect($medium->refresh())
        ->product_variant_id->toBe($this->large->id)
        ->created_at->toEqual(now())
        ->batch->toBe($small->batch);
});

test('editing explains what is wrong', function () {
    [$small] = juanPreordersTwoSizes();

    $this->patch(route('my-preorders.update', $small), ['product_variant_id' => $this->small->id, 'quantity' => '2'])
        ->assertSessionHasErrors(['quantity' => 'Change the size, color or quantity first.']);
    $this->patch(route('my-preorders.update', $small), ['product_variant_id' => $this->medium->id, 'quantity' => '2'])
        ->assertSessionHasErrors(['product_variant_id' => 'This preorder already has M. Change its quantity instead.']);
    $this->patch(route('my-preorders.update', $small), ['product_variant_id' => $this->small->id, 'quantity' => '0'])
        ->assertSessionHasErrors(['quantity' => 'The quantity must be at least 1.']);
    $this->patch(route('my-preorders.update', $small), ['product_variant_id' => $this->small->id, 'quantity' => '100'])
        ->assertSessionHasErrors(['quantity' => 'You can get at most 99 of one item. Contact the PROWARE office to get more.']);
    $other = ProductVariant::factory()->create();
    $this->patch(route('my-preorders.update', $small), ['product_variant_id' => $other->id, 'quantity' => '1'])
        ->assertSessionHasErrors(['product_variant_id' => 'Choose one of this item\'s sizes or colors.']);

    expect($small->refresh())->quantity->toBe(2)->product_variant_id->toBe($this->small->id);
});

test('only a waiting preorder of an item still taking preorders can be changed', function () {
    [$small, $medium] = juanPreordersTwoSizes();
    $medium->update(['status' => PreorderStatus::Held, 'held_until' => now()->addDay()]);

    $this->patch(route('my-preorders.update', $medium), ['product_variant_id' => $this->medium->id, 'quantity' => '2'])
        ->assertSessionHasErrors(['preorder' => 'The pieces of your preorder for Event Shirt are already held for you. To get fewer, order fewer with Order now.']);

    $this->travelTo(CarbonImmutable::parse('2026-10-21 08:00', 'Asia/Manila'));
    $this->patch(route('my-preorders.update', $small), ['product_variant_id' => $this->small->id, 'quantity' => '1'])
        ->assertSessionHasErrors(['preorder' => 'Preorders for Event Shirt are closed, so this preorder can no longer be changed here. Ask the PROWARE office.']);

    expect($small->refresh()->quantity)->toBe(2);
});

test('a buyer cannot change another buyer\'s preorder', function () {
    [$small] = juanPreordersTwoSizes();

    $this->actingAs(User::factory()->student()->create())
        ->patch(route('my-preorders.update', $small), ['product_variant_id' => $this->small->id, 'quantity' => '1'])
        ->assertNotFound();

    expect($small->refresh()->quantity)->toBe(2);
});

test('a sold-out size can only be changed to another sold-out size', function () {
    $mug = Product::factory()->create(['name' => 'STI Mug', 'status' => ProductStatus::Available]);
    $blue = ProductVariant::factory()->for($mug)->create(['combination' => 'Color: Blue', 'choices' => [['option' => 'Color', 'choice' => 'Blue']], 'stock_on_hand' => 0]);
    $red = ProductVariant::factory()->for($mug)->create(['combination' => 'Color: Red', 'choices' => [['option' => 'Color', 'choice' => 'Red']], 'stock_on_hand' => 5]);
    $green = ProductVariant::factory()->for($mug)->create(['combination' => 'Color: Green', 'choices' => [['option' => 'Color', 'choice' => 'Green']], 'stock_on_hand' => 0]);
    $preorder = Preorder::factory()->forVariant($blue)->for($this->student, 'student')->create(['quantity' => 2]);

    $this->actingAs($this->student)
        ->patch(route('my-preorders.update', $preorder), ['product_variant_id' => $red->id, 'quantity' => '2'])
        ->assertSessionHasErrors(['product_variant_id' => 'STI Mug (Red) is in stock. Add it to your cart instead.']);
    $this->patch(route('my-preorders.update', $preorder), ['product_variant_id' => $green->id, 'quantity' => '2'])->assertSessionHasNoErrors();

    expect($preorder->refresh()->product_variant_id)->toBe($green->id);
});

test('early-bird pieces stay with a changed preorder up to its new quantity, and the rest go to the next in line', function () {
    $this->product->update(['early_bird_price_centavos' => 30000, 'early_bird_pieces' => 2]);
    // S x2 takes both early-bird pieces; M x1, in line after it, gets none.
    [$small, $medium] = juanPreordersTwoSizes();
    expect($small->refresh()->early_bird_pieces)->toBe(2)->and($medium->refresh()->early_bird_pieces)->toBe(0);

    $this->patch(route('my-preorders.update', $small), ['product_variant_id' => $this->small->id, 'quantity' => '1'])->assertSessionHasNoErrors();

    expect($small->refresh()->early_bird_pieces)->toBe(1)
        ->and($medium->refresh()->early_bird_pieces)->toBe(1);
});

test('the phone app can change a preorder', function () {
    [$small] = juanPreordersTwoSizes();
    Sanctum::actingAs($this->student);

    $this->patchJson(route('api.v1.preorders.update', $small), ['product_variant_id' => $this->large->id, 'quantity' => '2'])
        ->assertOk()
        ->assertJsonPath('message', 'Your preorder has been changed: 2 × Event Shirt (L). It is now at the end of the line.')
        ->assertJsonPath('preorder.variant_label', 'L');
    $this->patchJson(route('api.v1.preorders.update', $small), ['product_variant_id' => $this->large->id, 'quantity' => '2'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['quantity' => 'Change the size, color or quantity first.']);
});
