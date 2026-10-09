<?php

namespace Database\Factories;

use App\Models\Product;
use App\Models\UniformSet;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<UniformSet>
 */
class UniformSetFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->bothify('BS??'),
            'blouse_product_id' => Product::factory(),
            'polo_product_id' => Product::factory(),
            'pants_product_id' => Product::factory(),
        ];
    }
}
