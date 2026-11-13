<?php

namespace Database\Factories;

use App\Models\Product;
use App\Models\ProductAnnouncement;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ProductAnnouncement>
 */
class ProductAnnouncementFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'product_id' => Product::factory(),
            'sent_by' => User::factory()->specialist(),
            'top' => 10,
            'recipients' => 10,
            'note' => null,
        ];
    }
}
