<?php

namespace Database\Factories;

use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PurchaseOrderItem>
 */
class PurchaseOrderItemFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $quantityOrdered = fake()->numberBetween(1, 50);
        $unitPriceCentavos = fake()->numberBetween(10, 500) * 100;

        return [
            'purchase_order_id' => PurchaseOrder::factory(),
            'row_number' => 1,
            'item_code' => strtoupper(fake()->bothify('PR??##-##')),
            'description' => 'Chibi Keychain Culinary',
            'stock_on_hand' => 0,
            'quantity_ordered' => $quantityOrdered,
            'quantity_delivered' => 0,
            'unit_price_centavos' => $unitPriceCentavos,
            'amount_centavos' => $quantityOrdered * $unitPriceCentavos,
        ];
    }
}
