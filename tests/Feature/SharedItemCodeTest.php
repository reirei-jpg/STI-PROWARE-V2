<?php

use App\Models\Product;
use App\Models\ProductPack;
use App\Models\ProductVariant;
use App\Models\PurchaseOrder;
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

test('a code is linked to one color only, and what already arrived goes into that color', function () {
    $colors = umbrellaColors(code: null);
    [$black, $red, $navy] = $colors->all();
    $order = orderWith(['PRUM01-01' => 20]);
    $this->actingAs($this->specialist)
        ->post(route('deliveries.store'), [...papers(),
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
