<?php

use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\Preorder;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Notifications\PreorderArrived;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-03 10:00', 'Asia/Manila'));
    $this->student = User::factory()->student()->create(['name' => 'Juan Dela Cruz', 'email' => 'delacruz.123456@sti.edu.ph']);
});

/**
 * A Preorder product with sizes S/M and M/L, open until $closesOn.
 *
 * @return array{0: Product, 1: ProductVariant, 2: ProductVariant}
 */
function preorderShirt(?string $closesOn = '2026-10-20', string $name = '42nd Anniversary Shirt'): array
{
    $product = Product::factory()->create(['name' => $name, 'status' => ProductStatus::Preorder, 'preorders_close_on' => $closesOn]);
    $small = ProductVariant::factory()->for($product)->create(['combination' => 'Size: S/M', 'choices' => [['option' => 'Size', 'choice' => 'S/M']], 'position' => 0]);
    $large = ProductVariant::factory()->for($product)->create(['combination' => 'Size: M/L', 'choices' => [['option' => 'Size', 'choice' => 'M/L']], 'position' => 1]);

    return [$product, $small, $large];
}

test('a student can preorder a size, and preordering it again changes how many', function () {
    [$product, $small] = preorderShirt();
    $this->actingAs($this->student);

    $this->post(route('my-preorders.store', $product), ['product_variant_id' => $small->id, 'quantity' => '2'])
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.message', 'Preordered 2 × 42nd Anniversary Shirt (S/M). You can see it in My Preorders.');

    $this->post(route('my-preorders.store', $product), ['product_variant_id' => $small->id, 'quantity' => '3']);

    expect(Preorder::sole())
        ->user_id->toBe($this->student->id)
        ->product_id->toBe($product->id)
        ->product_variant_id->toBe($small->id)
        ->quantity->toBe(3)
        ->status->toBe(PreorderStatus::Active);
});

test('the preorder form explains what is wrong', function (Closure $payload, string $field, string $message) {
    [$product, $small] = preorderShirt();

    $this->actingAs($this->student)
        ->post(route('my-preorders.store', $product), $payload($small))
        ->assertSessionHasErrors([$field => $message]);

    expect(Preorder::count())->toBe(0);
})->with([
    'no size chosen' => [fn (ProductVariant $small) => ['quantity' => '1'], 'product_variant_id', 'Choose the size or color you want.'],
    'a size of another product' => [fn (ProductVariant $small) => ['product_variant_id' => ProductVariant::factory()->create()->id, 'quantity' => '1'], 'product_variant_id', 'Choose one of this item\'s sizes or colors.'],
    'none' => [fn (ProductVariant $small) => ['product_variant_id' => $small->id, 'quantity' => '0'], 'quantity', 'Preorder at least 1.'],
    'more than 1,000' => [fn (ProductVariant $small) => ['product_variant_id' => $small->id, 'quantity' => '1001'], 'quantity', 'For more than 1,000, please talk to the PROWARE office.'],
]);

test('preorders are taken until the end of the close date', function (string $closesOn, bool $open) {
    [$product, $small] = preorderShirt($closesOn);

    $response = $this->actingAs($this->student)
        ->post(route('my-preorders.store', $product), ['product_variant_id' => $small->id, 'quantity' => '1']);

    if ($open) {
        $response->assertSessionHasNoErrors();
    } else {
        $response->assertSessionHasErrors(['quantity' => 'Preorders for 42nd Anniversary Shirt closed on Oct 2, 2026.']);
    }
})->with([
    'closes today' => ['2026-10-03', true],
    'closed yesterday' => ['2026-10-02', false],
]);

test('only preorder products take preorders', function () {
    $product = Product::factory()->create(['name' => 'Lanyard', 'status' => ProductStatus::Available]);
    $variant = ProductVariant::factory()->for($product)->create();

    $this->actingAs($this->student)
        ->post(route('my-preorders.store', $product), ['product_variant_id' => $variant->id, 'quantity' => '1'])
        ->assertSessionHasErrors(['quantity' => 'Lanyard is not open for preorder.']);
});

test('only students can preorder', function () {
    [$product, $small] = preorderShirt();

    $this->post(route('my-preorders.store', $product), ['product_variant_id' => $small->id, 'quantity' => '1'])
        ->assertRedirect(route('login'));

    $this->actingAs(User::factory()->specialist()->create())
        ->post(route('my-preorders.store', $product), ['product_variant_id' => $small->id, 'quantity' => '1'])
        ->assertForbidden();

    expect(Preorder::count())->toBe(0);
});

