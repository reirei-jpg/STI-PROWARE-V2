<?php

use App\Enums\ProductStatus;
use App\Enums\StockMovementType;
use App\Models\Product;
use App\Models\ProductPack;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->specialist = User::factory()->specialist()->create();
    $this->travelTo(CarbonImmutable::parse('2026-10-03 10:00', 'Asia/Manila'));
});

/**
 * An Available product at ₱80 a piece with stock, received $daysAgo days ago.
 *
 * @param  array<string, mixed>  $attributes
 */
function saleProduct(array $attributes = [], int $stock = 30, int $daysAgo = 30, ?string $itemCode = 'PRLY01-01'): Product
{
    $product = Product::factory()->create(['name' => 'Lanyard', 'status' => ProductStatus::Available, 'price_centavos' => 8000, ...$attributes]);
    $variant = ProductVariant::factory()->for($product)->create(['estore_item_code' => $itemCode, 'stock_on_hand' => $stock]);
    StockMovement::factory()->for($variant, 'variant')->create(['created_at' => now()->subDays($daysAgo)]);

    return $product;
}

test('putting a product on sale lowers its price until the end of the last day', function () {
    $product = saleProduct();

    $this->actingAs($this->specialist)
        ->post(route('products.sale.store', $product), ['sale_price' => '50', 'days' => '7'])
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.message', 'Lanyard is On Sale until Oct 10, 2026 11:59 PM.');

    expect($product->refresh())
        ->status->toBe(ProductStatus::OnSale)
        ->sale_price_centavos->toBe(5000)
        ->price_centavos->toBe(8000)
        ->sale_ends_at->toDateTimeString()->toBe('2026-10-10 23:59:59')
        ->sale_started_at->not->toBeNull();
});

test('packs can get their own sale price, and packs left empty keep theirs', function () {
    $product = saleProduct();
    $box = ProductPack::factory()->for($product)->soldToStudents(90000)->create(['name' => 'Box', 'pieces' => 12]);
    $bundle = ProductPack::factory()->for($product)->soldToStudents(40000)->create(['name' => 'Bundle', 'pieces' => 5, 'position' => 1]);

    $this->actingAs($this->specialist)
        ->post(route('products.sale.store', $product), [
            'sale_price' => '50',
            'pack_sale_prices' => [$box->id => '700', $bundle->id => ''],
            'days' => '3',
        ])
        ->assertSessionHasNoErrors();

    expect($box->refresh()->sale_price_centavos)->toBe(70000)
        ->and($bundle->refresh()->sale_price_centavos)->toBeNull();
});

test('the put on sale form explains what is wrong', function (array $payload, string $field, string $message) {
    $product = saleProduct();
    ProductPack::factory()->for($product)->soldToStudents(90000)->create(['name' => 'Box', 'pieces' => 12]);

    $this->actingAs($this->specialist)
        ->post(route('products.sale.store', $product), array_merge(['sale_price' => '50', 'days' => '7'], $payload))
        ->assertSessionHasErrors([$field => $message]);

    expect($product->refresh()->status)->toBe(ProductStatus::Available);
})->with([
    'sale price not lower' => [['sale_price' => '80'], 'sale_price', 'The sale price must be lower than ₱80.00, the price per piece.'],
    'no sale price at all' => [['sale_price' => ''], 'sale_price', 'Enter a sale price for the piece or for a pack.'],
    'no days' => [['days' => ''], 'days', 'Enter how many days the sale lasts.'],
    'zero days' => [['days' => '0'], 'days', 'A sale lasts at least 1 day.'],
    'too many days' => [['days' => '91'], 'days', 'A sale lasts at most 90 days.'],
]);

test('a pack sale price must be lower than the pack price', function () {
    $product = saleProduct();
    $box = ProductPack::factory()->for($product)->soldToStudents(90000)->create(['name' => 'Box', 'pieces' => 12]);

    $this->actingAs($this->specialist)
        ->post(route('products.sale.store', $product), ['pack_sale_prices' => [$box->id => '900'], 'days' => '7'])
        ->assertSessionHasErrors(["pack_sale_prices.{$box->id}" => 'The sale price of the Box must be lower than ₱900.00.']);
});

