<?php

use App\Actions\Orders\CancelOrder;
use App\Enums\OrderStatus;
use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Preorder;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Notifications\PreorderArrived;
use App\Notifications\PreorderNotRestocked;
use App\Notifications\PreorderPlaced;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-18 10:00', 'Asia/Manila'));
    $this->student = User::factory()->student()->create(['name' => 'Juan Dela Cruz', 'email' => 'delacruz.123456@sti.edu.ph']);
    $this->specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
});

/**
 * A BSIT Polo for sale with sizes XS (sold out) and M (6 pieces).
 *
 * @return array{0: Product, 1: ProductVariant, 2: ProductVariant}
 */
function soldOutPolo(): array
{
    $product = Product::factory()->create(['name' => 'BSIT Polo', 'status' => ProductStatus::Available]);
    $extraSmall = ProductVariant::factory()->for($product)->create(['combination' => 'Size: XS', 'choices' => [['option' => 'Size', 'choice' => 'XS']], 'estore_item_code' => 'UTMP01-01', 'position' => 0]);
    $medium = ProductVariant::factory()->for($product)->create(['combination' => 'Size: M', 'choices' => [['option' => 'Size', 'choice' => 'M']], 'stock_on_hand' => 6, 'position' => 1]);

    return [$product, $extraSmall, $medium];
}

test('a student can preorder a sold-out size, and the Specialist is told once', function () {
    Notification::fake();
    [$product, $extraSmall] = soldOutPolo();
    $this->actingAs($this->student);

    $this->post(route('my-preorders.store', $product), ['product_variant_id' => $extraSmall->id, 'quantity' => '2'])
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.message', 'Your preorder of 2 × BSIT Polo (XS) has been placed. You will be notified when it is back in stock. It is listed in My Preorders.');

    // Changing how many is not a new preorder.
    $this->post(route('my-preorders.store', $product), ['product_variant_id' => $extraSmall->id, 'quantity' => '3']);

    expect(Preorder::sole())->quantity->toBe(3)->status->toBe(PreorderStatus::Active);
    Notification::assertSentToTimes($this->specialist, PreorderPlaced::class, 1);
    Notification::assertSentTo($this->specialist, PreorderPlaced::class, fn (PreorderPlaced $notice) => $notice->toPush($this->specialist)['title'] === 'New preorder: BSIT Polo (XS)'
        && $notice->toPush($this->specialist)['body'] === 'Juan Dela Cruz preordered 2 pieces. It is out of stock.');
});

test('a size that is in stock or will not be restocked cannot be preordered', function (Closure $size, string $message) {
    Notification::fake();
    [$product, $extraSmall, $medium] = soldOutPolo();
    $extraSmall->forceFill(['not_restocked_at' => now()])->save();

    $this->actingAs($this->student)
        ->post(route('my-preorders.store', $product), ['product_variant_id' => $size($extraSmall, $medium)->id, 'quantity' => '1'])
        ->assertSessionHasErrors(['product_variant_id' => $message]);

    expect(Preorder::count())->toBe(0);
    Notification::assertNothingSent();
})->with([
    'in stock' => [fn (ProductVariant $extraSmall, ProductVariant $medium) => $medium, 'BSIT Polo (M) is in stock. Add it to your cart instead.'],
    'not restocked' => [fn (ProductVariant $extraSmall, ProductVariant $medium) => $extraSmall, 'BSIT Polo (XS) will not be restocked, so it cannot be preordered.'],
]);

test('the storefront offers a preorder only for sold-out sizes that can still come back', function () {
    [$product, $extraSmall, $medium] = soldOutPolo();
    $large = ProductVariant::factory()->for($product)->create(['combination' => 'Size: L', 'choices' => [['option' => 'Size', 'choice' => 'L']], 'not_restocked_at' => now(), 'position' => 2]);

    $this->getJson(route('storefront.product', $product))
        ->assertOk()
        ->assertJsonPath('accepts_preorders', true)
        ->assertJsonPath('variants.0.can_preorder', true)
        ->assertJsonPath('variants.0.not_restocked', false)
        ->assertJsonPath('variants.1.can_preorder', false)
        ->assertJsonPath('variants.2.can_preorder', false)
        ->assertJsonPath('variants.2.not_restocked', true);

    $extraSmall->forceFill(['stock_on_hand' => 4])->save();

    $this->getJson(route('storefront.product', $product))->assertJsonPath('accepts_preorders', false);
});

