<?php

use App\Enums\StockMovementType;
use App\Models\Product;
use App\Models\ProductPack;
use App\Models\ProductVariant;
use App\Models\PurchaseOrder;
use App\Models\StockMovement;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
});

/**
 * A delivery form receiving $quantity of the item with this code on the order.
 *
 * @return array<string, mixed>
 */
function deliveryOf(PurchaseOrder $order, string $code, int $quantity): array
{
    return [
        'received_on' => now()->toDateString(),
        'items' => [['purchase_order_item_id' => itemOf($order, $code), 'quantity_received' => $quantity]],
    ];
}

/**
 * A Draft product form with one variant carrying this eStore Item Code.
 *
 * @return array<string, mixed>
 */
function draftProductWithCode(string $code): array
{
    return [
        'name' => 'Chibi Keychain',
        'sold_by_piece' => '1',
        'price' => '35',
        'status' => 'draft',
        'sale_price' => '',
        'low_stock_alert_at' => '5',
        'photos' => [],
        'packs' => [],
        'options' => [],
        'variants' => [['combination' => '', 'estore_item_code' => $code, 'estore_pack_key' => '', 'price' => '']],
    ];
}

test('a delivery of an item linked to a product goes into its stock', function () {
    $variant = ProductVariant::factory()
        ->for(Product::factory()->create(['name' => 'TM Polo']))
        ->create(['estore_item_code' => 'UTMP02-03']);
    $order = orderWith(['UTMP02-03' => 10]);

    $this->actingAs($this->specialist)
        ->post(route('deliveries.store'), deliveryOf($order, 'UTMP02-03', 6))
        ->assertRedirect(route('deliveries.index'))
        ->assertInertiaFlash('toast.type', 'success')
        ->assertInertiaFlash('toast.message', 'Delivery recorded. Added to stock: TM Polo — 6 pcs.');

    expect($variant->refresh()->stock_on_hand)->toBe(6)
        ->and(StockMovement::sole())
        ->type->toBe(StockMovementType::Delivery)
        ->quantity->toBe(6)
        ->balance_after->toBe(6)
        ->units_received->toBe(6)
        ->unit_name->toBe('Piece')
        ->pieces_per_unit->toBe(1)
        ->recorded_by->toBe($this->specialist->id);
});

test('an item Head Office sends by the pack adds the pieces in each pack', function () {
    $product = Product::factory()->create(['name' => 'Lanyard']);
    $pack = ProductPack::factory()->for($product)->create(['name' => 'Pack', 'pieces' => 50]);
    $variant = ProductVariant::factory()->for($product)->create(['estore_item_code' => 'PRLY01-01', 'estore_pack_id' => $pack->id]);
    $order = orderWith(['PRLY01-01' => 5]);
    $this->actingAs($this->specialist);

    $this->post(route('deliveries.store'), deliveryOf($order, 'PRLY01-01', 2))
        ->assertInertiaFlash('toast.message', 'Delivery recorded. Added to stock: Lanyard — 2 Packs × 50 = 100 pcs.');
    $this->post(route('deliveries.store'), deliveryOf($order, 'PRLY01-01', 1))
        ->assertInertiaFlash('toast.message', 'Delivery recorded. Added to stock: Lanyard — 1 Pack × 50 = 50 pcs.');

    expect($variant->refresh()->stock_on_hand)->toBe(150)
        ->and(StockMovement::query()->orderBy('id')->get()->map->only(['units_received', 'unit_name', 'pieces_per_unit', 'quantity', 'balance_after'])->all())->toBe([
            ['units_received' => 2, 'unit_name' => 'Pack', 'pieces_per_unit' => 50, 'quantity' => 100, 'balance_after' => 100],
            ['units_received' => 1, 'unit_name' => 'Pack', 'pieces_per_unit' => 50, 'quantity' => 50, 'balance_after' => 150],
        ]);
});