test('only available products with stock can be put on sale', function (array $attributes, int $stock, string $message) {
    $product = saleProduct($attributes, $stock);

    $this->actingAs($this->specialist)
        ->post(route('products.sale.store', $product), ['sale_price' => '50', 'days' => '7'])
        ->assertSessionHasErrors(['days' => $message]);
})->with([
    'draft' => [['status' => ProductStatus::Draft], 30, 'Only Available products can be put on sale. Set it to Available first.'],
    'preorder' => [['status' => ProductStatus::Preorder], 30, 'Only Available products can be put on sale. Set it to Available first.'],
    'nothing in stock' => [[], 0, 'There is nothing in stock to put on sale.'],
]);

test('a sale price cannot go below the Cost, and the pop-up gets the Cost to show it', function () {
    $product = saleProduct();
    orderWith(['PRLY01-01' => 10])->items()->update(['unit_price_centavos' => 6000]);

    $this->actingAs($this->specialist)
        ->getJson(route('products.sale.show', $product))
        ->assertOk()
        ->assertJsonPath('piece_price_centavos', 8000)
        ->assertJsonPath('cost_per_piece_centavos', 6000)
        ->assertJsonPath('stock_on_hand', 30)
        ->assertJsonPath('sale', null);

    $this->post(route('products.sale.store', $product), ['sale_price' => '40', 'days' => '7'])
        ->assertSessionHasErrors(['sale_price' => 'The sale price cannot be below the Cost of ₱60.00 per piece (what PROWARE paid on the eStore order).']);
    expect($product->refresh()->status)->toBe(ProductStatus::Available);

    $this->post(route('products.sale.store', $product), ['sale_price' => '60', 'days' => '7'])
        ->assertSessionHasNoErrors();
    expect($product->refresh()->sale_price_centavos)->toBe(6000);
});

test('the head office cost of an item sent by the pack is per piece', function () {
    $product = saleProduct();
    $pack = ProductPack::factory()->for($product)->create(['name' => 'Pack', 'pieces' => 50]);
    $product->variants()->update(['estore_pack_id' => $pack->id]);
    orderWith(['PRLY01-01' => 2])->items()->update(['unit_price_centavos' => 100000]);

    $this->actingAs($this->specialist)
        ->getJson(route('products.sale.show', $product))
        ->assertJsonPath('cost_per_piece_centavos', 2000);
});

test('changing a sale keeps when it started and gives a new end', function () {
    $product = saleProduct();
    $this->actingAs($this->specialist);
    $this->post(route('products.sale.store', $product), ['sale_price' => '50', 'days' => '3']);
    $startedAt = $product->refresh()->sale_started_at;

    $this->travel(1)->days();
    $this->post(route('products.sale.store', $product), ['sale_price' => '45', 'days' => '10'])
        ->assertSessionHasNoErrors();

    expect($product->refresh())
        ->sale_price_centavos->toBe(4500)
        ->sale_started_at->toDateTimeString()->toBe($startedAt->toDateTimeString())
        ->sale_ends_at->toDateString()->toBe('2026-10-14');
});

test('ending a sale now brings back the normal price', function () {
    $product = saleProduct();
    $box = ProductPack::factory()->for($product)->soldToStudents(90000)->create(['name' => 'Box', 'pieces' => 12]);
    $this->actingAs($this->specialist);
    $this->post(route('products.sale.store', $product), ['sale_price' => '50', 'pack_sale_prices' => [$box->id => '700'], 'days' => '7']);

    $this->delete(route('products.sale.destroy', $product))
        ->assertInertiaFlash('toast.message', 'The sale of Lanyard ended. It is back to its normal price.');

    expect($product->refresh())
        ->status->toBe(ProductStatus::Available)
        ->sale_price_centavos->toBeNull()
        ->sale_ends_at->toBeNull()
        ->and($box->refresh()->sale_price_centavos)->toBeNull();
});

test('a sale ends by itself when its days are up, and the specialist is told', function () {
    $product = saleProduct();
    $schoolAdmin = User::factory()->schoolAdmin()->create();
    $this->actingAs($this->specialist)->post(route('products.sale.store', $product), ['sale_price' => '50', 'days' => '2']);

    $this->travelTo(CarbonImmutable::parse('2026-10-05 23:00', 'Asia/Manila'));
    $this->artisan('sales:check')->assertSuccessful();
    expect($product->refresh()->status)->toBe(ProductStatus::OnSale);

    $this->travelTo(CarbonImmutable::parse('2026-10-06 00:05', 'Asia/Manila'));
    $this->artisan('sales:check');

    expect($product->refresh())
        ->status->toBe(ProductStatus::Available)
        ->sale_price_centavos->toBeNull()
        ->and($this->specialist->notifications()->where('data->kind', 'sale_ended')->sole()->data)->toMatchArray([
            'product_name' => 'Lanyard',
            'normal_price' => '₱80.00 / pc',
        ])
        ->and($schoolAdmin->notifications()->count())->toBe(0);
});

