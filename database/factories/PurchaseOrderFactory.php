<?php

namespace Database\Factories;

use App\Models\PurchaseOrder;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PurchaseOrder>
 */
class PurchaseOrderFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'order_number' => (string) fake()->unique()->numberBetween(10000, 99999),
            'school' => 'STI COLLEGE ORMOC',
            'ordered_by' => 'Manilyn Bioc',
            'uploaded_by' => User::factory()->specialist(),
            'date_ordered' => fake()->dateTimeBetween('-1 month')->format('Y-m-d'),
            'time_ordered' => null,
            'category' => 'PROWARE',
            'total_amount_centavos' => 42000,
            'original_file_name' => 'Pasted email',
            'document_path' => 'purchase-orders/'.fake()->uuid().'.txt',
        ];
    }
}
