<?php

use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductAnnouncement;
use App\Models\ProductVariant;
use App\Models\User;
use App\Notifications\ProductAnnounced;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-11-13 10:00', 'Asia/Manila'));
    $this->specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
});

/**
 * A buyer who spent $spent (centavos) on one order, released $daysAgo days ago.
 */
function buyerWhoSpent(string $name, int $spent, int $daysAgo = 5, OrderStatus $status = OrderStatus::PickedUp): User
{
    $buyer = User::factory()->student()->create(['name' => $name]);
    $order = Order::factory()->for($buyer, 'student')->create(['status' => $status, 'picked_up_at' => now()->subDays($daysAgo)]);
    OrderItem::factory()->for($order)->create(['quantity' => 2, 'quantity_short' => 0, 'pieces_per_unit' => 1, 'unit_price_centavos' => intdiv($spent, 2), 'line_total_centavos' => $spent]);

    return $buyer;
}

/**
 * An Available product with pieces in stock, at ₱480.00.
 */
function tumblerInStock(int $pieces = 5): Product
{
    $product = Product::factory()->create(['name' => 'STI Thermal Tumbler', 'status' => ProductStatus::Available, 'price_centavos' => 48000, 'sale_price_centavos' => null]);
    ProductVariant::factory()->for($product)->create(['stock_on_hand' => $pieces, 'price_centavos' => null]);

    return $product;
}

test('the dashboard lists the buyers who spent the most on released orders in the last 3 months', function () {
    buyerWhoSpent('Bea Villareal', 30000);
    $juan = buyerWhoSpent('Juan Dela Cruz', 120000);
    buyerWhoSpent('Old Buyer', 900000, daysAgo: 120);
    buyerWhoSpent('Still To Pay', 900000, status: OrderStatus::Placed);
    tumblerInStock();

    $this->actingAs($this->specialist)->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page
        ->where('stockCards.top_buyers.buyers_count', 2)
        ->where('stockCards.top_buyers.items.0.user_id', $juan->id)
        ->where('stockCards.top_buyers.items.0.spent_centavos', 120000)
        ->where('stockCards.top_buyers.items.0.pieces', 2)
        ->where('stockCards.top_buyers.items.1.name', 'Bea Villareal')
        ->has('stockCards.top_buyers.items', 2)
        ->where('stockCards.top_buyers.sizes', [10, 20, 50])
        ->where('stockCards.top_buyers.products.0.product_name', 'STI Thermal Tumbler')
        ->where('stockCards.top_buyers.products.0.price_from_centavos', 48000));

    // The phone's To-do has the same card.
    Sanctum::actingAs($this->specialist);
    $this->getJson(route('api.v1.specialist.tasks'))->assertJsonPath('stock_cards.top_buyers.items.0.name', 'Juan Dela Cruz');
});

test('the Specialist tells the top buyers about a product in stock, once a day at most', function () {
    Notification::fake();
    $buyers = collect(range(1, 12))->map(fn (int $rank): User => buyerWhoSpent("Buyer {$rank}", (20 - $rank) * 10000));
    $product = tumblerInStock();

    $this->actingAs($this->specialist)
        ->post(route('product-announcements.store'), ['product_id' => $product->id, 'top' => 10, 'note' => ' Limited stock. '])
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.message', 'STI Thermal Tumbler has been announced to the top 10 buyers.');

    Notification::assertSentTo($buyers->take(10)->all(), ProductAnnounced::class, function (ProductAnnounced $notice, array $channels, User $buyer): bool {
        $push = $notice->toPush($buyer);

        return $push['title'] === 'New in the store: STI Thermal Tumbler'
            && $push['body'] === 'It is in stock now at ₱480.00. Limited stock.'
            && $notice->toArray($buyer)['kind'] === 'product_announced';
    });
    Notification::assertNotSentTo($buyers->slice(10)->all(), ProductAnnounced::class);
    expect(ProductAnnouncement::sole())->top->toBe(10)->recipients->toBe(10)->note->toBe('Limited stock.');

    // Not again within 24 hours, from the website or the phone.
    $this->post(route('product-announcements.store'), ['product_id' => $product->id, 'top' => 20])
        ->assertSessionHasErrors(['product_id' => 'STI Thermal Tumbler was already announced on Nov 13, 10:00 AM by Carlo Mendoza. It can be announced again 24 hours after that.']);

    $this->travel(25)->hours();
    Sanctum::actingAs($this->specialist);
    $this->postJson(route('api.v1.specialist.product-announcements.store'), ['product_id' => $product->id, 'top' => 50])
        ->assertOk()
        ->assertJsonPath('message', 'STI Thermal Tumbler has been announced to the 12 buyers of the last 3 months.');
});

test('a product out of stock, a wrong number of buyers, or no buyers yet is refused', function () {
    Notification::fake();
    $soldOut = tumblerInStock(pieces: 0);
    $this->actingAs($this->specialist);

    $this->post(route('product-announcements.store'), ['product_id' => $soldOut->id, 'top' => 10])
        ->assertSessionHasErrors(['product_id' => 'STI Thermal Tumbler is not in stock in the store, so there is nothing to announce.']);
    $this->post(route('product-announcements.store'), ['product_id' => $soldOut->id, 'top' => 15, 'note' => str_repeat('a', 121)])
        ->assertSessionHasErrors(['top' => 'Choose the top 10, 20 or 50 buyers.', 'note' => 'The note can be at most 120 characters.']);

    $inStock = tumblerInStock();
    $this->post(route('product-announcements.store'), ['product_id' => $inStock->id, 'top' => 10])
        ->assertSessionHasErrors(['product_id' => 'No one has bought anything in the last 3 months, so there is no one to tell yet.']);

    Notification::assertNothingSent();
    expect(ProductAnnouncement::count())->toBe(0);
});

test('only the Specialist can tell the top buyers', function () {
    $product = tumblerInStock();

    foreach ([User::factory()->student()->create(), User::factory()->schoolAdmin()->create()] as $user) {
        $this->actingAs($user)->post(route('product-announcements.store'), ['product_id' => $product->id, 'top' => 10])->assertForbidden();
    }
});

test('opening the notice on the website shows the product in the store', function () {
    $buyer = buyerWhoSpent('Juan Dela Cruz', 120000);
    $buyer->notify(new ProductAnnounced(tumblerInStock()));
    $notice = $buyer->notifications()->sole();

    $this->actingAs($buyer)->post(route('notifications.open', $notice->id))
        ->assertRedirect(route('home', ['search' => 'STI Thermal Tumbler']));
});
