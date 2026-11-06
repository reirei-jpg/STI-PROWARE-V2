<?php

use App\Enums\OrderStatus;
use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\Order;
use App\Models\Preorder;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\Stock\RestockedPreorders;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Notification::fake();
    Storage::fake('public');
    Storage::fake('local');
    $this->travelTo(CarbonImmutable::parse('2026-11-20 09:00', 'Asia/Manila'));
    $this->specialist = User::factory()->specialist()->create();
    $this->student = User::factory()->student()->create();
});

/**
 * A product of one variant with stock, and the Edit Product form for it.
 *
 * @return array{0: Product, 1: ProductVariant}
 */
function productInStore(ProductStatus $status, int $stock): array
{
    $product = Product::factory()->create(['name' => 'STI Planner', 'price_centavos' => 18000, 'status' => $status]);
    $variant = ProductVariant::factory()->for($product)->create(['stock_on_hand' => $stock]);

    return [$product, $variant];
}

/**
 * @param  array<string, mixed>  $changes
 * @return array<string, mixed>
 */
function plannerForm(array $changes): array
{
    return array_merge([
        'name' => 'STI Planner', 'sold_by_piece' => '1', 'price' => '180', 'status' => 'available', 'low_stock_alert_at' => '3',
        'photos' => [['file' => UploadedFile::fake()->image('planner.jpg'), 'label' => 'Front']],
        'options' => [],
        'variants' => [['combination' => '', 'estore_item_code' => '', 'estore_pack_key' => '', 'price' => '']],
    ], $changes);
}

test('a sale stops at its end, even when the timed job has not run yet', function () {
    [$product, $variant] = productInStore(ProductStatus::OnSale, 5);
    $product->forceFill(['sale_price_centavos' => 15000, 'sale_ends_at' => now()->subMinute()])->save();

    $this->getJson("/api/v1/products/{$product->id}")
        ->assertOk()
        ->assertJsonPath('status', 'available')
        ->assertJsonPath('sale_ends_at', null)
        ->assertJsonPath('price.sale_centavos', null)
        ->assertJsonPath('variants.0.buy_price_centavos', 18000);

    expect(collect($this->getJson('/api/v1/storefront')->json('on_sale'))->pluck('id'))->not->toContain($product->id);

    $this->actingAs($this->student)
        ->post(route('cart.store', $product), ['product_variant_id' => $variant->id, 'quantity' => '1'])
        ->assertSessionHasNoErrors();

    $this->post(route('my-orders.store'))->assertSessionHasNoErrors();

    expect(Order::sole()->total_centavos)->toBe(18000);
});

test('a sale still running keeps its price', function () {
    [$product] = productInStore(ProductStatus::OnSale, 5);
    $product->forceFill(['sale_price_centavos' => 15000, 'sale_ends_at' => now()->addHour()])->save();

    $this->getJson("/api/v1/products/{$product->id}")
        ->assertJsonPath('status', 'on_sale')
        ->assertJsonPath('variants.0.buy_price_centavos', 15000);
});

test('pieces added to a preorder wait behind buyers who were already waiting', function () {
    $product = Product::factory()->create(['price_centavos' => 18000, 'status' => ProductStatus::Preorder, 'preorders_close_on' => '2026-11-25']);
    $variant = ProductVariant::factory()->for($product)->create(['stock_on_hand' => 0]);
    $other = User::factory()->student()->create();

    $this->actingAs($this->student)->post(route('my-preorders.store', $product), ['product_variant_id' => $variant->id, 'quantity' => '2']);
    $this->actingAs($other)->post(route('my-preorders.store', $product), ['product_variant_id' => $variant->id, 'quantity' => '1']);
    $this->actingAs($this->student)->post(route('my-preorders.store', $product), ['product_variant_id' => $variant->id, 'quantity' => '1']);

    $variant->forceFill(['stock_on_hand' => 3])->save();
    app(RestockedPreorders::class)->check($variant);

    expect(Preorder::query()->where('user_id', $this->student->id)->orderBy('id')->pluck('status')->all())
        ->toBe([PreorderStatus::Held, PreorderStatus::Active])
        ->and(Preorder::query()->where('user_id', $other->id)->sole()->status)->toBe(PreorderStatus::Held);
});

test('a product with stock cannot go to Draft or Preorder', function (string $status, string $message) {
    [$product] = productInStore(ProductStatus::Available, 12);

    $this->actingAs($this->specialist)
        ->put(route('products.update', $product), plannerForm(['status' => $status, 'preorders_close_on' => '2026-11-25', 'expected_arrival_from' => '2026-11-27', 'expected_arrival_to' => '2026-11-30']))
        ->assertSessionHasErrors(['status' => $message]);

    expect($product->refresh()->status)->toBe(ProductStatus::Available);
})->with([
    'Draft' => ['draft', 'STI Planner is in the store with 12 pcs in stock, so it cannot go back to Draft. Keep it Available, or correct its stock first.'],
    'Preorder' => ['preorder', 'STI Planner has 12 pcs in stock, so it cannot be a Preorder product. Set it to Available.'],
]);

test('a sold-out product can still go to Draft, and a Draft with stock can stay a Draft', function () {
    [$soldOut] = productInStore(ProductStatus::Available, 0);
    [$draft] = productInStore(ProductStatus::Draft, 12);
    $draft->update(['name' => 'STI Draft Planner']);
    $this->actingAs($this->specialist);

    $this->put(route('products.update', $soldOut), plannerForm(['status' => 'draft']))->assertSessionHasNoErrors();
    $this->put(route('products.update', $draft), plannerForm(['name' => 'STI Draft Planner', 'status' => 'draft']))->assertSessionHasNoErrors();

    expect($soldOut->refresh()->status)->toBe(ProductStatus::Draft)
        ->and($draft->refresh()->status)->toBe(ProductStatus::Draft);
});

