<?php

use App\Models\Product;
use App\Models\ProductPack;
use App\Models\ProductVariant;
use App\Models\PurchaseOrder;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

beforeEach(function () {
    $this->specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
});

/**
 * STI Umbrella in Black, Red and Navy Blue. With $code, every color shares
 * it (sent by the piece, or by $pack).
 *
 * @return Collection<int, ProductVariant> the colors, in order
 */
function umbrellaColors(?string $code = 'PRUM01-01', ?ProductPack $pack = null): Collection
{
    $product = $pack?->product ?? Product::factory()->create(['name' => 'STI Umbrella']);

    foreach (['Black', 'Red', 'Navy Blue'] as $position => $color) {
        ProductVariant::factory()->for($product)->create([
            'combination' => "Color: {$color}",
            'choices' => [['option' => 'Color', 'choice' => $color]],
            'estore_item_code' => $code,
            'estore_pack_id' => $pack?->id,
            'position' => $position,
        ]);
    }

    return $product->variants()->get();
}

/**
 * A delivery form: what each order receives, and the pieces counted per color.
 *
 * @param  array<int, int>  $received  quantity by ordered item id
 * @param  array<int, int|string>  $counts  pieces by variant id
 * @return array<string, mixed>
 */
function splitDelivery(array $received, array $counts, string $code = 'PRUM01-01'): array
{
    return [
        'received_on' => now()->toDateString(),
        'items' => array_map(fn (int $id, int $quantity): array => ['purchase_order_item_id' => $id, 'quantity_received' => $quantity], array_keys($received), $received),
        'splits' => [[
            'item_code' => $code,
            'pieces' => array_map(fn (int $id, int|string $pieces): array => ['product_variant_id' => $id, 'pieces' => $pieces], array_keys($counts), $counts),
        ]],
    ];
}

test('a delivery of a code every color shares goes into each color as counted', function () {
    [$black, $red, $navy] = umbrellaColors()->all();
    $older = orderWith(['PRUM01-01' => 10], ['date_ordered' => '2026-09-20']);
    $newer = orderWith(['PRUM01-01' => 10], ['date_ordered' => '2026-09-28']);
    $this->actingAs($this->specialist);

    $this->getJson(route('purchase-orders.waiting-items', $older))
        ->assertJsonPath('groups.0.stock_target.variant_label', 'split by Color when received')
        ->assertJsonPath('groups.0.stock_target.split_into', [
            ['id' => $black->id, 'label' => 'Black', 'stock_on_hand' => 0],
            ['id' => $red->id, 'label' => 'Red', 'stock_on_hand' => 0],
            ['id' => $navy->id, 'label' => 'Navy Blue', 'stock_on_hand' => 0],
        ]);

    $this->post(route('deliveries.store'), splitDelivery(
        [itemOf($older, 'PRUM01-01') => 10, itemOf($newer, 'PRUM01-01') => 2],
        [$black->id => 5, $red->id => 7, $navy->id => ''],
    ))
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.message', 'The delivery has been recorded. Added to stock: STI Umbrella (Black) — 5 pcs; STI Umbrella (Red) — 7 pcs.');

    expect([$black->refresh()->stock_on_hand, $red->refresh()->stock_on_hand, $navy->refresh()->stock_on_hand])->toBe([5, 7, 0])
        ->and(StockMovement::query()->orderBy('id')->get()->map->only(['product_variant_id', 'quantity'])->all())->toBe([
            ['product_variant_id' => $black->id, 'quantity' => 5],
            ['product_variant_id' => $red->id, 'quantity' => 5],
            ['product_variant_id' => $red->id, 'quantity' => 2],
        ]);

    $this->getJson(route('purchase-orders.show', $older))
        ->assertJsonPath('deliveries.0.items.0.added_to_stock.*.product_name', ['STI Umbrella (Black)', 'STI Umbrella (Red)']);
});

test('the counts per color must add up to what is received', function (Closure $counts, string $message) {
    $colors = umbrellaColors();
    $order = orderWith(['PRUM01-01' => 10]);

    $this->actingAs($this->specialist)
        ->post(route('deliveries.store'), splitDelivery([itemOf($order, 'PRUM01-01') => 10], $counts($colors)))
        ->assertSessionHasErrors(['splits.0' => $message]);

    expect(StockMovement::count())->toBe(0)
        ->and($order->items()->sole()->quantity_delivered)->toBe(0);
})->with([
    'not counted' => [fn (Collection $colors) => [], 'PRUM01-01 is shared by several variants. Enter how many of each arrived.'],
    'too few' => [fn (Collection $colors) => [$colors[0]->id => 4, $colors[1]->id => 4], 'Your counts add up to 8 pcs, but the orders below receive 10 pcs. Make them match.'],
    'another product\'s variant' => [fn (Collection $colors) => [ProductVariant::factory()->create()->id => 10], 'The choices for PRUM01-01 changed. Reload the page and count again.'],
]);

