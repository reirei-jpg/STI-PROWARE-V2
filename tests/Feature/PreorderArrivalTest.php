<?php

use App\Enums\LowerPriceReason;
use App\Enums\OrderStatus;
use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\Order;
use App\Models\Preorder;
use App\Models\PreorderSlip;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Notifications\OrderReleased;
use App\Notifications\PreorderArrived;
use App\Notifications\PreorderReady;
use App\Services\Stock\RestockedPreorders;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-11-20 09:00', 'Asia/Manila'));
    $this->specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
    $this->product = Product::factory()->create([
        'name' => 'STI Hoodie',
        'price_centavos' => 75000,
        'status' => ProductStatus::Preorder,
        'preorders_close_on' => '2026-11-05',
        'early_bird_price_centavos' => 65000,
        'early_bird_pieces' => 2,
    ]);
    $this->variant = ProductVariant::factory()->for($this->product)->create(['combination' => 'Size: M', 'choices' => [['option' => 'Size', 'choice' => 'M']], 'price_centavos' => null]);
    // Preordered in this order: 3 (paid, with the 2 early-bird pieces), 4 (paid) and 2 (not paid).
    $this->first = markPreorderPaid(arrivingPreorder($this->variant, 3, '2026-11-01 08:00', 2));
    $this->second = markPreorderPaid(arrivingPreorder($this->variant, 4, '2026-11-02 08:00'));
    $this->third = arrivingPreorder($this->variant, 2, '2026-11-03 08:00');
});

function arrivingPreorder(ProductVariant $variant, int $quantity, string $at, int $earlyBird = 0): Preorder
{
    return Preorder::factory()->forVariant($variant)->create([
        'quantity' => $quantity,
        'price_centavos' => 75000,
        'early_bird_pieces' => $earlyBird,
        'created_at' => CarbonImmutable::parse($at, 'Asia/Manila'),
    ]);
}

/**
 * Pieces arrive for the Hoodie (as a delivery or recount would add them).
 */
function hoodiesComeIn(ProductVariant $variant, int $pieces): void
{
    $variant->forceFill(['stock_on_hand' => $variant->stock_on_hand + $pieces])->save();
    app(RestockedPreorders::class)->check($variant);
}

function slipOf(Preorder $preorder): PreorderSlip
{
    return PreorderSlip::forBatch($preorder);
}

test('arriving pieces are set aside for paid preorders, first come, first served, with no time limit', function () {
    hoodiesComeIn($this->variant, 5);

    expect($this->product->refresh()->status)->toBe(ProductStatus::Available)
        ->and($this->first->refresh())->status->toBe(PreorderStatus::Held)->quantity->toBe(3)->held_until->toBeNull()
        ->and($this->second->refresh())->status->toBe(PreorderStatus::Held)->quantity->toBe(2)
        ->and($this->third->refresh()->status)->toBe(PreorderStatus::Active)
        ->and($this->variant->refresh())->preorder_held_pieces->toBe(5)->freeToSell()->toBe(0);

    // The 2 of the second preorder that did not arrive keep its place in line, on the same slip.
    $rest = Preorder::query()->where('user_id', $this->second->user_id)->where('status', PreorderStatus::Active)->sole();
    expect($rest->quantity)->toBe(2)->and($rest->batch)->toBe($this->second->batch);

    $number = slipOf($this->first)->number;
    Notification::assertSentTo($this->first->student, PreorderReady::class, fn (PreorderReady $notice) => $notice->toPush($this->first->student) === [
        'title' => 'Your preorder is ready to pick up: STI Hoodie (M)',
        'body' => "3 pcs are set aside for you. Show preorder slip {$number} at the PROWARE office to get them.",
        'data' => ['kind' => 'preorder_ready', 'slip_id' => slipOf($this->first)->id],
    ]);
    Notification::assertSentTo($this->second->student, PreorderReady::class, fn (PreorderReady $notice) => $notice->pieces === 2);
    Notification::assertNotSentTo($this->third->student, PreorderReady::class);
    Notification::assertNotSentTo($this->third->student, PreorderArrived::class);

    // Nothing ends by itself any more.
    $this->travel(3)->days();
    $this->artisan('preorders:end-holds');
    expect($this->first->refresh()->status)->toBe(PreorderStatus::Held);
});

test('pieces left after the paid preorders go to anyone; buyers who did not pay are only told it is back', function () {
    hoodiesComeIn($this->variant, 12);

    expect($this->variant->refresh())->preorder_held_pieces->toBe(7)->freeToSell()->toBe(5)
        ->and($this->third->refresh())->status->toBe(PreorderStatus::Arrived);
    Notification::assertSentTo($this->third->student, PreorderArrived::class);
    Notification::assertNotSentTo($this->third->student, PreorderReady::class);
});

