<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * The demo student, Juan Dela Cruz, used for trying the student side and
 * for screenshots. Running it again does not create a second account.
 */
class DemoStudentSeeder extends Seeder
{
    public function run(): void
    {
        $student = User::query()->firstOrNew(['email' => 'delacruz.123456@sti.edu.ph']);

        if ($student->exists) {
            return;
        }

        $student->forceFill([
            'name' => 'Juan Dela Cruz',
            'role' => UserRole::Student,
            'password' => 'Demo@2026!',
            'email_verified_at' => now(),
        ])->save();
    }
}
