<?php

namespace Database\Factories;

use App\Enums\ProductStatus;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ProductVariant>
 */
class ProductVariantFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'product_id' => Product::factory(),
            'combination' => '',
            'status' => ProductStatus::Available,
            'choices' => [],
            'estore_item_code' => null,
            'estore_pack_id' => null,
            'price_centavos' => null,
            'position' => 0,
        ];
    }
}