test('the Specialist scans the slip and releases the set-aside pieces at the price that was paid', function () {
    hoodiesComeIn($this->variant, 9);
    $slip = slipOf($this->first);
    $this->actingAs($this->specialist);

    $this->get(route('orders.slip', ['code' => $slip->code]))->assertInertia(fn (Assert $page) => $page
        ->where('preorderResult.can_release', true)
        ->where('preorderResult.ready', [['item' => 'STI Hoodie (M)', 'pieces' => 3]]));

    $released = $this->post(route('preorder-slips.release', $slip))->assertInertiaFlash('toast.type', 'success');

    $order = Order::query()->sole();
    $released->assertInertiaFlash('toast.message', "Preorder {$slip->number} has been released to {$order->student->name} as order {$order->number}: 3 pcs, already paid ₱2,050.00.");
    expect($order->status)->toBe(OrderStatus::PickedUp)
        ->and($order->total_centavos)->toBe(205000)
        ->and($order->items->map(fn ($item) => [$item->quantity, $item->unit_price_centavos, $item->normal_unit_price_centavos, $item->lower_price_reason])->all())
        ->toBe([[2, 65000, 75000, LowerPriceReason::EarlyBird], [1, 75000, 75000, null]])
        ->and($this->first->refresh())->status->toBe(PreorderStatus::Ordered)->order_id->toBe($order->id)
        ->and($this->variant->refresh())->stock_on_hand->toBe(6)->held_pieces->toBe(0)->preorder_held_pieces->toBe(4);
    Notification::assertSentTo($this->first->student, OrderReleased::class);

    // Sales Reports calls the early-bird pieces Early-bird price.
    $this->get(route('sales-reports.index', ['period' => 'today']))->assertInertia(fn (Assert $page) => $page
        ->where('sold.data.0.price_each_centavos', 65000)
        ->where('sold.data.0.lower_price_label', 'Early-bird price')
        ->where('sold.data.1.price_each_centavos', 75000));
});

test('release is refused while unpaid, before anything arrived, and once all is released', function () {
    $this->actingAs($this->specialist);

    $this->post(route('preorder-slips.release', slipOf($this->third)))
        ->assertInertiaFlash('toast.message', 'Preorder slip '.slipOf($this->third)->number.' is not paid yet, so nothing can be released. Mark it as paid once the buyer has paid at the cashier.');
    $this->post(route('preorder-slips.release', slipOf($this->first)))
        ->assertInertiaFlash('toast.message', 'Nothing of preorder '.slipOf($this->first)->number.' has arrived yet. Its pieces are set aside when they come in, and the buyer is told.');

    hoodiesComeIn($this->variant, 3);
    $this->post(route('preorder-slips.release', slipOf($this->first)))->assertInertiaFlash('toast.type', 'success');
    $this->post(route('preorder-slips.release', slipOf($this->first)))
        ->assertInertiaFlash('toast.message', 'Preorder '.slipOf($this->first)->number.' has already been released in full.');

    expect(Order::count())->toBe(1);
});

test('a part that arrived is released, and the rest later on the same slip', function () {
    hoodiesComeIn($this->variant, 5);
    $slip = slipOf($this->second);
    $this->actingAs($this->specialist)->post(route('preorder-slips.release', $slip));

    hoodiesComeIn($this->variant, 2);
    $this->post(route('preorder-slips.release', $slip))->assertInertiaFlash('toast.type', 'success');

    expect(Order::query()->where('user_id', $this->second->user_id)->get()->map(fn (Order $order) => (int) $order->items()->sum('quantity'))->all())->toBe([2, 2])
        ->and(Preorder::query()->where('batch', $this->second->batch)->pluck('status')->unique()->all())->toBe([PreorderStatus::Ordered]);
});

test('a buyer cannot cancel or give up paid pieces that are set aside', function () {
    hoodiesComeIn($this->variant, 3);

    $this->actingAs($this->first->student)
        ->delete(route('my-preorders.destroy', $this->first))
        ->assertInertiaFlash('toast.message', 'You already paid for your preorder of STI Hoodie, so it can no longer be cancelled. There is no refund.');

    expect($this->first->refresh()->status)->toBe(PreorderStatus::Held);
    $this->get(route('my-preorders.index'))->assertInertia(fn (Assert $page) => $page
        ->where('preorders.data.0.status', 'held')
        ->where('preorders.data.0.slip_paid', true)
        ->where('preorders.data.0.can_cancel', false));
});

test('a stock correction cannot take out pieces set aside for paid preorders', function () {
    hoodiesComeIn($this->variant, 3);

    $this->actingAs($this->specialist)->post(route('products.stock.correct', $this->product), [
        'product_variant_id' => $this->variant->id,
        'reason' => 'damaged',
        'pieces_to_remove' => '1',
    ])->assertSessionHasErrors(['pieces_to_remove' => '3 pcs are held for orders and arrived preorders, so the shelf cannot have fewer. Cancel those first, or count again.']);

    expect($this->variant->refresh())->stock_on_hand->toBe(3)->freeToSell()->toBe(0);
});

test('the phone releases a paid preorder too', function () {
    hoodiesComeIn($this->variant, 3);
    $slip = slipOf($this->first);
    Sanctum::actingAs($this->specialist);

    $this->getJson(route('api.v1.specialist.slips.show', $slip->code))->assertJsonPath('can_release', true);
    $this->postJson(route('api.v1.specialist.preorder-slips.release', $slip))
        ->assertOk()
        ->assertJsonPath('message', fn (string $message): bool => str_starts_with($message, "Preorder {$slip->number} has been released to"));
    $this->postJson(route('api.v1.specialist.preorder-slips.release', $slip))->assertUnprocessable();

    Sanctum::actingAs($this->first->student);
    $this->postJson(route('api.v1.specialist.preorder-slips.release', $slip))->assertForbidden();
});
