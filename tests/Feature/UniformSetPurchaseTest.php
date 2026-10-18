<?php

use App\Enums\ProductStatus;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\UniformSet;
use App\Models\User;
use App\Services\Shop\IssuanceSlip;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-19 10:00', 'Asia/Manila'));
    $this->student = User::factory()->student()->create(['name' => 'Juan Dela Cruz', 'email' => 'delacruz.123456@sti.edu.ph']);
});

/**
 * A uniform piece for sale with sizes S, M and L and this many of each.
 *
 * @param  array<string, int>  $stock
 */
function uniformPiece(string $name, int $pesos, array $stock = ['S' => 5, 'M' => 5, 'L' => 0]): Product
{
    $product = Product::factory()->create(['name' => $name, 'price_centavos' => $pesos * 100, 'status' => ProductStatus::Available, 'low_stock_alert_at' => 0]);

    foreach (array_keys($stock) as $position => $size) {
        ProductVariant::factory()->for($product)->create([
            'combination' => "Size: {$size}",
            'choices' => [['option' => 'Size', 'choice' => $size]],
            'stock_on_hand' => $stock[$size],
            'position' => $position,
        ]);
    }

    return $product;
}

/**
 * The BSIT set sold as a set: Polo ₱550 and Pants ₱580 for boys, Blouse
 * ₱550 with Ladies' Pants ₱580 or Skirt ₱520 for girls.
 */
function bsitSaleSet(array $overrides = []): UniformSet
{
    return UniformSet::factory()->create([
        'name' => 'BSIT',
        'polo_product_id' => uniformPiece('BSIT Polo', 550)->id,
        'pants_product_id' => uniformPiece('BSIT Pants', 580)->id,
        'blouse_product_id' => uniformPiece('BSIT Blouse', 550)->id,
        'ladies_pants_product_id' => uniformPiece("BSIT Ladies' Pants", 580)->id,
        'skirt_product_id' => uniformPiece('BSIT Skirt', 520)->id,
        'sold_as_set' => true,
        ...$overrides,
    ]);
}

function pieceSize(?int $productId, string $size): ProductVariant
{
    return ProductVariant::query()->where('product_id', $productId)->where('combination', "Size: {$size}")->sole();
}

/**
 * @return array{for: string, top_variant_id: int, bottom_variant_id: int, quantity: string}
 */
function boysSet(UniformSet $set, string $top = 'M', string $bottom = 'S', string $quantity = '1'): array
{
    return [
        'for' => 'boys',
        'top_variant_id' => pieceSize($set->polo_product_id, $top)->id,
        'bottom_variant_id' => pieceSize($set->pants_product_id, $bottom)->id,
        'quantity' => $quantity,
    ];
}

test('the storefront shows the sets that are for sale, with what boys and girls get', function () {
    $set = bsitSaleSet();
    UniformSet::factory()->create(['name' => 'BSHM', 'sold_as_set' => false]);
    UniformSet::factory()->create([
        'name' => 'Senior High',
        'polo_product_id' => uniformPiece('Senior High Polo', 550)->id,
        'pants_product_id' => uniformPiece('Senior High Pants', 580)->id,
        'blouse_product_id' => uniformPiece('Senior High Blouse', 550)->id,
        'skirt_product_id' => uniformPiece('Senior High Skirt', 520)->id,
        'sold_as_set' => true,
    ]);

    $this->get(route('home'))->assertInertia(fn (Assert $page) => $page
        ->has('uniformSets', 2)
        ->where('uniformSets.0.name', 'BSIT Uniform Set')
        // The lowest a set comes to: Blouse ₱550 + Skirt ₱520.
        ->where('uniformSets.0.price_centavos', 107000)
        ->where('uniformSets.0.price_from', true)
        ->where('uniformSets.0.options.0.label', 'For Boys')
        ->where('uniformSets.0.options.0.top.kind', 'Polo')
        ->where('uniformSets.0.options.0.bottoms.0.kind', 'Pants')
        ->where('uniformSets.0.options.1.label', 'For Girls')
        ->where('uniformSets.0.options.1.bottoms.0.kind', "Ladies' Pants")
        ->where('uniformSets.0.options.1.bottoms.1.kind', 'Skirt')
        ->where('uniformSets.0.options.0.top.sizes.2.stock_pieces', 0)
        // Senior High girls get only the skirt.
        ->where('uniformSets.1.name', 'Senior High Uniform Set')
        ->has('uniformSets.1.options.1.bottoms', 1)
        ->where('uniformSets.1.options.1.bottoms.0.kind', 'Skirt')
    );
});

