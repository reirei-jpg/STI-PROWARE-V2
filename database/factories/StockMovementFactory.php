<?php

namespace Database\Factories;

use App\Enums\StockMovementType;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<StockMovement>
 */
class StockMovementFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $quantity = fake()->numberBetween(1, 50);

        return [
            'product_variant_id' => ProductVariant::factory(),
            'type' => StockMovementType::Delivery,
            'quantity' => $quantity,
            'balance_after' => $quantity,
            'delivery_item_id' => null,
            'units_received' => $quantity,
            'unit_name' => 'Piece',
            'pieces_per_unit' => 1,
            'reason' => null,
            'note' => null,
            'recorded_by' => null,
        ];
    }
}
