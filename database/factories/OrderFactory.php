<?php

namespace Database\Factories;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Order>
 */
class OrderFactory extends Factory
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
            'status' => OrderStatus::Placed,
            'total_centavos' => 35000,
            'pick_up_by' => now()->addDays(Order::PICK_UP_DAYS)->endOfDay(),
        ];
    }

    /**
     * Give the order its PW number once it has an id.
     */
    public function configure(): static
    {
        return $this->afterCreating(function (Order $order): void {
            $order->forceFill(['number' => Order::numberFor($order->id)])->save();
        });
    }
}
