<?php

use App\Enums\ProductStatus;
use App\Models\Preorder;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Storage::fake('public');
    $this->travelTo(CarbonImmutable::parse('2026-10-19 10:00', 'Asia/Manila'));
    $this->product = Product::factory()->create([
        'name' => 'STI Hoodie',
        'price_centavos' => 75000,
        'status' => ProductStatus::Preorder,
        'preorders_close_on' => '2026-11-05',
        'expected_arrival_from' => '2026-11-19',
        'expected_arrival_to' => '2026-11-26',
        'early_bird_price_centavos' => 65000,
        'early_bird_pieces' => 5,
    ]);
    $this->small = ProductVariant::factory()->for($this->product)->create(['combination' => 'Size: S', 'choices' => [['option' => 'Size', 'choice' => 'S']], 'position' => 0]);
    $this->medium = ProductVariant::factory()->for($this->product)->create(['combination' => 'Size: M', 'choices' => [['option' => 'Size', 'choice' => 'M']], 'position' => 1]);
    $this->product->photos()->create(['path' => 'products/hoodie.jpg', 'position' => 0]);
});

/**
 * A student preorders the Hoodie (one minute after the one before).
 */
function preorderHoodie(Product $product, ProductVariant $size, int $quantity, ?User $student = null): User
{
    $student ??= User::factory()->student()->create();
    test()->travel(1)->minutes();
    test()->actingAs($student)->post(route('my-preorders.store', $product), ['product_variant_id' => $size->id, 'quantity' => (string) $quantity])->assertSessionHasNoErrors();

    return $student;
}

/**
 * Early-bird pieces of each student's active preorder, in the order given.
 *
 * @param  list<User>  $students
 * @return list<int>
 */
function earlyBirdOf(array $students): array
{
    return array_map(fn (User $student): int => (int) Preorder::query()->where('user_id', $student->id)->where('status', 'active')->sum('early_bird_pieces'), $students);
}

/**
 * The Edit Product form for the Hoodie, changed by $overrides.
 *
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function earlyBirdHoodieForm(Product $product, array $overrides = []): array
{
    return array_merge([
        'name' => 'STI Hoodie', 'sold_by_piece' => '1', 'price' => '750', 'status' => 'preorder', 'sale_price' => '',
        'low_stock_alert_at' => '5', 'packs' => [],
        'photos' => [['id' => $product->photos()->value('id'), 'label' => '']],
        'options' => [['name' => 'Size', 'choices' => ['S', 'M']]],
        'variants' => [
            ['combination' => 'Size: S', 'estore_item_code' => '', 'estore_pack_key' => '', 'price' => ''],
            ['combination' => 'Size: M', 'estore_item_code' => '', 'estore_pack_key' => '', 'price' => ''],
        ],
        'preorders_close_on' => '2026-11-05', 'expected_arrival_from' => '2026-11-19', 'expected_arrival_to' => '2026-11-26',
        'early_bird_price' => '650', 'early_bird_pieces' => '5',
    ], $overrides);
}

test('the first pieces preordered get the early-bird price, counted per piece across sizes', function () {
    $first = preorderHoodie($this->product, $this->small, 3);
    $second = User::factory()->student()->create();

    $this->travel(1)->minutes();
    $this->actingAs($second)
        ->post(route('my-preorders.store', $this->product), ['product_variant_id' => $this->medium->id, 'quantity' => '4'])
        ->assertInertiaFlash('toast.message', 'Your preorder of 4 × STI Hoodie (M) has been placed. 2 pcs get the early-bird price of ₱650.00. It is listed in My Preorders.');

    $third = User::factory()->student()->create();
    $this->travel(1)->minutes();
    $this->actingAs($third)
        ->post(route('my-preorders.store', $this->product), ['product_variant_id' => $this->small->id, 'quantity' => '1'])
        ->assertInertiaFlash('toast.message', 'Your preorder of 1 × STI Hoodie (S) has been placed. The early-bird pieces are all taken. It is listed in My Preorders.');

    expect(earlyBirdOf([$first, $second, $third]))->toBe([3, 2, 0]);
});

test('when an early preorder is cancelled, the next pieces move up', function () {
    $first = preorderHoodie($this->product, $this->small, 3);
    $second = preorderHoodie($this->product, $this->medium, 4);
    $third = preorderHoodie($this->product, $this->small, 1);

    $this->actingAs($first)->delete(route('my-preorders.destroy', Preorder::query()->where('user_id', $first->id)->sole()));

    expect(earlyBirdOf([$first, $second, $third]))->toBe([0, 4, 1]);
});

test('preordering more later only gets early-bird pieces that are still free', function () {
    $first = preorderHoodie($this->product, $this->small, 1);
    $second = preorderHoodie($this->product, $this->medium, 4);

    preorderHoodie($this->product, $this->small, 3, $first);

    expect(earlyBirdOf([$first, $second]))->toBe([1, 4]);
});

test('fewer early-bird pieces are taken back from the latest preorders first, and none without a price', function () {
    $specialist = User::factory()->specialist()->create();
    $first = preorderHoodie($this->product, $this->small, 3);
    $second = preorderHoodie($this->product, $this->medium, 2);

    $this->actingAs($specialist)
        ->put(route('products.update', $this->product), earlyBirdHoodieForm($this->product, ['early_bird_pieces' => '3']))
        ->assertSessionHasNoErrors();

    expect(earlyBirdOf([$first, $second]))->toBe([3, 0]);

    $this->put(route('products.update', $this->product), earlyBirdHoodieForm($this->product, ['early_bird_price' => '', 'early_bird_pieces' => '']))
        ->assertSessionHasNoErrors();

    expect(earlyBirdOf([$first, $second]))->toBe([0, 0])
        ->and($this->product->refresh()->early_bird_price_centavos)->toBeNull();
});

test('the early-bird price explains what is wrong', function (array $overrides, string $field, string $message) {
    $this->actingAs(User::factory()->specialist()->create())
        ->put(route('products.update', $this->product), earlyBirdHoodieForm($this->product, $overrides))
        ->assertSessionHasErrors([$field => $message]);
})->with([
    'no number of pieces' => [['early_bird_pieces' => ''], 'early_bird_pieces', 'Enter how many pieces get the early-bird price, or clear the price.'],
    'no price' => [['early_bird_price' => ''], 'early_bird_price', 'Enter the early-bird price, or clear the number of pieces.'],
    'not lower than the Selling Price' => [['early_bird_price' => '750'], 'early_bird_price', 'The early-bird price must be lower than the Selling Price (₱750.00).'],
    'not lower than a size\'s own price' => [['variants' => [
        ['combination' => 'Size: S', 'estore_item_code' => '', 'estore_pack_key' => '', 'price' => '600'],
        ['combination' => 'Size: M', 'estore_item_code' => '', 'estore_pack_key' => '', 'price' => ''],
    ]], 'early_bird_price', 'The early-bird price must be lower than the Selling Price (₱600.00).'],
    'no pieces' => [['early_bird_pieces' => '0'], 'early_bird_pieces', 'At least 1 piece must get the early-bird price.'],
]);

test('students see the early-bird price and how many pieces are left', function () {
    $student = preorderHoodie($this->product, $this->small, 2);

    $this->get(route('home'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('comingSoon.0.early_bird', ['price_centavos' => 65000, 'pieces' => 5, 'pieces_left' => 3]));

    $this->actingAs($student)
        ->get(route('my-preorders.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('preorders.data.0.early_bird_pieces', 2)
            ->where('preorders.data.0.early_bird_price_centavos', 65000));
});
