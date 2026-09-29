<?php

use App\Enums\ProductStatus;
use App\Models\Product;
use App\Models\ProductPhoto;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Storage::fake('public');
});

/**
 * A valid Add Product form, changed by $overrides.
 *
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function productForm(array $overrides = []): array
{
    return array_merge([
        'name' => '42nd Anniversary Shirt',
        'price' => '350',
        'status' => 'available',
        'sale_price' => '',
        'photos' => [
            ['file' => UploadedFile::fake()->image('front.jpg'), 'label' => 'Front'],
        ],
        'options' => [],
        'variants' => [['combination' => '', 'estore_item_code' => '', 'price' => '']],
    ], $overrides);
}

test('only the specialist can manage products', function () {
    $this->actingAs(User::factory()->schoolAdmin()->create());

    $this->get(route('products.index'))->assertForbidden();
    $this->get(route('products.create'))->assertForbidden();
    $this->post(route('products.store'), productForm())->assertForbidden();
});

test('a specialist can add a product with photos, options and variants', function () {
    $this->actingAs(User::factory()->specialist()->create())
        ->post(route('products.store'), productForm([
            'name' => '  Aquaflask  ',
            'price' => '850',
            'photos' => [
                ['file' => UploadedFile::fake()->image('front.jpg'), 'label' => 'Front'],
                ['file' => UploadedFile::fake()->image('side.png'), 'label' => ''],
            ],
            'options' => [
                ['name' => 'Color', 'choices' => ['Blue', 'Black']],
                ['name' => 'Capacity', 'choices' => ['22 oz', '32 oz']],
            ],
            'variants' => [
                ['combination' => 'Color: Blue | Capacity: 22 oz', 'estore_item_code' => 'prtm01 – 01', 'price' => ''],
                ['combination' => 'Color: Blue | Capacity: 32 oz', 'estore_item_code' => '', 'price' => '950.50'],
                ['combination' => 'Color: Black | Capacity: 22 oz', 'estore_item_code' => '', 'price' => ''],
                ['combination' => 'Color: Black | Capacity: 32 oz', 'estore_item_code' => '', 'price' => ''],
            ],
        ]))
        ->assertRedirect(route('products.index'))
        ->assertSessionHasNoErrors();

    $product = Product::sole();

    expect($product)
        ->name->toBe('Aquaflask')
        ->price_centavos->toBe(85000)
        ->status->toBe(ProductStatus::Available)
        ->sale_price_centavos->toBeNull()
        ->and($product->photos->pluck('label')->all())->toBe(['Front', null])
        ->and($product->mainPhoto->label)->toBe('Front')
        ->and($product->options->map->only(['name', 'choices'])->all())->toBe([
            ['name' => 'Color', 'choices' => ['Blue', 'Black']],
            ['name' => 'Capacity', 'choices' => ['22 oz', '32 oz']],
        ])
        ->and($product->variants->map->only(['combination', 'estore_item_code', 'price_centavos'])->all())->toBe([
            ['combination' => 'Color: Blue | Capacity: 22 oz', 'estore_item_code' => 'PRTM01-01', 'price_centavos' => null],
            ['combination' => 'Color: Blue | Capacity: 32 oz', 'estore_item_code' => null, 'price_centavos' => 95050],
            ['combination' => 'Color: Black | Capacity: 22 oz', 'estore_item_code' => null, 'price_centavos' => null],
            ['combination' => 'Color: Black | Capacity: 32 oz', 'estore_item_code' => null, 'price_centavos' => null],
        ]);

    foreach ($product->photos as $photo) {
        Storage::disk('public')->assertExists($photo->path);
    }
});

test('a product without options gets one default variant', function () {
    $this->actingAs(User::factory()->specialist()->create())
        ->post(route('products.store'), productForm([
            'variants' => [['combination' => '', 'estore_item_code' => 'PRCU01-01', 'price' => '']],
        ]));

    expect(ProductVariant::sole())
        ->combination->toBe('')
        ->choices->toBe([])
        ->estore_item_code->toBe('PRCU01-01');
});

test('an on sale product keeps its sale price', function () {
    $this->actingAs(User::factory()->specialist()->create())
        ->post(route('products.store'), productForm(['status' => 'on_sale', 'sale_price' => '300']))
        ->assertSessionHasNoErrors();

    expect(Product::sole())
        ->status->toBe(ProductStatus::OnSale)
        ->price_centavos->toBe(35000)
        ->sale_price_centavos->toBe(30000);
});

test('a draft can be saved without a photo but other statuses cannot', function (string $status, bool $allowed) {
    $response = $this->actingAs(User::factory()->specialist()->create())
        ->post(route('products.store'), productForm(['status' => $status, 'photos' => []]));

    if ($allowed) {
        $response->assertSessionHasNoErrors();
    } else {
        $response->assertSessionHasErrors(['photos' => 'Add at least one photo. Only a Draft can be saved without a photo.']);
    }
})->with([
    'draft' => ['draft', true],
    'preorder' => ['preorder', false],
    'available' => ['available', false],
]);

test('the form explains what is wrong', function (array $overrides, string $field, string $message) {
    $this->actingAs(User::factory()->specialist()->create())
        ->post(route('products.store'), productForm($overrides))
        ->assertSessionHasErrors([$field => $message]);

    expect(Product::count())->toBe(0);
})->with([
    'no name' => [['name' => ''], 'name', 'Enter the product name.'],
    'no price' => [['price' => ''], 'price', 'Enter the student price.'],
    'price in words' => [['price' => 'three fifty'], 'price', 'Enter the student price in pesos, e.g. 350 or 350.50.'],
    'on sale without sale price' => [['status' => 'on_sale'], 'sale_price', 'Enter the sale price for a product On Sale.'],
    'sale price not lower' => [['status' => 'on_sale', 'sale_price' => '350'], 'sale_price', 'The sale price must be lower than the student price.'],
    'photo not a picture' => [['photos' => [['file' => UploadedFile::fake()->create('po.pdf', 10, 'application/pdf'), 'label' => '']]], 'photos.0.file', 'Photos must be JPG, PNG or WEBP pictures.'],
    'photo too large' => [['photos' => [['file' => UploadedFile::fake()->image('big.jpg')->size(5121), 'label' => '']]], 'photos.0.file', 'Each photo must be 5 MB or smaller.'],
    'option without name' => [['options' => [['name' => '', 'choices' => ['S']]]], 'options.0.name', 'Give every option a name, e.g. Size or Color.'],
    'two options with the same name' => [['options' => [['name' => 'Size', 'choices' => ['S']], ['name' => 'size', 'choices' => ['M']]]], 'options.0.name', 'Two options have the same name.'],
    'same choice twice' => [['options' => [['name' => 'Size', 'choices' => ['M', 'm']]]], 'options.0.choices', 'The option "Size" has the same choice twice.'],
]);

test('an eStore Item Code cannot be used twice', function () {
    $this->actingAs(User::factory()->specialist()->create())
        ->post(route('products.store'), productForm([
            'options' => [['name' => 'Size', 'choices' => ['S', 'M']]],
            'variants' => [
                ['combination' => 'Size: S', 'estore_item_code' => 'PRSH01-01', 'price' => ''],
                ['combination' => 'Size: M', 'estore_item_code' => 'prsh01 - 01', 'price' => ''],
            ],
        ]))
        ->assertSessionHasErrors(['variants.1.estore_item_code' => 'The eStore Item Code PRSH01-01 is used twice.']);
});

test('an eStore Item Code already on another product is refused', function () {
    $other = Product::factory()->create(['name' => 'Chibi Keychain']);
    ProductVariant::factory()->for($other)->create(['estore_item_code' => 'PRCU01-01']);

    $this->actingAs(User::factory()->specialist()->create())
        ->post(route('products.store'), productForm([
            'variants' => [['combination' => '', 'estore_item_code' => 'PRCU01-01', 'price' => '']],
        ]))
        ->assertSessionHasErrors(['variants.0.estore_item_code' => 'The eStore Item Code PRCU01-01 already belongs to "Chibi Keychain".']);
});

test('editing keeps, removes, adds and reorders photos', function () {
    $product = Product::factory()->create();
    $front = ProductPhoto::factory()->for($product)->create(['label' => 'Front', 'position' => 0]);
    $back = ProductPhoto::factory()->for($product)->create(['label' => 'Back', 'position' => 1]);
    Storage::disk('public')->put($front->path, 'front');
    Storage::disk('public')->put($back->path, 'back');

    $this->actingAs(User::factory()->specialist()->create())
        ->put(route('products.update', $product), productForm([
            'photos' => [
                ['file' => UploadedFile::fake()->image('side.jpg'), 'label' => 'Side'],
                ['id' => $front->id, 'label' => 'Front view'],
            ],
        ]))
        ->assertSessionHasNoErrors();

    $photos = $product->fresh()->photos;

    expect($photos->pluck('label')->all())->toBe(['Side', 'Front view'])
        ->and($photos->last()->id)->toBe($front->id)
        ->and(ProductPhoto::find($back->id))->toBeNull();

    Storage::disk('public')->assertMissing($back->path);
    Storage::disk('public')->assertExists($front->path);
});

test('editing options keeps the item codes of variants that still exist', function () {
    $specialist = User::factory()->specialist()->create();
    $this->actingAs($specialist)->post(route('products.store'), productForm([
        'options' => [['name' => 'Size', 'choices' => ['S', 'M']]],
        'variants' => [
            ['combination' => 'Size: S', 'estore_item_code' => 'PRSH01-01', 'price' => ''],
            ['combination' => 'Size: M', 'estore_item_code' => 'PRSH01-02', 'price' => ''],
        ],
    ]));
    $product = Product::sole();
    $small = $product->variants()->where('combination', 'Size: S')->sole();

    $this->put(route('products.update', $product), productForm([
        'photos' => [['id' => $product->mainPhoto->id, 'label' => 'Front']],
        'options' => [['name' => 'Size', 'choices' => ['S', 'L']]],
        'variants' => [
            ['combination' => 'Size: S', 'estore_item_code' => 'PRSH01-01', 'price' => ''],
            ['combination' => 'Size: L', 'estore_item_code' => 'PRSH01-03', 'price' => ''],
        ],
    ]))->assertSessionHasNoErrors();

    $variants = $product->fresh()->variants;

    expect($variants->pluck('estore_item_code', 'combination')->all())->toBe([
        'Size: S' => 'PRSH01-01',
        'Size: L' => 'PRSH01-03',
    ])->and($variants->first()->id)->toBe($small->id);
});

test('the list can be searched by name and filtered by status', function () {
    Product::factory()->create(['name' => '42nd Anniversary Shirt', 'status' => ProductStatus::Preorder]);
    Product::factory()->create(['name' => 'Anniversary Lanyard', 'status' => ProductStatus::Available]);
    Product::factory()->create(['name' => 'Chibi Keychain', 'status' => ProductStatus::Preorder]);

    $this->actingAs(User::factory()->specialist()->create())
        ->get(route('products.index', ['search' => 'anniversary', 'status' => 'preorder']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('products/index')
            ->has('products.data', 1)
            ->where('products.data.0.name', '42nd Anniversary Shirt')
            ->where('products.data.0.status_label', 'Preorder')
            ->where('filters', ['search' => 'anniversary', 'status' => 'preorder'])
        );
});

test('the edit form gets the product as the specialist saved it', function () {
    $product = Product::factory()->create(['name' => 'PE Shirt', 'price_centavos' => 35050, 'status' => ProductStatus::Draft]);
    ProductVariant::factory()->for($product)->create(['estore_item_code' => 'PRPE01-01', 'price_centavos' => 40000]);

    $this->actingAs(User::factory()->specialist()->create())
        ->get(route('products.edit', $product))
        ->assertInertia(fn (Assert $page) => $page
            ->component('products/form')
            ->where('product.name', 'PE Shirt')
            ->where('product.price', '350.50')
            ->where('product.status', 'draft')
            ->where('product.variants.0.estore_item_code', 'PRPE01-01')
            ->where('product.variants.0.price', '400')
        );
});
