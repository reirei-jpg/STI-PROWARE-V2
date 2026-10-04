<?php

use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\Preorder;
use App\Models\Product;
use App\Models\ProductPack;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use App\Notifications\OrderReady;
use Carbon\CarbonImmutable;
use Illuminate\Support\Arr;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-04 10:00', 'Asia/Manila'));
    $this->student = User::factory()->student()->create([
        'name' => 'Juan Dela Cruz',
        'email' => 'delacruz.123456@sti.edu.ph',
        'password' => 'Demo@2026!',
    ]);
});

/**
 * An Available STI Ballpen at ₱15 a piece, also sold by the Box of 12 for
 * ₱150, with stock that arrived.
 *
 * @return array{0: Product, 1: ProductVariant, 2: ProductPack}
 */
function appBallpen(int $stock = 30): array
{
    $product = Product::factory()->create(['name' => 'STI Ballpen', 'price_centavos' => 1500, 'status' => ProductStatus::Available, 'low_stock_alert_at' => 0]);
    $variant = ProductVariant::factory()->for($product)->create(['stock_on_hand' => $stock]);
    StockMovement::factory()->for($variant, 'variant')->create();
    $box = ProductPack::factory()->for($product)->soldToStudents(15000)->create(['name' => 'Box', 'pieces' => 12]);

    return [$product, $variant, $box];
}

test('a student signs in on the app and gets a token for that phone', function () {
    $response = $this->postJson(route('api.v1.auth.login'), [
        'email' => 'DelaCruz.123456@sti.edu.ph',
        'password' => 'Demo@2026!',
        'device_name' => 'realme RMX3999',
    ])->assertOk()->assertJsonPath('user.name', 'Juan Dela Cruz');

    expect($this->student->tokens()->sole()->name)->toBe('realme RMX3999');

    $this->withToken($response->json('token'))
        ->getJson(route('api.v1.auth.me'))
        ->assertOk()
        ->assertJsonPath('user.email', 'delacruz.123456@sti.edu.ph');
});

