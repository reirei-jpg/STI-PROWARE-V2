<?php

namespace Database\Factories;

use App\Models\FreeUniformGroup;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FreeUniformGroup>
 */
class FreeUniformGroupFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'enrolled_on' => now()->toDateString(),
            'note' => null,
            'recorded_by' => User::factory()->specialist(),
        ];
    }
}
