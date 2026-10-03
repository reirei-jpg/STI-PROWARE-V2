<?php

use App\Enums\StockCorrectionReason;
use App\Enums\StockMovementType;
use App\Models\Product;
use App\Models\ProductPack;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
});

/**
 * A product without options whose only variant has this many pieces.
 */
function variantWithStock(int $pieces, string $productName = 'Chibi Keychain IT'): ProductVariant
{
    return ProductVariant::factory()
        ->for(Product::factory()->create(['name' => $productName]))
        ->create(['stock_on_hand' => $pieces]);
}

test('a recount sets the stock to the count on the shelf', function () {
    $variant = variantWithStock(450);

    $this->actingAs($this->specialist)
        ->post(route('products.stock.correct', $variant->product_id), [
            'product_variant_id' => $variant->id,
            'reason' => 'recount',
            'actual_count' => '45',
            'note' => '  Counted the shelf  ',
        ])
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.message', 'Stock of Chibi Keychain IT corrected: 450 → 45 pcs (−405 pcs). Reason: Recount.');

    expect($variant->refresh()->stock_on_hand)->toBe(45)
        ->and(StockMovement::sole())
        ->type->toBe(StockMovementType::Correction)
        ->quantity->toBe(-405)
        ->balance_after->toBe(45)
        ->reason->toBe(StockCorrectionReason::Recount)
        ->note->toBe('Counted the shelf')
        ->recorded_by->toBe($this->specialist->id);
});

test('a recount can also add pieces that were not counted before', function () {
    $variant = variantWithStock(5);

    $this->actingAs($this->specialist)
        ->post(route('products.stock.correct', $variant->product_id), [
            'product_variant_id' => $variant->id,
            'reason' => 'recount',
            'actual_count' => '8',
        ])
        ->assertInertiaFlash('toast.message', 'Stock of Chibi Keychain IT corrected: 5 → 8 pcs (+3 pcs). Reason: Recount.');

    expect($variant->refresh()->stock_on_hand)->toBe(8)
        ->and(StockMovement::sole()->quantity)->toBe(3);
});

test('damaged, lost or returned pieces are taken out of stock', function (string $reason, string $label) {
    $variant = variantWithStock(10);

    $this->actingAs($this->specialist)
        ->post(route('products.stock.correct', $variant->product_id), [
            'product_variant_id' => $variant->id,
            'reason' => $reason,
            'pieces_to_remove' => '3',
        ])
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.message', "Stock of Chibi Keychain IT corrected: 10 → 7 pcs (−3 pcs). Reason: {$label}.");

    expect($variant->refresh()->stock_on_hand)->toBe(7)
        ->and(StockMovement::sole())
        ->quantity->toBe(-3)
        ->balance_after->toBe(7)
        ->note->toBeNull();
})->with([
    'damaged' => ['damaged', 'Damaged'],
    'lost' => ['lost', 'Lost'],
    'returned to Head Office' => ['returned_to_head_office', 'Returned to Head Office'],
]);

test('the correct stock form explains what is wrong', function (array $payload, string $field, string $message) {
    $variant = variantWithStock(10);

    $this->actingAs($this->specialist)
        ->post(route('products.stock.correct', $variant->product_id), array_merge(['product_variant_id' => $variant->id], $payload))
        ->assertSessionHasErrors([$field => $message]);

    expect($variant->refresh()->stock_on_hand)->toBe(10)
        ->and(StockMovement::count())->toBe(0);
})->with([
    'no reason' => [['actual_count' => '5'], 'reason', 'Choose why the stock is being corrected.'],
    'damaged without how many' => [['reason' => 'damaged'], 'pieces_to_remove', 'Enter how many pieces to take out of stock.'],
    'taking out nothing' => [['reason' => 'damaged', 'pieces_to_remove' => '0'], 'pieces_to_remove', 'Take out at least 1 piece.'],
    'taking out more than in stock' => [['reason' => 'lost', 'pieces_to_remove' => '11'], 'pieces_to_remove', 'Only 10 pcs are in stock.'],
    'recount without a count' => [['reason' => 'recount'], 'actual_count', 'Enter how many pieces are actually on the shelf.'],
    'a count below zero' => [['reason' => 'recount', 'actual_count' => '-1'], 'actual_count', 'The count cannot be below 0.'],
    'the same count as now' => [['reason' => 'recount', 'actual_count' => '10'], 'actual_count', 'The stock is already 10 pcs, so nothing would change.'],
    'other without a note' => [['reason' => 'other', 'actual_count' => '4', 'note' => ' '], 'note', 'Write what happened, since the reason is Other.'],
]);

