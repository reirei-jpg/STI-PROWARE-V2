<?php

namespace Database\Factories;

use App\Models\Product;
use App\Models\ProductPack;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ProductPack>
 */
class ProductPackFactory extends Factory
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
            'name' => 'Pack',
            'pieces' => fake()->randomElement([10, 12, 50, 100]),
            'sold_to_students' => false,
            'price_centavos' => null,
            'position' => 0,
        ];
    }

    /**
     * A pack students can buy at the given price.
     */
    public function soldToStudents(int $priceCentavos = 50000): static
    {
        return $this->state(fn (array $attributes) => [
            'sold_to_students' => true,
            'price_centavos' => $priceCentavos,
        ]);
    }
}
