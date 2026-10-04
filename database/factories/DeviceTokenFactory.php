<?php

namespace Database\Factories;

use App\Models\DeviceToken;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<DeviceToken>
 */
class DeviceTokenFactory extends Factory
{
    /**
     * A student's phone, registered from a real sign-in (Sanctum token) of
     * the same student.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory()->student(),
            'personal_access_token_id' => fn (array $attributes): int => User::query()->whereKey($attributes['user_id'])->firstOrFail()->createToken('Phone')->accessToken->id,
            'token' => Str::random(160),
            'device_name' => 'realme RMX3999',
        ];
    }
}
