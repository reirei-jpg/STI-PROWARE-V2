<?php

use App\Models\Product;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\DemoStorefrontSeeder;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');
    $this->travelTo(CarbonImmutable::parse('2026-10-03 10:00', 'Asia/Manila'));
});

test('the demo products fill coming soon and on sale, and running it again adds nothing', function () {
    User::factory()->specialist()->create();
    $existing = Product::factory()->create(['name' => 'STI Lanyard', 'price_centavos' => 9900]);

    $this->seed(DemoStorefrontSeeder::class);
    $this->seed(DemoStorefrontSeeder::class);

    $page = $this->get('/')->assertOk();

    expect(collect($page->inertiaProps('comingSoon'))->pluck('name')->sort()->values()->all())
        ->toBe(['42nd Anniversary Shirt', 'Intramurals Jersey', 'STI Cap', 'STI Mug', 'STI Notebook Set', 'STI Tote Bag'])
        ->and(collect($page->inertiaProps('onSale'))->pluck('name')->all())
        ->toBe(['STI Pin Set', 'STI Ballpen', 'STI ID Holder', 'STI Sticker Pack'])
        ->and($existing->refresh()->price_centavos)->toBe(9900)
        ->and(Product::query()->where('name', 'STI Ballpen')->sole()->variants()->sole()->stock_on_hand)->toBe(120);

    Storage::disk('public')->assertExists('products/demo-sti-ballpen.png');
});
