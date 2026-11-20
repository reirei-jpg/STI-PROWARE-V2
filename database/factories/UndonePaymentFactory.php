<?php

namespace Database\Factories;

use App\Models\Order;
use App\Models\UndonePayment;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<UndonePayment>
 */
class UndonePaymentFactory extends Factory
{
    /**
     * An order's payment undone by the cashier.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'order_id' => Order::factory(),
            'amount_centavos' => fake()->numberBetween(5000, 200000),
            'paid_at' => now(),
            'paid_by' => User::factory()->cashier(),
            'undone_by' => User::factory()->cashier(),
            'reason' => 'Scanned the wrong slip.',
        ];
    }
}
