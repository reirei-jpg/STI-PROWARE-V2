<?php

use App\Enums\LowerPriceReason;
use App\Enums\OrderStatus;
use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\Order;
use App\Models\Preorder;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Notifications\PreorderHeld;
use App\Notifications\PreorderHoldEnded;
use App\Services\Stock\RestockedPreorders;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-11-20 09:00', 'Asia/Manila'));
    $this->product = Product::factory()->create([
        'name' => 'STI Hoodie',
        'price_centavos' => 75000,
        'status' => ProductStatus::Preorder,
        'preorders_close_on' => '2026-11-05',
        'early_bird_price_centavos' => 65000,
        'early_bird_pieces' => 2,
    ]);
    $this->variant = ProductVariant::factory()->for($this->product)->create(['combination' => 'Size: M', 'choices' => [['option' => 'Size', 'choice' => 'M']]]);
    // Preordered in this order: 3, 4 and 2 pieces (the first got the 2 early-bird pieces).
    $this->first = waitingFor($this->variant, 3, '2026-11-01 08:00', 2);
    $this->second = waitingFor($this->variant, 4, '2026-11-02 08:00');
    $this->third = waitingFor($this->variant, 2, '2026-11-03 08:00');
});

function waitingFor(ProductVariant $variant, int $quantity, string $at, int $earlyBird = 0): Preorder
{
    return Preorder::factory()->forVariant($variant)->create([
        'quantity' => $quantity,
        'early_bird_pieces' => $earlyBird,
        'created_at' => CarbonImmutable::parse($at, 'Asia/Manila'),
    ]);
}

/**
 * Pieces arrive for the Hoodie (as a delivery or recount would add them).
 */
function hoodiesArrive(ProductVariant $variant, int $pieces): void
{
    $variant->forceFill(['stock_on_hand' => $variant->stock_on_hand + $pieces])->save();
    app(RestockedPreorders::class)->check($variant);
}

test('arriving pieces make the product Available and are held first come, first served', function () {
    hoodiesArrive($this->variant, 5);

    expect($this->product->refresh()->status)->toBe(ProductStatus::Available)
        ->and($this->first->refresh())->status->toBe(PreorderStatus::Held)->quantity->toBe(3)->held_until->toEqual(now()->addHours(24))
        ->and($this->second->refresh())->status->toBe(PreorderStatus::Held)->quantity->toBe(2)
        ->and($this->third->refresh()->status)->toBe(PreorderStatus::Active)
        ->and($this->variant->refresh())->preorder_held_pieces->toBe(5)->freeToSell()->toBe(0);

    // The 2 of the second preorder that did not arrive keep its place in line.
    $rest = Preorder::query()->where('user_id', $this->second->user_id)->where('status', PreorderStatus::Active)->sole();
    expect($rest->quantity)->toBe(2)->and($rest->created_at->equalTo($this->second->created_at))->toBeTrue();

    Notification::assertSentTo($this->first->student, PreorderHeld::class, fn (PreorderHeld $notice) => $notice->toPush($this->first->student)['body']
        === '3 pcs are held for you until Nov 21, 9:00 AM. Order them in My Preorders before then, or they go to the next student.');
    Notification::assertSentTo($this->second->student, PreorderHeld::class, fn (PreorderHeld $notice) => $notice->toPush($this->second->student)['body']
        === '2 of your 4 pcs have arrived and are held for you until Nov 21, 9:00 AM. Order them in My Preorders before then, or they go to the next student. You will be notified when the other 2 arrive.');
    Notification::assertNotSentTo($this->third->student, PreorderHeld::class);
});

test('pieces left after everyone waiting is served are free for anyone', function () {
    hoodiesArrive($this->variant, 12);

    expect($this->variant->refresh())->preorder_held_pieces->toBe(9)->freeToSell()->toBe(3);
});

test('Order Now orders the held pieces, charging the early-bird price for the early-bird pieces', function () {
    hoodiesArrive($this->variant, 9);

    $this->actingAs($this->first->student)
        ->post(route('my-preorders.order', $this->first), ['quantity' => '3', 'section' => 'BSIT 2-A'])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $order = Order::query()->sole();
    expect($order->total_centavos)->toBe(205000)
        ->and($order->items->map(fn ($item) => [$item->quantity, $item->unit_price_centavos, $item->normal_unit_price_centavos, $item->lower_price_reason])->all())
        ->toBe([[2, 65000, 75000, LowerPriceReason::EarlyBird], [1, 75000, 75000, null]])
        ->and($this->first->refresh())->status->toBe(PreorderStatus::Ordered)->order_id->toBe($order->id)
        ->and($this->variant->refresh())->held_pieces->toBe(3)->preorder_held_pieces->toBe(6);
});