test('the specialist is told the day before a sale ends, from 7 AM, once', function () {
    $product = saleProduct();
    $this->actingAs($this->specialist)->post(route('products.sale.store', $product), ['sale_price' => '50', 'days' => '3']);

    $this->travelTo(CarbonImmutable::parse('2026-10-05 06:30', 'Asia/Manila'));
    $this->artisan('sales:check');
    expect($this->specialist->notifications()->count())->toBe(0);

    $this->travelTo(CarbonImmutable::parse('2026-10-05 07:00', 'Asia/Manila'));
    $this->artisan('sales:check');
    $this->artisan('sales:check');

    expect($this->specialist->notifications()->sole()->data)->toMatchArray([
        'kind' => 'sale_ending',
        'product_name' => 'Lanyard',
    ]);
});

test('opening a sale notice shows the product on the products list', function () {
    $product = saleProduct();
    $this->actingAs($this->specialist)->post(route('products.sale.store', $product), ['sale_price' => '50', 'days' => '1']);
    $this->travelTo(CarbonImmutable::parse('2026-10-05 00:05', 'Asia/Manila'));
    $this->artisan('sales:check');
    $notice = $this->specialist->notifications()->sole();

    $this->post(route('notifications.open', $notice->id))
        ->assertRedirect(route('products.index', ['search' => 'Lanyard']));
});

test('the storefront lists the soonest-ending sale first and says when it ends', function () {
    $later = saleProduct(['name' => 'Tumbler'], itemCode: null);
    $sooner = saleProduct(['name' => 'Lanyard'], itemCode: null);
    $this->actingAs($this->specialist);
    $this->post(route('products.sale.store', $later), ['sale_price' => '50', 'days' => '9']);
    $this->post(route('products.sale.store', $sooner), ['sale_price' => '50', 'days' => '2']);

    $this->get('/')
        ->assertInertia(fn (Assert $page) => $page
            ->where('onSale.0.name', 'Lanyard')
            ->where('onSale.1.name', 'Tumbler')
            ->where('onSale.0.sale_ends_at', $sooner->refresh()->sale_ends_at->toIso8601String())
        );
});

test('slow-moving lists available products in stock that sold nothing for the chosen days', function () {
    saleProduct(['name' => 'Old Lanyard'], daysAgo: 20, itemCode: null);
    saleProduct(['name' => 'New Lanyard'], daysAgo: 5, itemCode: null);
    saleProduct(['name' => 'Empty Lanyard'], stock: 0, daysAgo: 30, itemCode: null);
    saleProduct(['name' => 'Draft Lanyard', 'status' => ProductStatus::Draft], daysAgo: 30, itemCode: null);
    $corrected = saleProduct(['name' => 'Corrected Lanyard'], daysAgo: 30, itemCode: null);
    StockMovement::factory()->for($corrected->variants()->sole(), 'variant')->create(['type' => StockMovementType::Correction, 'quantity' => -2]);

    $this->actingAs($this->specialist)
        ->get(route('products.index', ['stock' => 'slow']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('slowMovingCount', 2)
            ->where('filters.slow_days', 18)
            ->where('products.data', fn ($rows) => collect($rows)->pluck('name')->sort()->values()->all() === ['Corrected Lanyard', 'Old Lanyard'])
            ->where('products.data.0.last_sale_at', null)
        );

    $this->get(route('products.index', ['stock' => 'slow', 'slow_days' => 3]))
        ->assertInertia(fn (Assert $page) => $page->where('slowMovingCount', 3));
});

test('the school admin cannot put products on sale', function () {
    $product = saleProduct();
    $this->actingAs(User::factory()->schoolAdmin()->create());

    $this->getJson(route('products.sale.show', $product))->assertForbidden();
    $this->post(route('products.sale.store', $product), ['sale_price' => '50', 'days' => '7'])->assertForbidden();
    $this->delete(route('products.sale.destroy', $product))->assertForbidden();
});