test('a photo of up to 10 MB is accepted', function () {
    $this->actingAs($this->specialist)
        ->post(route('products.store'), plannerForm(['photos' => [['file' => UploadedFile::fake()->image('big.jpg')->size(10240), 'label' => 'Front']]]))
        ->assertSessionHasNoErrors();

    expect(Product::sole()->name)->toBe('STI Planner');
});

test('a wrong price or date gets one clear message', function () {
    [$product] = productInStore(ProductStatus::Preorder, 0);
    $product->forceFill(['preorders_close_on' => '2026-11-25', 'expected_arrival_from' => '2026-11-27', 'expected_arrival_to' => '2026-11-30'])->save();
    $this->actingAs($this->specialist);

    $this->post(route('products.store'), plannerForm(['price' => 'abc']))
        ->assertSessionHasErrors(['price' => 'Enter the Selling Price in pesos, e.g. 350 or 350.50.']);
    expect(session('errors')->get('price'))->toHaveCount(1);

    $this->patch(route('preorders.close-date', $product), ['preorders_close_on' => 'tomorrow'])
        ->assertSessionHasErrors(['preorders_close_on' => 'Choose a valid date.']);
    expect(session('errors')->get('preorders_close_on'))->toHaveCount(1);

    $this->post(route('products.store'), plannerForm(['name' => str_repeat('x', 121)]))
        ->assertSessionHasErrors(['name' => 'The product name may not be longer than 120 characters.']);
});

test('cancelling a preorder twice says it is already cancelled', function () {
    $product = Product::factory()->create(['status' => ProductStatus::Preorder, 'preorders_close_on' => '2026-11-25', 'name' => 'STI Planner']);
    $variant = ProductVariant::factory()->for($product)->create();
    $preorder = Preorder::factory()->forVariant($variant)->for($this->student, 'student')->create();
    $this->actingAs($this->student);

    $this->delete(route('my-preorders.destroy', $preorder))->assertSessionHasNoErrors();
    $this->delete(route('my-preorders.destroy', $preorder))
        ->assertInertiaFlash('toast.type', 'error')
        ->assertInertiaFlash('toast.message', 'Your preorder for STI Planner is already cancelled.');
});

test('a pause cannot be lifted from a student who is not paused', function () {
    $this->student->update(['name' => 'Kevin Abellana']);

    $this->actingAs($this->specialist)
        ->post(route('students.lift-pause', $this->student))
        ->assertInertiaFlash('toast.type', 'error')
        ->assertInertiaFlash('toast.message', 'Kevin Abellana is not paused, so there is nothing to lift.');

    expect($this->student->refresh()->ordering_resumed_at)->toBeNull();
    Notification::assertNothingSentTo($this->student);
});

test('the course or section accepts ordinary text only', function (string $section, bool $accepted) {
    $response = $this->actingAs($this->student)->post(route('my-orders.store'), ['section' => $section]);

    $accepted
        ? $response->assertSessionDoesntHaveErrors('section')
        : $response->assertSessionHasErrors(['section' => User::SECTION_MESSAGE]);
})->with([
    'a course' => ['BSIT 1-A', true],
    'an office' => ["Registrar's Office", true],
    'script text' => ['<img src=x onerror=alert(1)>', false],
    'a spreadsheet formula' => ['=HYPERLINK("x")', false],
]);

test('registering refuses script text as the course or section', function () {
    $this->post(route('register.store'), [
        'name' => 'Juan Dela Cruz', 'last_name' => 'Dela Cruz', 'student_id' => '02000123456', 'section' => '<b>x</b>',
        'email' => 'delacruz.123456@sti.edu.ph', 'password' => 'Demo@2026!', 'password_confirmation' => 'Demo@2026!', 'terms' => '1',
    ])->assertSessionHasErrors(['section' => User::SECTION_MESSAGE]);

    expect(User::query()->where('email', 'delacruz.123456@sti.edu.ph')->exists())->toBeFalse();
});

test('an eStore order dated in the future gets a warning', function () {
    $this->actingAs($this->specialist)
        ->post(route('purchase-orders.scan.store'), ['email_text' => str_replace('Sep 29, 2026', 'Dec 25, 2030', estoreOrderEmail())]);

    $this->get(route('purchase-orders.scan'))->assertInertia(fn (Assert $page) => $page
        ->where('scan.warnings.0.message', 'Date Ordered (Dec 25, 2030) is in the future. Check the eStore email.'));
});

test('My Preorders says what became of the order', function (OrderStatus $status) {
    $product = Product::factory()->create();
    $variant = ProductVariant::factory()->for($product)->create();
    $order = Order::factory()->for($this->student, 'student')->create(['status' => $status]);
    Preorder::factory()->forVariant($variant)->for($this->student, 'student')->create(['status' => PreorderStatus::Ordered, 'order_id' => $order->id]);

    $this->actingAs($this->student)->get(route('my-preorders.index'))->assertInertia(fn (Assert $page) => $page
        ->where('preorders.data.0.order_status', $status->value));
})->with([OrderStatus::Cancelled, OrderStatus::PickedUp]);
