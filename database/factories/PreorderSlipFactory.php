<?php

namespace Database\Factories;

use App\Models\PreorderSlip;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<PreorderSlip>
 */
class PreorderSlipFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'batch' => (string) Str::uuid(),
            'user_id' => User::factory()->student(),
            'product_id' => Product::factory(),
        ];
    }
}