test('students waiting for a size are notified when a delivery puts it back in stock', function () {
    Notification::fake();
    [$product, $extraSmall, $medium] = soldOutPolo();
    $waiting = Preorder::factory()->forVariant($extraSmall)->for($this->student, 'student')->create();
    $otherSize = Preorder::factory()->forVariant($medium)->create();
    $order = orderWith(['UTMP01-01' => 10]);

    $this->actingAs($this->specialist)
        ->post(route('deliveries.store'), [
            'received_on' => now()->toDateString(),
            'items' => [['purchase_order_item_id' => itemOf($order, 'UTMP01-01'), 'quantity_received' => 6]],
        ])
        ->assertSessionHasNoErrors();

    expect($waiting->refresh())->status->toBe(PreorderStatus::Arrived)->arrived_at->not->toBeNull()
        ->and($otherSize->refresh()->status)->toBe(PreorderStatus::Active);
    Notification::assertSentTo($this->student, PreorderArrived::class, fn (PreorderArrived $notice) => $notice->toArray($this->student)['variant_label'] === 'XS'
        && $notice->toPush($this->student)['title'] === 'Back in stock: BSIT Polo (XS)');
});

test('students waiting for a size are notified when a cancelled order gives the last piece back', function () {
    Notification::fake();
    [$product, $extraSmall] = soldOutPolo();
    $extraSmall->forceFill(['stock_on_hand' => 1, 'held_pieces' => 1])->save();
    $waiting = Preorder::factory()->forVariant($extraSmall)->for($this->student, 'student')->create();
    $order = Order::factory()->for(User::factory()->student()->create(), 'student')->create(['status' => OrderStatus::Placed]);
    OrderItem::factory()->for($order)->for($extraSmall, 'variant')->create(['quantity' => 1]);

    app(CancelOrder::class)->handle($order, $this->specialist, 'Test order for the restock check');

    expect($waiting->refresh()->status)->toBe(PreorderStatus::Arrived);
    Notification::assertSentTo($this->student, PreorderArrived::class);
});