test('my preorders lists only the student\'s own preorders', function () {
    [$product, $small, $large] = preorderShirt();
    Preorder::factory()->forVariant($small)->for($this->student, 'student')->create(['quantity' => 2]);
    Preorder::factory()->forVariant($large)->create();

    $this->actingAs($this->student)
        ->get(route('my-preorders.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('storefront/my-preorders')
            ->has('preorders.data', 1)
            ->where('preorders.data.0.variant_label', 'S/M')
            ->where('preorders.data.0.quantity', 2)
            ->where('preorders.data.0.can_cancel', true)
        );
});

test('a student can cancel a preorder while preorders are open, but not after', function () {
    [$product, $small] = preorderShirt();
    $preorder = Preorder::factory()->forVariant($small)->for($this->student, 'student')->create();
    $this->actingAs($this->student);

    $this->travelTo(CarbonImmutable::parse('2026-10-21 08:00', 'Asia/Manila'));
    $this->delete(route('my-preorders.destroy', $preorder))
        ->assertInertiaFlash('toast.type', 'error');
    expect($preorder->refresh()->status)->toBe(PreorderStatus::Active);

    $this->travelTo(CarbonImmutable::parse('2026-10-20 20:00', 'Asia/Manila'));
    $this->delete(route('my-preorders.destroy', $preorder))
        ->assertInertiaFlash('toast.message', 'Your preorder for 42nd Anniversary Shirt was cancelled.');

    expect($preorder->refresh())
        ->status->toBe(PreorderStatus::Cancelled)
        ->cancelled_at->not->toBeNull();
});

test('a student cannot cancel another student\'s preorder', function () {
    [, $small] = preorderShirt();
    $preorder = Preorder::factory()->forVariant($small)->create();

    $this->actingAs($this->student)
        ->delete(route('my-preorders.destroy', $preorder))
        ->assertNotFound();

    expect($preorder->refresh()->status)->toBe(PreorderStatus::Active);
});

test('the specialist sees how many students preordered each size, not counting cancelled ones', function () {
    [$shirt, $small, $large] = preorderShirt('2026-10-20');
    [$hoodie] = preorderShirt('2026-10-10', 'Anniversary Hoodie');
    Preorder::factory()->forVariant($small)->create(['quantity' => 2]);
    Preorder::factory()->forVariant($small)->create(['quantity' => 1]);
    Preorder::factory()->forVariant($large)->create(['quantity' => 4]);
    Preorder::factory()->forVariant($large)->cancelled()->create(['quantity' => 9]);

    $this->actingAs(User::factory()->specialist()->create())
        ->get(route('preorders.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('preorders/index')
            ->where('products.data.0.name', 'Anniversary Hoodie')
            ->where('products.data.1.name', '42nd Anniversary Shirt')
            ->where('products.data.1.students_count', 3)
            ->where('products.data.1.pieces_total', 7)
            ->where('products.data.1.variants', [
                ['id' => $small->id, 'label' => 'S/M', 'estore_item_code' => null, 'students' => 2, 'pieces' => 3],
                ['id' => $large->id, 'label' => 'M/L', 'estore_item_code' => null, 'students' => 1, 'pieces' => 4],
            ])
            ->where('summary.open', ['products' => 2, 'students' => 3, 'pieces' => 7])
        );
});

test('preorder products move from taking preorders to to order to arrived', function () {
    Notification::fake();
    [$open, $openSize] = preorderShirt('2026-10-20', 'Intramurals Jersey');
    [$closed, $closedSize] = preorderShirt('2026-10-02', 'STI Mug');
    $arriving = Product::factory()->create(['name' => 'Chibi Keychain', 'status' => ProductStatus::Preorder, 'preorders_close_on' => '2026-10-02']);
    $arrivingSize = ProductVariant::factory()->for($arriving)->create();
    Preorder::factory()->forVariant($openSize)->create(['quantity' => 1]);
    Preorder::factory()->forVariant($closedSize)->create(['quantity' => 2]);
    Preorder::factory()->forVariant($arrivingSize)->for($this->student, 'student')->create(['quantity' => 3]);
    $specialist = User::factory()->specialist()->create();

    $this->actingAs($specialist)->put(route('products.update', $arriving), [
        'name' => 'Chibi Keychain', 'sold_by_piece' => '1', 'price' => '25', 'status' => 'available', 'sale_price' => '',
        'low_stock_alert_at' => '5', 'photos' => [['id' => $arriving->photos()->create(['path' => 'products/a.jpg', 'position' => 0])->id, 'label' => '']], 'packs' => [], 'options' => [],
        'variants' => [['combination' => '', 'estore_item_code' => '', 'estore_pack_key' => '', 'price' => '']],
    ])->assertSessionHasNoErrors();

    Notification::assertSentTo($this->student, PreorderArrived::class);
    expect(Preorder::query()->where('product_id', $arriving->id)->sole())
        ->status->toBe(PreorderStatus::Arrived)
        ->arrived_at->not->toBeNull();

    $this->get(route('preorders.index'))->assertInertia(fn (Assert $page) => $page
        ->where('products.data.0.name', 'STI Mug')
        ->where('products.data.0.stage', 'to_order')
        ->where('products.data.1.name', 'Intramurals Jersey')
        ->where('products.data.1.stage', 'open')
        ->where('products.data.2.name', 'Chibi Keychain')
        ->where('products.data.2.stage', 'arrived')
        ->where('products.data.2.pieces_total', 3)
        ->where('summary', [
            'open' => ['products' => 1, 'students' => 1, 'pieces' => 1],
            'to_order' => ['products' => 1, 'students' => 1, 'pieces' => 2],
            'arrived' => ['products' => 1, 'students' => 1, 'pieces' => 3],
        ])
    );
    $this->get(route('preorders.index', ['stage' => 'to_order']))->assertInertia(fn (Assert $page) => $page
        ->has('products.data', 1)
        ->where('products.data.0.name', 'STI Mug'));

    // The CSV is what is still to order: arrived preorders are left out.
    $csv = $this->get(route('preorders.export'))->streamedContent();
    expect($csv)->toContain('STI Mug')->not->toContain('Chibi Keychain');

    $this->actingAs($this->student)->get(route('my-preorders.index'))->assertInertia(fn (Assert $page) => $page
        ->where('preorders.data.0.status_label', 'Arrived')
        ->where('preorders.data.0.can_cancel', false));
});

test('a product\'s details list what to order and who preordered, only when asked', function () {
    [$product, $small] = preorderShirt('2026-10-02');
    $small->update(['estore_item_code' => 'PRSH01-01']);
    Preorder::factory()->forVariant($small)->for($this->student, 'student')->create(['quantity' => 2]);
    $this->actingAs(User::factory()->specialist()->create());

    $this->get(route('preorders.index', ['details' => $product->id]))->assertInertia(fn (Assert $page) => $page
        ->missing('details')
        ->reloadOnly('details', fn (Assert $reload) => $reload
            ->where('details.stage', 'to_order')
            ->where('details.variants.0.estore_item_code', 'PRSH01-01')
            ->where('details.variants.0.pieces', 2)
            ->where('details.preorders.0.student_name', 'Juan Dela Cruz')
            ->where('details.preorders_count', 1)));
});

test('the specialist can see who preordered a product', function () {
    [$product, $small] = preorderShirt();
    Preorder::factory()->forVariant($small)->for($this->student, 'student')->create(['quantity' => 2]);

    $this->actingAs(User::factory()->specialist()->create())
        ->get(route('preorders.show', $product))
        ->assertInertia(fn (Assert $page) => $page
            ->component('preorders/show')
            ->where('product.students_count', 1)
            ->where('preorders.data.0.student_name', 'Juan Dela Cruz')
            ->where('preorders.data.0.student_email', 'delacruz.123456@sti.edu.ph')
            ->where('preorders.data.0.variant_label', 'S/M')
            ->where('preorders.data.0.quantity', 2)
        );
});

test('the preorder summary can be downloaded as a CSV file for Excel', function () {
    [, $small, $large] = preorderShirt();
    $small->update(['estore_item_code' => 'PRSH01-01']);
    Preorder::factory()->forVariant($small)->create(['quantity' => 2]);

    $response = $this->actingAs(User::factory()->specialist()->create())
        ->get(route('preorders.export'))
        ->assertOk()
        ->assertDownload('preorders-2026-10-03.csv');

    $lines = array_map('str_getcsv', explode("\n", trim(str_replace("\xEF\xBB\xBF", '', $response->streamedContent()))));

    expect($lines)->toBe([
        ['Product', 'Size / Color', 'eStore Item Code', 'Preorders Close', 'No. of Students', 'Total Pieces'],
        ['42nd Anniversary Shirt', 'S/M', 'PRSH01-01', 'Oct 20, 2026', '1', '2'],
        ['42nd Anniversary Shirt', 'M/L', '', 'Oct 20, 2026', '0', '0'],
    ]);
});

test('the specialist can move the close date to take more preorders', function () {
    [$product] = preorderShirt('2026-10-02');
    $this->actingAs(User::factory()->specialist()->create());

    $this->patch(route('preorders.close-date', $product), ['preorders_close_on' => '2026-09-30'])
        ->assertSessionHasErrors(['preorders_close_on' => 'The close date cannot be in the past.']);

    $this->patch(route('preorders.close-date', $product), ['preorders_close_on' => '2026-10-25'])
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.message', 'Preorders for 42nd Anniversary Shirt now close on Oct 25, 2026.');

    expect($product->refresh()->preorders_close_on->toDateString())->toBe('2026-10-25')
        ->and($product->acceptsPreorders())->toBeTrue();
});

test('a product that is no longer on preorder keeps its close date', function () {
    $product = Product::factory()->create(['name' => 'Lanyard', 'status' => ProductStatus::Available]);

    $this->actingAs(User::factory()->specialist()->create())
        ->patch(route('preorders.close-date', $product), ['preorders_close_on' => '2026-10-25'])
        ->assertSessionHasErrors(['preorders_close_on' => 'Lanyard is no longer a Preorder product.']);
});

test('a preorder product needs a close date that is not in the past', function () {
    $this->actingAs(User::factory()->specialist()->create());
    $form = [
        'name' => 'Anniversary Shirt', 'sold_by_piece' => '1', 'price' => '350', 'status' => 'draft', 'sale_price' => '',
        'low_stock_alert_at' => '5', 'photos' => [], 'packs' => [], 'options' => [],
        'variants' => [['combination' => '', 'estore_item_code' => '', 'estore_pack_key' => '', 'price' => '']],
    ];
    $product = Product::factory()->create(['status' => ProductStatus::Preorder, 'preorders_close_on' => '2026-10-01']);
    ProductVariant::factory()->for($product)->create();
    $product->photos()->create(['path' => 'products/a.jpg', 'position' => 0]);

    $this->put(route('products.update', $product), [...$form, 'status' => 'preorder', 'photos' => [['id' => $product->photos()->value('id'), 'label' => '']], 'preorders_close_on' => ''])
        ->assertSessionHasErrors(['preorders_close_on' => 'Choose the last day students can preorder.']);

    $this->put(route('products.update', $product), [...$form, 'status' => 'preorder', 'photos' => [['id' => $product->photos()->value('id'), 'label' => '']], 'preorders_close_on' => '2026-09-30'])
        ->assertSessionHasErrors(['preorders_close_on' => 'The close date cannot be in the past.']);

    $this->put(route('products.update', $product), [...$form, 'status' => 'preorder', 'photos' => [['id' => $product->photos()->value('id'), 'label' => '']], 'preorders_close_on' => '2026-10-01'])
        ->assertSessionHasNoErrors();
});

test('the storefront says until when a product can be preordered', function () {
    preorderShirt('2026-10-20');
    preorderShirt('2026-10-02', 'Closed Hoodie');

    $tiles = collect($this->get('/')->inertiaProps('comingSoon'))->keyBy('name');

    expect($tiles['42nd Anniversary Shirt'])->toMatchArray(['preorders_close_on' => '2026-10-20', 'accepts_preorders' => true])
        ->and($tiles['Closed Hoodie'])->toMatchArray(['accepts_preorders' => false]);
});

test('students land on the storefront and cannot open staff pages', function () {
    $this->actingAs($this->student);

    $this->get(route('dashboard'))->assertRedirect(route('home'));
    $this->get(route('products.index'))->assertForbidden();
    $this->get(route('preorders.index'))->assertForbidden();
    $this->get(route('purchase-orders.index'))->assertForbidden();
    $this->get(route('profile.edit'))->assertForbidden();
});