test('a variant of another product cannot be corrected from this product', function () {
    $variant = variantWithStock(10);
    $other = variantWithStock(20, 'Lanyard');

    $this->actingAs($this->specialist)
        ->post(route('products.stock.correct', $variant->product_id), [
            'product_variant_id' => $other->id,
            'reason' => 'recount',
            'actual_count' => '1',
        ])
        ->assertSessionHasErrors(['product_variant_id' => 'Choose one of this product\'s variants.']);

    expect($other->refresh()->stock_on_hand)->toBe(20);
});

test('the stock history lists every change, newest first, with how it happened', function () {
    $product = Product::factory()->create(['name' => 'Chibi Keychain IT']);
    $pack = ProductPack::factory()->for($product)->create(['name' => 'Pack', 'pieces' => 10]);
    $variant = ProductVariant::factory()->for($product)->create(['estore_item_code' => 'PRCU01-01', 'estore_pack_id' => $pack->id]);
    $order = orderWith(['PRCU01-01' => 50], ['order_number' => '30722']);
    $this->actingAs($this->specialist);

    $this->post(route('deliveries.store'), [
        'received_on' => now()->toDateString(),
        'sales_invoice_number' => '1210000031492',
        'items' => [['purchase_order_item_id' => itemOf($order, 'PRCU01-01'), 'quantity_received' => 45]],
    ]);
    $this->post(route('products.stock.correct', $product), [
        'product_variant_id' => $variant->id,
        'reason' => 'recount',
        'actual_count' => '45',
        'note' => 'Head Office sends these by the piece',
    ]);

    $this->get(route('products.stock', $product))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('products/stock')
            ->where('product.name', 'Chibi Keychain IT')
            ->where('product.stock_on_hand', 45)
            ->where('variants.0.sent_by', 'Pack (10 pcs)')
            ->has('movements.data', 2)
            ->where('movements.data.0.type', 'correction')
            ->where('movements.data.0.reason_label', 'Recount')
            ->where('movements.data.0.quantity', -405)
            ->where('movements.data.0.balance_after', 45)
            ->where('movements.data.0.note', 'Head Office sends these by the piece')
            ->where('movements.data.0.recorded_by', 'Carlo Mendoza')
            ->where('movements.data.1.type', 'delivery')
            ->where('movements.data.1.quantity', 450)
            ->where('movements.data.1.units_received', 45)
            ->where('movements.data.1.unit_name', 'Pack')
            ->where('movements.data.1.pieces_per_unit', 10)
            ->where('movements.data.1.delivery.order_number', '30722')
            ->where('movements.data.1.delivery.sales_invoice_number', '1210000031492')
        );
});

test('the stock history can show one variant only', function () {
    $product = Product::factory()->create();
    $small = ProductVariant::factory()->for($product)->create(['combination' => 'Size: S', 'choices' => [['option' => 'Size', 'choice' => 'S']]]);
    $medium = ProductVariant::factory()->for($product)->create(['combination' => 'Size: M', 'choices' => [['option' => 'Size', 'choice' => 'M']], 'position' => 1]);
    StockMovement::factory()->for($small, 'variant')->create();
    StockMovement::factory()->for($medium, 'variant')->create();
    StockMovement::factory()->create();

    $this->actingAs($this->specialist)
        ->get(route('products.stock', ['product' => $product, 'variant' => $medium->id]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('product.has_options', true)
            ->where('filters.variant', $medium->id)
            ->has('movements.data', 1)
            ->where('movements.data.0.variant_label', 'M')
        );

    $this->get(route('products.stock', $product))
        ->assertInertia(fn (Assert $page) => $page->has('movements.data', 2));
});

test('the school admin can see the stock history but cannot correct stock', function () {
    $variant = variantWithStock(10);
    $this->actingAs(User::factory()->schoolAdmin()->create());

    $this->get(route('products.stock', $variant->product_id))->assertOk();
    $this->post(route('products.stock.correct', $variant->product_id), [
        'product_variant_id' => $variant->id,
        'reason' => 'recount',
        'actual_count' => '1',
    ])->assertForbidden();

    expect($variant->refresh()->stock_on_hand)->toBe(10);
});
