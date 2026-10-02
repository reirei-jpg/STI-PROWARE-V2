<?php

namespace Database\Factories;

use App\Enums\ProductStatus;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->randomElement(['42nd Anniversary Shirt', 'Chibi Keychain', 'Aquaflask', 'PE Shirt', 'Lanyard']),
            'sold_by_piece' => true,
            'price_centavos' => fake()->numberBetween(50, 800) * 100,
            'sale_price_centavos' => null,
            'status' => ProductStatus::Available,
        ];
    }

    public function status(ProductStatus $status): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => $status,
            'sale_price_centavos' => $status === ProductStatus::OnSale
                ? intdiv($attributes['price_centavos'], 2)
                : null,
        ]);
    }
}