test('a shared code sent by the pack is counted in pieces that make whole packs', function () {
    $product = Product::factory()->create(['name' => 'STI Umbrella']);
    $pack = ProductPack::factory()->for($product)->create(['name' => 'Box', 'pieces' => 10]);
    [$black, $red] = umbrellaColors(pack: $pack)->all();
    $order = orderWith(['PRUM01-01' => 5]);
    $this->actingAs($this->specialist);

    $this->post(route('deliveries.store'), splitDelivery([itemOf($order, 'PRUM01-01') => 2], [$black->id => 13, $red->id => 5]))
        ->assertSessionHasErrors(['splits.0' => 'Your counts add up to 18 pcs, but Head Office sends this by the Box of 10 pcs, so the total must be a multiple of 10.']);

    $this->post(route('deliveries.store'), splitDelivery([itemOf($order, 'PRUM01-01') => 2], [$black->id => 15, $red->id => 5]))
        ->assertSessionHasNoErrors();

    expect([$black->refresh()->stock_on_hand, $red->refresh()->stock_on_hand])->toBe([15, 5]);
});

test('a code is linked to one color only, and what already arrived goes into that color', function () {
    $colors = umbrellaColors(code: null);
    [$black, $red, $navy] = $colors->all();
    $order = orderWith(['PRUM01-01' => 20]);
    $this->actingAs($this->specialist)
        ->post(route('deliveries.store'), [
            'received_on' => now()->toDateString(),
            'items' => [['purchase_order_item_id' => itemOf($order, 'PRUM01-01'), 'quantity_received' => 12]],
        ])
        ->assertSessionHasNoErrors();
    $link = fn (array $ids) => $this->post(route('item-links.store'), [
        'item_code' => 'PRUM01-01',
        'product_variant_ids' => $ids,
        'sent_by' => 'piece',
    ]);

    $link([$navy->id, $black->id, $red->id])
        ->assertSessionHasErrors(['product_variant_ids' => 'Choose one option only. Each option has its own Item Code.']);

    $link([$black->id])
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.message', 'PRUM01-01 is now linked to STI Umbrella (Black). 12 pieces were added to stock.');

    expect($colors->fresh()->pluck('estore_item_code')->all())->toBe(['PRUM01-01', null, null])
        ->and($colors->fresh()->pluck('stock_on_hand')->all())->toBe([12, 0, 0]);
});

test('an option that already has its own code cannot be linked to another', function () {
    [$black, $red, $navy] = umbrellaColors(code: null)->all();
    $red->update(['estore_item_code' => 'PRUM01-02']);
    orderWith(['PRUM01-01' => 5]);
    $this->actingAs($this->specialist);

    $this->post(route('item-links.store'), ['item_code' => 'PRUM01-01', 'product_variant_ids' => [$red->id], 'sent_by' => 'piece'])
        ->assertSessionHasErrors(['product_variant_ids' => 'This variant already has the Item Code PRUM01-02. Choose another variant.']);

    expect([$black->refresh()->estore_item_code, $red->refresh()->estore_item_code, $navy->refresh()->estore_item_code])
        ->toBe([null, 'PRUM01-02', null]);
});
test('a code one product\'s colors share still cannot go on another product', function () {
    umbrellaColors();
    $order = PurchaseOrder::factory()->create();

    $this->actingAs($this->specialist)
        ->post(route('products.store'), [
            'name' => 'STI Raincoat', 'sold_by_piece' => '1', 'price' => '300', 'status' => 'draft', 'sale_price' => '',
            'low_stock_alert_at' => '5', 'photos' => [], 'packs' => [], 'options' => [],
            'variants' => [['combination' => '', 'estore_item_code' => 'PRUM01-01', 'estore_pack_key' => '', 'price' => '']],
        ])
        ->assertSessionHasErrors(['variants.0.estore_item_code' => 'The Item Code PRUM01-01 already belongs to "STI Umbrella".']);

    expect($order->exists)->toBeTrue();
});