test('a student adds a set: its top and bottom go in as one, at what the two cost', function () {
    $set = bsitSaleSet();
    $this->actingAs($this->student);

    $this->post(route('cart.store-set', $set), boysSet($set, quantity: '2'))
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.message', '2 × BSIT Uniform Set (For Boys: BSIT Polo (M), BSIT Pants (S)) have been added to your cart.');

    // The same set with the same sizes again adds to it.
    $this->post(route('cart.store-set', $set), boysSet($set));

    $lines = CartItem::query()->orderBy('id')->get();
    expect($lines)->toHaveCount(2)
        ->and($lines->pluck('quantity')->all())->toBe([3, 3])
        ->and($lines[0]->set_key)->not->toBeNull()->toBe($lines[1]->set_key);

    $this->get(route('cart.index'))->assertInertia(fn (Assert $page) => $page
        ->where('selected_count', 1)
        ->where('lines.0.unit_price_centavos', 55000)
        ->where('lines.1.unit_price_centavos', 58000)
        ->where('lines.0.set.name', 'BSIT Uniform Set')
        ->where('lines.0.set.for_label', 'For Boys')
        ->where('lines.0.set.price_centavos', 113000)
        ->where('total_centavos', 339000)
    );
});

test('a set is cheaper while one of its pieces is on sale', function () {
    $set = bsitSaleSet();
    Product::query()->whereKey($set->polo_product_id)->update(['status' => ProductStatus::OnSale, 'sale_price_centavos' => 40000]);
    $this->actingAs($this->student)->post(route('cart.store-set', $set), boysSet($set));

    $this->get(route('cart.index'))->assertInertia(fn (Assert $page) => $page
        ->where('lines.0.set.price_centavos', 98000)
        ->where('total_centavos', 98000)
    );
});

test('a set can only have the sizes of its own pieces, for boys or girls', function (Closure $payload, string $field, string $message) {
    $set = bsitSaleSet();

    $this->actingAs($this->student)
        ->post(route('cart.store-set', $set), $payload($set))
        ->assertSessionHasErrors([$field => $message]);

    expect(CartItem::count())->toBe(0);
})->with([
    'nothing chosen' => [fn (UniformSet $set) => ['quantity' => '1'], 'for', 'Choose For Boys or For Girls.'],
    'a blouse size as the boys\' top' => [fn (UniformSet $set) => [...boysSet($set), 'top_variant_id' => pieceSize($set->blouse_product_id, 'M')->id], 'top_variant_id', 'Choose one of the sizes shown for the top.'],
    'boys\' pants for girls' => [fn (UniformSet $set) => ['for' => 'girls', 'top_variant_id' => pieceSize($set->blouse_product_id, 'M')->id, 'bottom_variant_id' => pieceSize($set->pants_product_id, 'S')->id, 'quantity' => '1'], 'bottom_variant_id', 'Choose one of the bottoms shown and its size.'],
    'a sold-out size' => [fn (UniformSet $set) => boysSet($set, top: 'L'), 'quantity', 'BSIT Polo (L) is out of stock.'],
    'more than are left' => [fn (UniformSet $set) => boysSet($set, quantity: '6'), 'quantity', 'You can have at most 5 pcs of BSIT Polo (M) in your cart (only 5 pcs left).'],
    'none' => [fn (UniformSet $set) => boysSet($set, quantity: '0'), 'quantity', 'The quantity must be at least 1.'],
]);

test('a set not sold as a set cannot be bought', function () {
    $set = bsitSaleSet(['sold_as_set' => false]);

    $this->actingAs($this->student)
        ->post(route('cart.store-set', $set), boysSet($set))
        ->assertSessionHasErrors(['for' => 'The BSIT Uniform Set is not sold for boys.']);
});

test('changing, ticking and removing a set does both its lines', function () {
    $set = bsitSaleSet();
    $this->actingAs($this->student)->post(route('cart.store-set', $set), boysSet($set));
    [$top, $bottom] = CartItem::query()->orderBy('id')->get();

    $this->patch(route('cart.update', $bottom), ['quantity' => '3'])->assertSessionHasNoErrors();
    expect(CartItem::query()->pluck('quantity')->all())->toBe([3, 3]);

    $this->patch(route('cart.update', $top), ['quantity' => '6'])->assertSessionHasErrors('quantity');
    expect(CartItem::query()->pluck('quantity')->all())->toBe([3, 3]);

    $this->patch(route('cart.select'), ['cart_item_ids' => [$top->id], 'selected' => '0']);
    expect(CartItem::query()->pluck('selected')->all())->toBe([false, false]);

    $this->delete(route('cart.destroy', $top));
    expect(CartItem::count())->toBe(0);
});