test('Sales Reports calls early-bird pieces Early-bird price, not On sale', function () {
    hoodiesArrive($this->variant, 3);
    $this->actingAs($this->first->student)->post(route('my-preorders.order', $this->first), ['quantity' => '3']);
    Order::query()->sole()->forceFill(['status' => OrderStatus::PickedUp, 'picked_up_at' => now()])->save();

    $this->actingAs(User::factory()->specialist()->create())
        ->get(route('sales-reports.index', ['period' => 'today']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('sold.data.0.price_each_centavos', 65000)
            ->where('sold.data.0.normal_each_centavos', 75000)
            ->where('sold.data.0.lower_price_reason', 'early_bird')
            ->where('sold.data.0.lower_price_label', 'Early-bird price')
            ->where('sold.data.1.price_each_centavos', 75000)
            ->where('sold.data.1.lower_price_label', null));
});

test('held pieces the student does not order go to the next student at once', function () {
    hoodiesArrive($this->variant, 7);

    // The first orders 1 of 3; the 2 others go to the second's last 2 pieces.
    $this->actingAs($this->first->student)
        ->post(route('my-preorders.order', $this->first), ['quantity' => '1'])
        ->assertSessionHasNoErrors();

    // The second student's 2 held pieces and the 2 new ones are one hold.
    expect(Preorder::query()->where('user_id', $this->second->user_id)->where('status', PreorderStatus::Held)->sole())
        ->quantity->toBe(4)->held_until->toEqual(now()->addHours(24))
        ->and(Preorder::query()->where('user_id', $this->second->user_id)->where('status', PreorderStatus::Active)->exists())->toBeFalse()
        ->and($this->variant->refresh())->held_pieces->toBe(1)->preorder_held_pieces->toBe(6);
    Notification::assertSentTo($this->second->student, PreorderHeld::class, fn (PreorderHeld $notice) => $notice->preorder->quantity === 4 && $notice->preordered === 4);
});

test('a hold not ordered within 24 hours ends, and the pieces go to the next student', function () {
    hoodiesArrive($this->variant, 3);
    $this->travel(24)->hours();
    $this->travel(1)->minutes();

    $this->artisan('preorders:end-holds')->assertSuccessful();

    expect($this->first->refresh())->status->toBe(PreorderStatus::HoldEnded)->hold_ended_at->not->toBeNull()
        ->and($this->second->refresh())->status->toBe(PreorderStatus::Held)->quantity->toBe(3);
    Notification::assertSentTo($this->first->student, PreorderHoldEnded::class, fn (PreorderHoldEnded $notice) => $notice->toPush($this->first->student)['body']
        === 'The 3 pcs held for you were not ordered within 24 hours, so they went to the next student. Check the store if you still want it.');

    $this->actingAs($this->first->student)
        ->post(route('my-preorders.order', $this->first), ['quantity' => '1'])
        ->assertSessionHasErrors(['quantity' => 'The pieces are no longer held for you. Check the store to buy them.']);
});

test('a student can give up held pieces, for the next student', function () {
    hoodiesArrive($this->variant, 3);

    $this->actingAs($this->first->student)
        ->delete(route('my-preorders.destroy', $this->first))
        ->assertSessionHasNoErrors();

    expect($this->first->refresh()->status)->toBe(PreorderStatus::Cancelled)
        ->and($this->second->refresh())->status->toBe(PreorderStatus::Held)->quantity->toBe(3)
        ->and($this->variant->refresh()->preorder_held_pieces)->toBe(3);
});

/**
 * 5 Hoodies arrive: the first student's 3 are held, the second gets 2 of 4
 * held and their other 2 keep waiting, the third (2) still waits.
 *
 * @return array{0: Preorder, 1: Preorder} the second student's hold and the rest still waiting
 */
function secondStudentHalfServed(object $test): array
{
    hoodiesArrive($test->variant, 5);

    return [
        Preorder::query()->where('user_id', $test->second->user_id)->where('status', PreorderStatus::Held)->sole(),
        Preorder::query()->where('user_id', $test->second->user_id)->where('status', PreorderStatus::Active)->sole(),
    ];
}

test('giving up held pieces also closes the rest still waiting, so they go to the next student', function () {
    [$hold, $rest] = secondStudentHalfServed($this);

    $this->actingAs($this->second->student)
        ->delete(route('my-preorders.destroy', $hold))
        ->assertSessionHasNoErrors();

    expect($hold->refresh()->status)->toBe(PreorderStatus::Cancelled)
        ->and($rest->refresh()->status)->toBe(PreorderStatus::Cancelled)
        ->and(Preorder::query()->where('user_id', $this->second->user_id)->where('status', PreorderStatus::Held)->exists())->toBeFalse()
        ->and($this->third->refresh())->status->toBe(PreorderStatus::Held)->quantity->toBe(2)
        ->and($this->variant->refresh()->preorder_held_pieces)->toBe(5);
});

test('a hold that ends after 24 hours also closes the rest still waiting, and the student is told', function () {
    [$hold, $rest] = secondStudentHalfServed($this);
    $this->first->refresh()->forceFill(['held_until' => now()->addDays(2)])->save();
    $this->travel(24)->hours();
    $this->travel(1)->minutes();

    $this->artisan('preorders:end-holds')->assertSuccessful();

    expect($hold->refresh()->status)->toBe(PreorderStatus::HoldEnded)
        ->and($rest->refresh()->status)->toBe(PreorderStatus::HoldEnded)
        ->and($this->third->refresh())->status->toBe(PreorderStatus::Held)->quantity->toBe(2);
    Notification::assertSentTo($this->second->student, PreorderHoldEnded::class, fn (PreorderHoldEnded $notice) => $notice->toArray($this->second->student)['rest_closed'] === 2
        && $notice->toPush($this->second->student)['body'] === 'The 2 pcs held for you were not ordered within 24 hours, so they went to the next student. The other 2 pcs of this preorder will not be held for you either. Check the store if you still want it.');
});

test('ordering fewer than were held closes the rest still waiting', function () {
    [$hold, $rest] = secondStudentHalfServed($this);

    $this->actingAs($this->second->student)
        ->post(route('my-preorders.order', $hold), ['quantity' => '1'])
        ->assertSessionHasNoErrors();

    expect($rest->refresh()->status)->toBe(PreorderStatus::Cancelled)
        ->and($this->third->refresh())->status->toBe(PreorderStatus::Held)->quantity->toBe(1);

    // The first student orders all 3 held: nothing of theirs was waiting, and nothing changes for others.
    $this->actingAs($this->first->student)
        ->post(route('my-preorders.order', $this->first), ['quantity' => '3'])
        ->assertSessionHasNoErrors();
    expect(Preorder::query()->where('user_id', $this->third->user_id)->where('status', PreorderStatus::Active)->sole()->quantity)->toBe(1);
});

test('ordering all held pieces after a partial arrival keeps the rest waiting', function () {
    [$hold, $rest] = secondStudentHalfServed($this);

    $this->actingAs($this->second->student)
        ->post(route('my-preorders.order', $hold), ['quantity' => '2'])
        ->assertSessionHasNoErrors();

    expect($rest->refresh()->status)->toBe(PreorderStatus::Active);
});

test('the Specialist sees what became of each arrived preorder', function () {
    [$hold] = secondStudentHalfServed($this);
    $this->actingAs($this->first->student)->post(route('my-preorders.order', $this->first), ['quantity' => '3']);
    $this->actingAs($this->second->student)->delete(route('my-preorders.destroy', $hold));
    $this->travel(25)->hours();
    $this->artisan('preorders:end-holds');

    $this->actingAs(User::factory()->specialist()->create())
        ->get(route('preorders.index', ['details' => $this->product->id]))
        ->assertInertia(fn (Assert $page) => $page->reloadOnly('details', fn (Assert $reload) => $reload
            ->where('details.stage', 'arrived')
            ->where('details.preorders', fn ($rows) => collect($rows)->mapWithKeys(fn (array $row): array => [$row['student_name'] => [$row['status'], $row['order_number']]])->all() === [
                $this->third->student->name => ['hold_ended', null],
                $this->second->student->name => ['gave_up', null],
                $this->first->student->name => ['ordered', Order::query()->sole()->number],
            ])));
});

test('Order Now refuses more than is held, and other students', function () {
    hoodiesArrive($this->variant, 3);

    $this->actingAs($this->first->student)
        ->post(route('my-preorders.order', $this->first), ['quantity' => '4'])
        ->assertSessionHasErrors(['quantity' => 'Only 3 pcs are held for you.']);

    $this->actingAs($this->second->student)
        ->post(route('my-preorders.order', $this->first), ['quantity' => '1'])
        ->assertForbidden();

    expect(Order::count())->toBe(0);
});

test('the phone app can order held pieces', function () {
    hoodiesArrive($this->variant, 3);
    Sanctum::actingAs($this->first->student);

    $this->postJson(route('api.v1.preorders.order', $this->first), ['quantity' => 2])
        ->assertCreated()
        ->assertJsonPath('order.total_centavos', 130000);
});
