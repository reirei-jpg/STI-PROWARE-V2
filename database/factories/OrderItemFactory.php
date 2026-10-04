<?php

namespace Database\Factories;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ProductVariant;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OrderItem>
 */
class OrderItemFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'order_id' => Order::factory(),
            // The variant first, so the product can be read from it.
            'product_variant_id' => ProductVariant::factory(),
            'product_id' => fn (array $attributes) => ProductVariant::query()->whereKey($attributes['product_variant_id'])->value('product_id'),
            'product_name' => 'Lanyard',
            'variant_label' => null,
            'unit_name' => 'Piece',
            'pieces_per_unit' => 1,
            'quantity' => 1,
            'unit_price_centavos' => 8000,
            'line_total_centavos' => 8000,
        ];
    }
}
