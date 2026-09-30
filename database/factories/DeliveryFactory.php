<?php

namespace Database\Factories;

use App\Models\Delivery;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Delivery>
 */
class DeliveryFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'received_on' => now()->toDateString(),
            'sales_invoice_number' => '12100000'.fake()->unique()->numerify('#####'),
            'delivery_receipt_number' => null,
            'note' => null,
            'recorded_by' => User::factory()->specialist(),
        ];
    }
}