test('an item not linked to a product is recorded but not added to stock', function () {
    $order = orderWith(['SSIF001-001' => 3000]);

    $this->actingAs($this->specialist)
        ->post(route('deliveries.store'), deliveryOf($order, 'SSIF001-001', 1000))
        ->assertRedirect(route('deliveries.index'))
        ->assertInertiaFlash('toast.type', 'warning')
        ->assertInertiaFlash('toast.message', 'Delivery recorded. Not added to stock yet, because it is not linked to a product: SSIF001-001 (1,000 as ordered on the eStore). Link it in Products › Items to Link.');

    expect(StockMovement::count())->toBe(0)
        ->and($order->items()->sole()->quantity_delivered)->toBe(1000);
});

test('the message after saving lists what went into stock and what did not', function () {
    ProductVariant::factory()
        ->for(Product::factory()->create(['name' => 'TM Polo']))
        ->create(['combination' => 'Size: S/M', 'choices' => [['option' => 'Size', 'choice' => 'S/M']], 'estore_item_code' => 'UTMP02-03']);
    $order = orderWith(['UTMP02-03' => 10, 'SSIF001-001' => 3000, 'SSRF001-001' => 500]);

    $this->actingAs($this->specialist)
        ->post(route('deliveries.store'), [
            'received_on' => now()->toDateString(),
            'items' => [
                ['purchase_order_item_id' => itemOf($order, 'UTMP02-03'), 'quantity_received' => 3],
                ['purchase_order_item_id' => itemOf($order, 'SSIF001-001'), 'quantity_received' => 1000],
                ['purchase_order_item_id' => itemOf($order, 'SSRF001-001'), 'quantity_received' => 500],
            ],
        ])
        ->assertInertiaFlash('toast.type', 'warning')
        ->assertInertiaFlash('toast.message', 'Delivery recorded. Added to stock: TM Polo (S/M) — 3 pcs. Not added to stock yet, because they are not linked to a product: SSIF001-001 (1,000 as ordered on the eStore); SSRF001-001 (500 as ordered on the eStore). Link them in Products › Items to Link.');
});

