<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database with the demo staff accounts and the
     * demo student.
     */
    public function run(): void
    {
        User::factory()->specialist()->create([
            'name' => 'Carlo Mendoza',
            'email' => 'carlo.mendoza.emp0157@proware.sti.edu.ph',
            'password' => 'Demo@2026!',
        ]);

        User::factory()->schoolAdmin()->create([
            'name' => 'Liza Garcia',
            'email' => 'liza.garcia.adm2026@proware.sti.edu.ph',
            'password' => 'Demo@2026!',
        ]);

        $this->call(DemoStudentSeeder::class);
    }
}
