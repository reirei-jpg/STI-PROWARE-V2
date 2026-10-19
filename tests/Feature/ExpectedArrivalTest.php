<?php

use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\Preorder;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Notifications\PreorderArrivalChanged;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Storage::fake('public');
    $this->travelTo(CarbonImmutable::parse('2026-10-19 10:00', 'Asia/Manila'));
    $this->specialist = User::factory()->specialist()->create();
    $this->product = Product::factory()->create([
        'name' => 'STI Hoodie',
        'price_centavos' => 75000,
        'status' => ProductStatus::Preorder,
        'preorders_close_on' => '2026-11-05',
        'expected_arrival_from' => '2026-11-19',
        'expected_arrival_to' => '2026-11-26',
    ]);
    $this->variant = ProductVariant::factory()->for($this->product)->create();
    $this->product->photos()->create(['path' => 'products/hoodie.jpg', 'position' => 0]);
});

/**
 * The Edit Product form for the STI Hoodie as it is saved, changed by $overrides.
 *
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function hoodieForm(Product $product, array $overrides = []): array
{
    return array_merge([
        'name' => 'STI Hoodie', 'sold_by_piece' => '1', 'price' => '750', 'status' => 'preorder', 'sale_price' => '',
        'low_stock_alert_at' => '5', 'packs' => [], 'options' => [],
        'photos' => [['id' => $product->photos()->value('id'), 'label' => '']],
        'variants' => [['combination' => '', 'estore_item_code' => '', 'estore_pack_key' => '', 'price' => '']],
        'preorders_close_on' => '2026-11-05',
        'expected_arrival_from' => '2026-11-19',
        'expected_arrival_to' => '2026-11-26',
    ], $overrides);
}

test('a preorder product needs an expected arrival after its close date', function (array $overrides, string $field, string $message) {
    $this->actingAs($this->specialist)
        ->put(route('products.update', $this->product), hoodieForm($this->product, $overrides))
        ->assertSessionHasErrors([$field => $message]);
})->with([
    'no first day' => [['expected_arrival_from' => ''], 'expected_arrival_from', 'Choose the first day it is expected to arrive.'],
    'no last day' => [['expected_arrival_to' => ''], 'expected_arrival_to', 'Choose the last day it is expected to arrive.'],
    'last day first' => [['expected_arrival_to' => '2026-11-18'], 'expected_arrival_to', 'The last day cannot be before the first day.'],
    'on the close date' => [['expected_arrival_from' => '2026-11-05'], 'expected_arrival_from', 'The expected arrival must be after the close date (Nov 5, 2026).'],
]);

test('changing the expected arrival notifies the students waiting for it', function () {
    Notification::fake();
    $waiting = Preorder::factory()->forVariant($this->variant)->create();
    $cancelled = Preorder::factory()->forVariant($this->variant)->create(['status' => PreorderStatus::Cancelled]);

    $this->actingAs($this->specialist)
        ->put(route('products.update', $this->product), hoodieForm($this->product, ['expected_arrival_from' => '2026-11-26', 'expected_arrival_to' => '2026-12-03']))
        ->assertSessionHasNoErrors();

    expect($this->product->refresh()->expectedArrivalText())->toBe('Nov 26 – Dec 3, 2026');
    Notification::assertSentTo($waiting->student, PreorderArrivalChanged::class, fn (PreorderArrivalChanged $notice) => $notice->toPush($waiting->student)['body'] === 'Your preorder is now expected to arrive Nov 26 – Dec 3, 2026. It was expected Nov 19 – Nov 26, 2026.');
    Notification::assertNotSentTo($cancelled->student, PreorderArrivalChanged::class);
});

test('saving without changing the expected arrival notifies no one', function () {
    Notification::fake();
    Preorder::factory()->forVariant($this->variant)->create();

    $this->actingAs($this->specialist)
        ->put(route('products.update', $this->product), hoodieForm($this->product, ['price' => '780']))
        ->assertSessionHasNoErrors();

    Notification::assertNothingSent();
});

test('students see the expected arrival on the item and in My Preorders', function () {
    $student = User::factory()->student()->create();
    Preorder::factory()->forVariant($this->variant)->for($student, 'student')->create();

    $this->get(route('home'))
        ->assertInertia(fn (Assert $page) => $page->where('comingSoon.0.expected_arrival', 'Nov 19 – Nov 26, 2026'));

    $this->actingAs($student)
        ->get(route('my-preorders.index'))
        ->assertInertia(fn (Assert $page) => $page->where('preorders.data.0.expected_arrival', 'Nov 19 – Nov 26, 2026'));
});

test('preorders cannot be set to close on or after the expected arrival', function () {
    $this->actingAs($this->specialist)
        ->patch(route('preorders.close-date', $this->product), ['preorders_close_on' => '2026-11-19'])
        ->assertSessionHasErrors(['preorders_close_on' => 'The close date must be before the expected arrival (Nov 19 – Nov 26, 2026). Change the expected arrival in Edit Product first.']);

    $this->patch(route('preorders.close-date', $this->product), ['preorders_close_on' => '2026-11-10'])
        ->assertSessionHasNoErrors();
});