test('signing in on the app explains what is wrong', function (Closure $makeUser, string $password, string $message) {
    $user = $makeUser();

    $this->postJson(route('api.v1.auth.login'), ['email' => $user->email, 'password' => $password, 'device_name' => 'phone'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email' => $message]);
})->with([
    'wrong password' => [fn () => User::query()->where('email', 'delacruz.123456@sti.edu.ph')->sole(), 'wrong', 'These credentials do not match our records.'],
    'staff account' => [fn () => User::factory()->specialist()->create(['password' => 'Demo@2026!']), 'Demo@2026!', 'The PROWARE app is for students. Staff, please use the website.'],
    'email not verified' => [fn () => User::factory()->student()->unverified()->create(['password' => 'Demo@2026!']), 'Demo@2026!', 'Verify your email on the PROWARE website first, then sign in here.'],
]);

test('the app needs a signed-in student', function () {
    $this->getJson(route('api.v1.cart.index'))->assertUnauthorized();

    Sanctum::actingAs(User::factory()->specialist()->create());
    $this->getJson(route('api.v1.cart.index'))->assertForbidden();
});

test('signing out on the app ends only that phone\'s login', function () {
    $this->student->createToken('old phone');
    $token = $this->student->createToken('this phone')->plainTextToken;

    $this->withToken($token)->postJson(route('api.v1.auth.logout'))->assertOk();

    expect($this->student->tokens()->pluck('name')->all())->toBe(['old phone']);
});

test('the app shows the same storefront as the website', function () {
    [$ballpen] = appBallpen();
    Product::factory()->create(['name' => 'Anniversary Shirt', 'status' => ProductStatus::Preorder, 'preorders_close_on' => '2026-10-20']);
    $draft = Product::factory()->create(['status' => ProductStatus::Draft]);
    Sanctum::actingAs($this->student);

    $this->getJson(route('api.v1.storefront.home'))
        ->assertOk()
        ->assertJsonPath('coming_soon.0.name', 'Anniversary Shirt')
        ->assertJsonPath('on_sale', []);
    $this->getJson(route('api.v1.storefront.merchandise', ['search' => 'ballpen']))
        ->assertOk()
        ->assertJsonPath('data.0.name', 'STI Ballpen')
        ->assertJsonPath('last_page', 1);
    $this->getJson(route('api.v1.storefront.product', $ballpen))
        ->assertOk()
        ->assertJsonPath('variants.0.stock_pieces', 30)
        ->assertJsonPath('buy_packs.0.name', 'Box');
    $this->getJson(route('api.v1.storefront.product', $draft))->assertNotFound();
});

test('photo links point at the address the phone used', function () {
    [$ballpen] = appBallpen();
    $ballpen->photos()->create(['path' => 'products/ballpen.jpg', 'position' => 0]);
    Sanctum::actingAs($this->student);

    $this->getJson('http://192.168.8.42:8001/api/v1/products/'.$ballpen->id)
        ->assertOk()
        ->assertJsonPath('photo_url', 'http://192.168.8.42:8001/storage/products/ballpen.jpg');
});

test('the app\'s cart follows the website\'s rules', function () {
    [$product, $variant, $box] = appBallpen(stock: 15);
    Sanctum::actingAs($this->student);

    $this->postJson(route('api.v1.cart.store', $product), ['product_variant_id' => $variant->id, 'product_pack_id' => $box->id, 'quantity' => 2])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['quantity' => 'You can have at most 1 Box (12 pcs) of STI Ballpen in your cart (only 15 pcs left).']);

    $this->postJson(route('api.v1.cart.store', $product), ['product_variant_id' => $variant->id, 'quantity' => 3])
        ->assertCreated()
        ->assertJsonPath('message', 'Added 3 pcs of STI Ballpen to your cart.')
        ->assertJsonPath('cart.lines.0.quantity', 3)
        ->assertJsonPath('cart.total_centavos', 4500)
        ->assertJsonPath('cart.can_place_order', true);

    $line = CartItem::sole();
    $this->patchJson(route('api.v1.cart.update', $line), ['quantity' => 0])
        ->assertJsonValidationErrors(['quantity' => 'Keep at least 1, or remove the item.']);
    $this->patchJson(route('api.v1.cart.update', $line), ['quantity' => 5])->assertOk()->assertJsonPath('cart.lines.0.quantity', 5);
    $this->deleteJson(route('api.v1.cart.destroy', $line))->assertOk()->assertJsonPath('cart.lines', []);

    $theirs = CartItem::factory()->create();
    $this->deleteJson(route('api.v1.cart.destroy', $theirs))->assertNotFound();
});

test('placing, seeing and cancelling an order on the app', function () {
    [, $variant] = appBallpen(stock: 10);
    CartItem::factory()->for($this->student, 'student')->for($variant, 'variant')->create(['quantity' => 4]);
    Sanctum::actingAs($this->student);

    $order = $this->postJson(route('api.v1.orders.store'))
        ->assertCreated()
        ->assertJsonPath('message', 'Order PW-0001 placed. Pick it up and pay in cash at the PROWARE office by Oct 7, 2026.')
        ->assertJsonPath('order.can_cancel', true)
        ->json('order');

    expect($variant->refresh()->stock_on_hand)->toBe(6);

    $this->getJson(route('api.v1.orders.index'))->assertJsonPath('data.0.number', 'PW-0001');
    $this->getJson(route('api.v1.orders.show', $order['id']))->assertJsonPath('items.0.quantity', 4);

    $this->postJson(route('api.v1.orders.cancel', $order['id']))
        ->assertOk()
        ->assertJsonPath('order.status', 'cancelled');
    expect($variant->refresh()->stock_on_hand)->toBe(10);
});

test('the app refuses to cancel a prepared order or another student\'s order', function () {
    $ready = Order::factory()->for($this->student, 'student')->create(['status' => OrderStatus::Ready]);
    $theirs = Order::factory()->create();
    Sanctum::actingAs($this->student);

    $this->postJson(route('api.v1.orders.cancel', $ready))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['order' => "Order {$ready->number} is already prepared, so it can no longer be cancelled here. Please talk to the PROWARE office."]);
    $this->postJson(route('api.v1.orders.cancel', $theirs))->assertNotFound();
    $this->getJson(route('api.v1.orders.show', $theirs))->assertNotFound();
});

test('preordering and cancelling a preorder on the app', function () {
    $shirt = Product::factory()->create(['name' => 'Anniversary Shirt', 'status' => ProductStatus::Preorder, 'preorders_close_on' => '2026-10-20']);
    $variant = ProductVariant::factory()->for($shirt)->create();
    Sanctum::actingAs($this->student);

    $preorder = $this->postJson(route('api.v1.preorders.store', $shirt), ['product_variant_id' => $variant->id, 'quantity' => 2])
        ->assertCreated()
        ->assertJsonPath('message', 'Preordered 2 × Anniversary Shirt. You can see it in My Preorders.')
        ->json('preorder');

    $this->getJson(route('api.v1.preorders.index'))->assertJsonPath('data.0.quantity', 2);

    $this->deleteJson(route('api.v1.preorders.destroy', $preorder['id']))
        ->assertOk()
        ->assertJsonPath('preorder.status', 'cancelled');

    $shirt->update(['preorders_close_on' => '2026-10-03']);
    $closed = Preorder::factory()->for($this->student, 'student')->for($shirt)->for($variant, 'variant')->create();
    $this->deleteJson(route('api.v1.preorders.destroy', $closed))
        ->assertJsonValidationErrors(['preorder' => 'Preorders for Anniversary Shirt are closed, so this preorder can no longer be cancelled here. Please ask the PROWARE office.']);
});