test('the deliveries list shows the pieces each delivery added to stock', function () {
    $product = Product::factory()->create(['name' => 'Lanyard']);
    $pack = ProductPack::factory()->for($product)->create(['name' => 'Pack', 'pieces' => 50]);
    ProductVariant::factory()->for($product)->create(['estore_item_code' => 'PRLY01-01', 'estore_pack_id' => $pack->id]);
    $order = orderWith(['PRLY01-01' => 5, 'SSIF001-001' => 3000]);

    $this->actingAs($this->specialist)->post(route('deliveries.store'), [
        'received_on' => now()->toDateString(),
        'items' => [
            ['purchase_order_item_id' => itemOf($order, 'PRLY01-01'), 'quantity_received' => 2],
            ['purchase_order_item_id' => itemOf($order, 'SSIF001-001'), 'quantity_received' => 1000],
        ],
    ]);

    $this->get(route('deliveries.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('deliveries.data.0.pieces_added_to_stock', 100)
            ->where('deliveries.data.0.items_not_in_stock', 1)
        );
});

test('the order details say how each item is sent and what each delivery added to stock', function () {
    $product = Product::factory()->create(['name' => 'Lanyard']);
    $pack = ProductPack::factory()->for($product)->create(['name' => 'Pack', 'pieces' => 50]);
    ProductVariant::factory()->for($product)->create(['estore_item_code' => 'PRLY01-01', 'estore_pack_id' => $pack->id]);
    $order = orderWith(['PRLY01-01' => 5, 'SSIF001-001' => 3000]);
    $this->actingAs($this->specialist);
    $this->post(route('deliveries.store'), deliveryOf($order, 'PRLY01-01', 2));

    $this->getJson(route('purchase-orders.show', $order))
        ->assertOk()
        ->assertJsonPath('items.0.stock_target', [
            'product_name' => 'Lanyard',
            'variant_label' => 'Default',
            'has_options' => false,
            'unit_name' => 'Pack',
            'pieces_per_unit' => 50,
            'split_into' => [],
        ])
        ->assertJsonPath('items.1.stock_target', null)
        ->assertJsonPath('deliveries.0.items.0.added_to_stock', [[
            'product_name' => 'Lanyard',
            'units_received' => 2,
            'unit_name' => 'Pack',
            'pieces_per_unit' => 50,
            'pieces' => 100,
        ]]);
});

test('linking an item adds the deliveries that arrived before it, and later ones go in by themselves', function () {
    $product = Product::factory()->create(['name' => 'TM Polo']);
    $variant = ProductVariant::factory()->for($product)->create([
        'combination' => 'Size: S/M',
        'choices' => [['option' => 'Size', 'choice' => 'S/M']],
    ]);
    $order = orderWith(['UTMP02-03' => 10]);
    $this->actingAs($this->specialist);
    $this->post(route('deliveries.store'), deliveryOf($order, 'UTMP02-03', 4));
    $this->post(route('deliveries.store'), deliveryOf($order, 'UTMP02-03', 3));

    $this->post(route('item-links.store'), [
        'item_code' => 'utmp02 – 03',
        'product_variant_ids' => [$variant->id],
        'sent_by' => 'piece',
    ])
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.message', 'UTMP02-03 is now linked to TM Polo (S/M). 7 pieces were added to stock.');

    expect($variant->refresh())
        ->estore_item_code->toBe('UTMP02-03')
        ->estore_pack_id->toBeNull()
        ->stock_on_hand->toBe(7);

    $this->post(route('deliveries.store'), deliveryOf($order, 'UTMP02-03', 3));

    expect($variant->refresh()->stock_on_hand)->toBe(10)
        ->and(StockMovement::query()->orderBy('id')->pluck('balance_after')->all())->toBe([4, 7, 10]);
});

test('linking can add the pack Head Office sends the item in', function () {
    $product = Product::factory()->create(['name' => 'Ballpen']);
    $variant = ProductVariant::factory()->for($product)->create();
    $order = orderWith(['PRBP01-01' => 5]);
    $this->actingAs($this->specialist);
    $this->post(route('deliveries.store'), deliveryOf($order, 'PRBP01-01', 3));

    $this->post(route('item-links.store'), [
        'item_code' => 'PRBP01-01',
        'product_variant_ids' => [$variant->id],
        'sent_by' => 'new_pack',
        'new_pack_name' => ' Box ',
        'new_pack_pieces' => '12',
    ])
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.message', 'PRBP01-01 is now linked to Ballpen. 36 pieces were added to stock.');

    $pack = ProductPack::sole();

    expect($pack)
        ->product_id->toBe($product->id)
        ->name->toBe('Box')
        ->pieces->toBe(12)
        ->sold_to_students->toBeFalse()
        ->and($variant->refresh())
        ->estore_pack_id->toBe($pack->id)
        ->stock_on_hand->toBe(36);
});

test('an item can be linked before it arrives', function () {
    $variant = ProductVariant::factory()->create();
    orderWith(['PRCU01-01' => 20]);

    $this->actingAs($this->specialist)
        ->post(route('item-links.store'), ['item_code' => 'PRCU01-01', 'product_variant_ids' => [$variant->id], 'sent_by' => 'piece'])
        ->assertInertiaFlash('toast.message', "PRCU01-01 is now linked to {$variant->product->name}. Its deliveries will be added to stock.");

    expect($variant->refresh())
        ->estore_item_code->toBe('PRCU01-01')
        ->stock_on_hand->toBe(0);
});

test('linking explains what is wrong', function (array $payload, string $field, string $message) {
    $this->actingAs($this->specialist)
        ->post(route('item-links.store'), $payload)
        ->assertSessionHasErrors([$field => $message]);

    expect(StockMovement::count())->toBe(0);
})->with([
    'no variant chosen' => [
        fn () => ['item_code' => orderWith(['UTMP02-03' => 10])->items()->value('item_code'), 'sent_by' => 'piece'],
        'product_variant_ids', 'Choose the product and the variant (or variants) this item is.',
    ],
    'a code no uploaded order has' => [
        fn () => ['item_code' => 'XX01-01', 'product_variant_ids' => [ProductVariant::factory()->create()->id], 'sent_by' => 'piece'],
        'item_code', 'No uploaded order has the eStore Item Code XX01-01.',
    ],
    'a code already linked' => [
        function () {
            orderWith(['UTMP02-03' => 10]);
            ProductVariant::factory()->for(Product::factory()->create(['name' => 'TM Polo']))->create(['estore_item_code' => 'UTMP02-03']);

            return ['item_code' => 'UTMP02-03', 'product_variant_ids' => [ProductVariant::factory()->create()->id], 'sent_by' => 'piece'];
        },
        'item_code', 'UTMP02-03 is already linked to TM Polo.',
    ],
    'a variant that has another code' => [
        function () {
            orderWith(['UTMP02-03' => 10]);

            return ['item_code' => 'UTMP02-03', 'product_variant_ids' => [ProductVariant::factory()->create(['estore_item_code' => 'UTMP02-04'])->id], 'sent_by' => 'piece'];
        },
        'product_variant_ids', 'This variant already has the eStore Item Code UTMP02-04. Choose another variant.',
    ],
    'a pack of another product' => [
        function () {
            orderWith(['UTMP02-03' => 10]);

            return ['item_code' => 'UTMP02-03', 'product_variant_ids' => [ProductVariant::factory()->create()->id], 'sent_by' => 'pack', 'pack_id' => ProductPack::factory()->create()->id];
        },
        'pack_id', 'Choose one of this product\'s packs.',
    ],
    'a new pack named piece' => [
        function () {
            orderWith(['UTMP02-03' => 10]);

            return ['item_code' => 'UTMP02-03', 'product_variant_ids' => [ProductVariant::factory()->create()->id], 'sent_by' => 'new_pack', 'new_pack_name' => 'pcs', 'new_pack_pieces' => '10'];
        },
        'new_pack_name', 'Stock is already counted by the piece. Name the pack something else, e.g. Pack or Box.',
    ],
    'a new pack of one piece' => [
        function () {
            orderWith(['UTMP02-03' => 10]);

            return ['item_code' => 'UTMP02-03', 'product_variant_ids' => [ProductVariant::factory()->create()->id], 'sent_by' => 'new_pack', 'new_pack_name' => 'Pack', 'new_pack_pieces' => '1'];
        },
        'new_pack_pieces', 'A pack has at least 2 pieces.',
    ],
]);

test('typing the code on a variant in the product form adds the deliveries that arrived before, only once', function () {
    $order = orderWith(['PRCU01-01' => 20]);
    $this->actingAs($this->specialist);
    $this->post(route('deliveries.store'), deliveryOf($order, 'PRCU01-01', 20));

    $this->post(route('products.store'), draftProductWithCode('prcu01 – 01'))
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.message', 'Product saved. 20 pieces from deliveries already received were added to stock.');

    $product = Product::sole();

    $this->put(route('products.update', $product), draftProductWithCode('PRCU01-01'))
        ->assertInertiaFlash('toast.message', 'Product saved.');

    expect($product->variants()->sole()->stock_on_hand)->toBe(20)
        ->and(StockMovement::count())->toBe(1);
});

test('items to link lists each eStore item not on a product yet, received ones first', function () {
    ProductVariant::factory()->create(['estore_item_code' => 'UTMP02-03']);
    orderWith(['UTMP02-03' => 10, 'PRCU01-01' => 20], ['order_number' => '30650', 'date_ordered' => '2026-09-17']);
    $received = orderWith(['SSIF001-001' => 3000, 'PRCU01-01' => 5], ['order_number' => '30722', 'date_ordered' => '2026-09-29', 'category' => 'SMS']);
    $this->actingAs($this->specialist);
    $this->post(route('deliveries.store'), deliveryOf($received, 'SSIF001-001', 1000));

    $this->get(route('item-links.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('products/items-to-link')
            ->has('items.data', 2)
            ->where('items.data.0.item_code', 'SSIF001-001')
            ->where('items.data.0.category', 'SMS')
            ->where('items.data.0.waiting_for_stock', 1000)
            ->where('items.data.1.item_code', 'PRCU01-01')
            ->where('items.data.1.description', 'Item PRCU01-01')
            ->where('items.data.1.unit_price_centavos', $received->items()->where('item_code', 'PRCU01-01')->value('unit_price_centavos'))
            ->where('items.data.1.quantity_ordered', 25)
            ->where('items.data.1.orders_count', 2)
            ->where('items.data.1.latest_order_number', '30722')
            ->where('items.data.1.waiting_for_stock', 0)
        );

    $this->get(route('item-links.index', ['search' => 'ssif']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('items.data', 1)
            ->where('items.data.0.item_code', 'SSIF001-001')
            ->where('filters.search', 'ssif')
        );
});

test('creating a product from an eStore item starts with its description and code', function () {
    orderWith(['PRCU01-01' => 20]);
    orderWith(['UTMP02-03' => 10]);
    ProductVariant::factory()->create(['estore_item_code' => 'UTMP02-03']);
    $this->actingAs($this->specialist);

    $this->get(route('products.create', ['item_code' => 'prcu01-01']))
        ->assertInertia(fn (Assert $page) => $page
            ->component('products/form')
            ->where('fromItem', ['item_code' => 'PRCU01-01', 'description' => 'Item PRCU01-01'])
        );

    $this->get(route('products.create', ['item_code' => 'UTMP02-03']))
        ->assertInertia(fn (Assert $page) => $page->where('fromItem', null));
});

test('the products list shows the stock in pieces and how many eStore items are not linked', function () {
    $product = Product::factory()->create();
    ProductVariant::factory()->for($product)->create(['combination' => 'Size: S', 'stock_on_hand' => 30]);
    ProductVariant::factory()->for($product)->create(['combination' => 'Size: M', 'stock_on_hand' => 12]);
    orderWith(['PRCU01-01' => 1, 'PRCU01-02' => 1]);
    orderWith(['PRCU01-01' => 2]);

    $this->actingAs($this->specialist)
        ->get(route('products.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('products.data.0.stock_on_hand', 42)
            ->where('itemsToLinkCount', 2)
        );
});

test('the record delivery form shows where each item goes in stock', function () {
    $product = Product::factory()->create(['name' => 'Lanyard']);
    $pack = ProductPack::factory()->for($product)->create(['name' => 'Pack', 'pieces' => 50]);
    ProductVariant::factory()->for($product)->create(['estore_item_code' => 'PRLY01-01', 'estore_pack_id' => $pack->id]);
    orderWith(['PRLY01-01' => 5, 'SSIF001-001' => 100]);

    $this->actingAs($this->specialist)
        ->get(route('deliveries.create'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('groups.0.item_code', 'PRLY01-01')
            ->where('groups.0.stock_target', [
                'product_name' => 'Lanyard',
                'variant_label' => 'Default',
                'has_options' => false,
                'unit_name' => 'Pack',
                'pieces_per_unit' => 50,
                'split_into' => [],
            ])
            ->where('groups.1.item_code', 'SSIF001-001')
            ->where('groups.1.stock_target', null)
        );
});

test('the link pop-up finds products by name with their variants and packs', function () {
    $product = Product::factory()->create(['name' => 'TM Polo']);
    ProductVariant::factory()->for($product)->create([
        'combination' => 'Size: S/M',
        'choices' => [['option' => 'Size', 'choice' => 'S/M']],
        'estore_item_code' => 'UTMP02-03',
    ]);
    ProductPack::factory()->for($product)->create(['name' => 'Pack', 'pieces' => 10]);
    Product::factory()->create(['name' => 'Lanyard']);

    $this->actingAs($this->specialist)
        ->getJson(route('item-links.products', ['search' => 'polo']))
        ->assertOk()
        ->assertJsonCount(1, 'products')
        ->assertJsonPath('products.0.name', 'TM Polo')
        ->assertJsonPath('products.0.variants.0.label', 'S/M')
        ->assertJsonPath('products.0.variants.0.estore_item_code', 'UTMP02-03')
        ->assertJsonPath('products.0.packs.0.pieces', 10);
});

test('the school admin cannot link items', function () {
    $this->actingAs(User::factory()->schoolAdmin()->create());

    $this->get(route('item-links.index'))->assertForbidden();
    $this->getJson(route('item-links.products'))->assertForbidden();
    $this->post(route('item-links.store'), [])->assertForbidden();
});
