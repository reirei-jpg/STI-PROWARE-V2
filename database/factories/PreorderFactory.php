<?php

namespace Database\Factories;

use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\Preorder;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Preorder>
 */
class PreorderFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory()->student(),
            'product_id' => Product::factory()->status(ProductStatus::Preorder),
            'product_variant_id' => fn (array $attributes) => ProductVariant::factory()->create(['product_id' => $attributes['product_id']])->id,
            'quantity' => fake()->numberBetween(1, 3),
            'status' => PreorderStatus::Active,
            'cancelled_at' => null,
        ];
    }

    /**
     * A preorder for this variant of its product.
     */
    public function forVariant(ProductVariant $variant): static
    {
        return $this->state(fn (array $attributes) => [
            'product_id' => $variant->product_id,
            'product_variant_id' => $variant->id,
        ]);
    }

    /**
     * A preorder the student cancelled.
     */
    public function cancelled(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => PreorderStatus::Cancelled,
            'cancelled_at' => now(),
        ]);
    }
}