test('the app gets exactly the storefront the website shows', function () {
    [$ballpen] = appBallpen();
    $shirt = Product::factory()->create(['name' => 'Anniversary Shirt', 'status' => ProductStatus::Preorder, 'preorders_close_on' => '2026-10-20']);
    ProductVariant::factory()->for($shirt)->create();
    $umbrella = Product::factory()->status(ProductStatus::OnSale)->create(['name' => 'STI Umbrella', 'sale_ends_at' => '2026-10-10 17:00']);
    StockMovement::factory()->for(ProductVariant::factory()->for($umbrella)->create(['stock_on_hand' => 4]), 'variant')->create();
    $hoodie = Product::factory()->create(['name' => 'STI Hoodie']);
    ProductVariant::factory()->for($hoodie)->create(['stock_on_hand' => 0]);
    StockMovement::factory()->for($hoodie->variants()->sole(), 'variant')->create();

    $website = $this->actingAs($this->student)->get(route('home'));
    $websiteView = $this->getJson(route('storefront.product', $ballpen))->json();
    Sanctum::actingAs($this->student);
    $app = $this->getJson(route('api.v1.storefront.home'))->json();
    $appMerchandise = $this->getJson(route('api.v1.storefront.merchandise'))->json('data');
    $appView = $this->getJson(route('api.v1.storefront.product', $ballpen))->json();

    expect($app['coming_soon'])->toBe($website->inertiaProps('comingSoon'))->not->toBe([]);
    expect($app['on_sale'])->toBe($website->inertiaProps('onSale'))->not->toBe([]);
    expect($appMerchandise)->toBe($website->inertiaProps('merchandise.data'))->toHaveCount(3);
    expect($appView)->toBe($websiteView);
});

test('the app gets exactly the cart, orders and preorders the website shows', function () {
    [, $variant, $box] = appBallpen();
    CartItem::factory()->for($this->student, 'student')->for($variant, 'variant')->create(['quantity' => 2]);
    CartItem::factory()->for($this->student, 'student')->for($variant, 'variant')->for($box, 'pack')->create(['quantity' => 1]);
    Order::factory()->for($this->student, 'student')->create(['status' => OrderStatus::PickedUp]);
    Order::factory()->for($this->student, 'student')->create(['status' => OrderStatus::Placed]);
    $shirt = Product::factory()->create(['name' => 'Anniversary Shirt', 'status' => ProductStatus::Preorder, 'preorders_close_on' => '2026-10-20']);
    Preorder::factory()->for($this->student, 'student')->for($shirt)->for(ProductVariant::factory()->for($shirt), 'variant')->create();

    $websiteCart = $this->actingAs($this->student)->get(route('cart.index'))->inertiaProps();
    $websiteOrders = $this->get(route('my-orders.index'))->inertiaProps('orders.data');
    $websitePreorders = $this->get(route('my-preorders.index'))->inertiaProps('preorders.data');
    Sanctum::actingAs($this->student);
    $appCart = $this->getJson(route('api.v1.cart.index'))->json();
    $appOrders = $this->getJson(route('api.v1.orders.index'))->json('data');
    $appPreorders = $this->getJson(route('api.v1.preorders.index'))->json('data');

    expect($appCart)->toBe(Arr::only($websiteCart, ['lines', 'total_centavos', 'can_place_order', 'pick_up_by']))
        ->and($appCart['lines'])->toHaveCount(2);
    expect($appOrders)->toBe($websiteOrders)->toHaveCount(2);
    expect($appPreorders)->toBe($websitePreorders)->toHaveCount(1);
});

test('the app gets exactly the notifications the website\'s bell shows', function () {
    $order = Order::factory()->for($this->student, 'student')->create();
    $this->student->notify(new OrderReady($order));
    $this->travel(5)->minutes();
    $this->student->notify(new OrderReady($order));
    $this->student->notifications()->latest()->first()->markAsRead();

    $website = $this->actingAs($this->student)->get(route('my-orders.index'))->inertiaProps('notifications');
    Sanctum::actingAs($this->student);
    $app = $this->getJson(route('api.v1.notifications.index'))->json();

    expect($app['data'])->toBe($website['recent'])->toHaveCount(2);
    expect($app['unread_count'])->toBe($website['unread_count'])->toBe(1);
});

test('the app lists the student\'s notifications and marks them read', function () {
    $order = Order::factory()->for($this->student, 'student')->create();
    $this->student->notify(new OrderReady($order));
    $this->student->notify(new OrderReady($order));
    Sanctum::actingAs($this->student);

    $page = $this->getJson(route('api.v1.notifications.index'))
        ->assertOk()
        ->assertJsonPath('unread_count', 2)
        ->assertJsonPath('data.0.data.kind', 'order_ready');

    $this->postJson(route('api.v1.notifications.read', $page->json('data.0.id')))->assertJsonPath('unread_count', 1);
    $this->postJson(route('api.v1.notifications.read-all'))->assertJsonPath('unread_count', 0);
});
