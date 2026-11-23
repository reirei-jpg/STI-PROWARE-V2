<?php

namespace Database\Factories;

use App\Enums\PaymentMethod;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Payment>
 */
class PaymentFactory extends Factory
{
    /**
     * A cash payment for an order, ₱500 received.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $amount = fake()->numberBetween(5000, 40000);

        return [
            'order_id' => Order::factory(),
            'user_id' => User::factory()->student(),
            'amount_centavos' => $amount,
            'method' => PaymentMethod::Cash,
            'amount_received_centavos' => 50000,
            'change_centavos' => 50000 - $amount,
            'received_by' => User::factory()->cashier(),
            'paid_at' => now(),
            'snapshot' => [
                'number' => null,
                'buyer_name' => 'Juan Dela Cruz',
                'buyer_id' => null,
                'section' => 'BSIT 1-A',
                'is_staff' => false,
                'lines' => [['quantity' => 1, 'item' => 'STI Lanyard', 'unit_price_centavos' => $amount, 'amount_centavos' => $amount]],
            ],
        ];
    }

    /** Paid by GCash with a 13-digit reference. */
    public function gcash(): static
    {
        return $this->state(fn (): array => [
            'method' => PaymentMethod::GCash,
            'amount_received_centavos' => null,
            'change_centavos' => null,
            'gcash_reference' => fake()->numerify('#############'),
        ]);
    }
}