test('placing the order keeps both pieces at their own price with the set name, and holds their stock', function () {
    $set = bsitSaleSet();
    $this->actingAs($this->student)->post(route('cart.store-set', $set), [
        'for' => 'girls',
        'top_variant_id' => pieceSize($set->blouse_product_id, 'S')->id,
        'bottom_variant_id' => pieceSize($set->ladies_pants_product_id, 'M')->id,
        'quantity' => '2',
    ]);

    $this->post(route('my-orders.store'), ['section' => 'BSIT 1-A'])->assertSessionHasNoErrors();

    $order = Order::sole();
    expect($order->total_centavos)->toBe(226000)
        ->and($order->items)->toHaveCount(2)
        ->and($order->items->pluck('set_name')->unique()->all())->toBe(['BSIT Uniform Set (For Girls)'])
        ->and($order->items->map(fn (OrderItem $item): array => [$item->product_name, $item->quantity, $item->line_total_centavos, $item->normal_unit_price_centavos])->all())->toBe([
            ['BSIT Blouse', 2, 110000, 55000],
            ["BSIT Ladies' Pants", 2, 116000, 58000],
        ])
        ->and(pieceSize($set->blouse_product_id, 'S')->held_pieces)->toBe(2)
        ->and(pieceSize($set->ladies_pants_product_id, 'M')->held_pieces)->toBe(2)
        ->and(CartItem::count())->toBe(0)
        ->and(IssuanceSlip::of($order)['items'][0]['item'])->toBe('BSIT Blouse (S) · BSIT Uniform Set (For Girls)');
});

test('sales reports show a released set\'s pieces at their own price, not as a sale', function () {
    $set = bsitSaleSet();
    $specialist = User::factory()->specialist()->create();
    $this->actingAs($this->student)->post(route('cart.store-set', $set), boysSet($set));
    $this->post(route('my-orders.store'));
    $order = Order::sole();

    $this->actingAs($specialist)->post(route('orders.ready', $order));
    $this->post(route('orders.release', $order), ['paid' => '1'])->assertSessionHasNoErrors();

    $this->get(route('sales-reports.index', ['tab' => 'sold']))->assertInertia(fn (Assert $page) => $page
        ->has('sold.data', 2)
        ->where('sold.data.0.normal_each_centavos', null)
        ->where('sold.data.1.normal_each_centavos', null)
        ->where('summary.price_centavos', 113000)
    );
});

test('the Specialist chooses which bottoms girls get and whether the set is sold', function () {
    $set = bsitSaleSet(['ladies_pants_product_id' => null, 'skirt_product_id' => null, 'sold_as_set' => false]);
    $skirt = uniformPiece('BSIT Skirt 2', 520);

    $this->actingAs(User::factory()->specialist()->create())
        ->put(route('uniform-sets.update', $set), [
            'name' => 'BSIT',
            'blouse_product_id' => $set->blouse_product_id,
            'polo_product_id' => $set->polo_product_id,
            'pants_product_id' => $set->pants_product_id,
            'ladies_pants_product_id' => '',
            'skirt_product_id' => $skirt->id,
            'sold_as_set' => '1',
        ])
        ->assertSessionHasNoErrors();

    expect($set->refresh())->skirt_product_id->toBe($skirt->id)->sold_as_set->toBeTrue();
});

test('a set sold in the store needs something to sell', function () {
    $set = bsitSaleSet();

    $this->actingAs(User::factory()->specialist()->create())
        ->put(route('uniform-sets.update', $set), [
            'name' => 'BSIT',
            'blouse_product_id' => $set->blouse_product_id,
            'polo_product_id' => '',
            'pants_product_id' => $set->pants_product_id,
            'sold_as_set' => '1',
        ])
        ->assertSessionHasErrors(['sold_as_set' => "To sell the set, choose the polo (for boys), or the blouse with the ladies' pants or the skirt (for girls)."]);
});

test('the phone app shows the sets and adds one to the cart', function () {
    $set = bsitSaleSet();
    Sanctum::actingAs($this->student);

    $this->getJson(route('api.v1.storefront.home'))
        ->assertOk()
        ->assertJsonPath('uniform_sets.0.name', 'BSIT Uniform Set');

    $this->postJson(route('api.v1.cart.store-set', $set), boysSet($set))
        ->assertCreated()
        ->assertJsonPath('cart.selected_count', 1)
        ->assertJsonPath('cart.lines.0.set.name', 'BSIT Uniform Set');
});

test('only students can buy a set', function () {
    $set = bsitSaleSet();

    $this->post(route('cart.store-set', $set), boysSet($set))->assertRedirect(route('login'));
    $this->actingAs(User::factory()->specialist()->create())->post(route('cart.store-set', $set), boysSet($set))->assertForbidden();

    expect(CartItem::count())->toBe(0);
});
