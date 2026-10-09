<?php

namespace Database\Factories;

use App\Enums\UniformTop;
use App\Models\FreeUniformGroup;
use App\Models\FreeUniformStudent;
use App\Models\ProductVariant;
use App\Models\UniformSet;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FreeUniformStudent>
 */
class FreeUniformStudentFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'free_uniform_group_id' => FreeUniformGroup::factory(),
            'uniform_set_id' => UniformSet::factory(),
            'name' => fake()->name(),
            'enrollment_form_number' => fake()->unique()->numerify('EF-#####'),
            'course_section' => null,
            'top_kind' => UniformTop::Polo,
            'top_variant_id' => ProductVariant::factory(),
            'pants_variant_id' => ProductVariant::factory(),
            'top_movement_id' => null,
            'pants_movement_id' => null,
        ];
    }
}