test('the Specialist can mark a sold-out size as not restocked, closing every preorder waiting for it', function () {
    Notification::fake();
    [$product, $extraSmall, $medium] = soldOutPolo();
    $juan = Preorder::factory()->forVariant($extraSmall)->for($this->student, 'student')->create();
    $student2 = Preorder::factory()->forVariant($extraSmall)->for(User::factory()->student()->create(['name' => 'Student 2']), 'student')->create();
    $otherSize = Preorder::factory()->forVariant($medium)->create();

    $this->actingAs($this->specialist)
        ->post(route('preorders.not-restocked', $extraSmall), ['reason' => '  Head Office no longer makes this size.  '])
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.message', 'BSIT Polo (XS) has been marked as not restocked. 2 students have been notified and their preorders have been closed.');

    expect($extraSmall->refresh()->not_restocked_at)->not->toBeNull()
        ->and($juan->refresh())->status->toBe(PreorderStatus::NotRestocked)->not_restocked_reason->toBe('Head Office no longer makes this size.')
        ->and($student2->refresh()->status)->toBe(PreorderStatus::NotRestocked)
        ->and($otherSize->refresh()->status)->toBe(PreorderStatus::Active);
    Notification::assertSentTo($this->student, PreorderNotRestocked::class, fn (PreorderNotRestocked $notice) => $notice->toPush($this->student)['body'] === 'It will not be restocked, so your preorder has been closed. Reason: Head Office no longer makes this size.');

    $this->actingAs($this->student)
        ->get(route('my-preorders.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('preorders.data.0.status', 'not_restocked')
            ->where('preorders.data.0.not_restocked_reason', 'Head Office no longer makes this size.')
            ->where('preorders.data.0.can_cancel', false)
        );
});

test('a size can be marked as not restocked only while it is sold out, and only once', function (Closure $prepare, string $message) {
    [$product, $extraSmall] = soldOutPolo();
    $prepare($extraSmall);

    $this->actingAs($this->specialist)
        ->post(route('preorders.not-restocked', $extraSmall), ['reason' => ''])
        ->assertSessionHasErrors(['reason' => $message]);
})->with([
    'in stock again' => [fn (ProductVariant $variant) => $variant->forceFill(['stock_on_hand' => 2])->save(), 'BSIT Polo (XS) is in stock again.'],
    'already marked' => [fn (ProductVariant $variant) => $variant->forceFill(['not_restocked_at' => now()])->save(), 'BSIT Polo (XS) is already marked as not restocked.'],
    'not for sale' => [fn (ProductVariant $variant) => $variant->product->update(['status' => ProductStatus::Draft]), 'BSIT Polo is not for sale, so this only applies to its preorders when it is.'],
]);

test('the reason may be at most 200 characters', function () {
    [$product, $extraSmall] = soldOutPolo();

    $this->actingAs($this->specialist)
        ->post(route('preorders.not-restocked', $extraSmall), ['reason' => str_repeat('a', 201)])
        ->assertSessionHasErrors(['reason' => 'The reason may be at most 200 characters.']);

    expect($extraSmall->refresh()->not_restocked_at)->toBeNull();
});

test('the Specialist can allow preorders again, and stock coming in clears the mark too', function () {
    [$product, $extraSmall] = soldOutPolo();
    $extraSmall->forceFill(['not_restocked_at' => now()])->save();

    $this->actingAs($this->specialist)
        ->delete(route('preorders.allow-restock', $extraSmall))
        ->assertInertiaFlash('toast.message', 'Students can preorder BSIT Polo (XS) again while it is out of stock.');

    expect($extraSmall->refresh()->not_restocked_at)->toBeNull();

    $extraSmall->forceFill(['not_restocked_at' => now()])->save();
    $order = orderWith(['UTMP01-01' => 3]);
    $this->post(route('deliveries.store'), [
        'received_on' => now()->toDateString(),
        'items' => [['purchase_order_item_id' => itemOf($order, 'UTMP01-01'), 'quantity_received' => 3]],
    ]);

    expect($extraSmall->refresh()->not_restocked_at)->toBeNull();
});

test('only the Specialist can say a size will not be restocked', function () {
    [$product, $extraSmall] = soldOutPolo();

    $this->actingAs($this->student)
        ->post(route('preorders.not-restocked', $extraSmall))
        ->assertForbidden();

    expect($extraSmall->refresh()->not_restocked_at)->toBeNull();
});

test('a student can cancel a preorder that is waiting for a restock', function () {
    [$product, $extraSmall] = soldOutPolo();
    $preorder = Preorder::factory()->forVariant($extraSmall)->for($this->student, 'student')->create();
    $this->actingAs($this->student);

    $this->get(route('my-preorders.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('preorders.data.0.waiting_for_restock', true)
            ->where('preorders.data.0.can_cancel', true)
        );

    $this->delete(route('my-preorders.destroy', $preorder))
        ->assertInertiaFlash('toast.message', 'Your preorder for BSIT Polo has been cancelled.');

    expect($preorder->refresh()->status)->toBe(PreorderStatus::Cancelled);
});

test('the Preorders page shows products waiting for a restock with their stock per size', function () {
    [$product, $extraSmall, $medium] = soldOutPolo();
    Preorder::factory()->forVariant($extraSmall)->for($this->student, 'student')->create(['quantity' => 2]);

    $this->actingAs($this->specialist)
        ->get(route('preorders.index', ['stage' => 'sold_out']))
        ->assertInertia(fn (Assert $page) => $page
            ->component('preorders/index')
            ->where('summary.sold_out', ['products' => 1, 'students' => 1, 'pieces' => 2])
            ->has('products.data', 1)
            ->where('products.data.0.stage', 'sold_out')
            ->where('products.data.0.pieces_total', 2)
            ->where('products.data.0.variants.0.free_to_sell', 0)
            ->where('products.data.0.variants.0.pieces', 2)
            ->where('products.data.0.variants.1.free_to_sell', 6)
        );
});

test('a new preorder notice opens the product on Preorders', function () {
    [$product, $extraSmall] = soldOutPolo();
    $this->specialist->notify(new PreorderPlaced(Preorder::factory()->forVariant($extraSmall)->for($this->student, 'student')->create()));

    $this->actingAs($this->specialist)
        ->post(route('notifications.open', $this->specialist->notifications()->sole()->id))
        ->assertRedirect(route('preorders.index', ['stage' => 'sold_out', 'search' => 'BSIT Polo']));
});
