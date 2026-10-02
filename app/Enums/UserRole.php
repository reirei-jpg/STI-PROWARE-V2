<?php

namespace App\Enums;

/**
 * Who uses STI PROWARE.
 *
 * The PROWARE Specialist runs the day-to-day inventory work (uploading the
 * eStore purchase orders, recording deliveries). The School Admin approves
 * orders inside the eStore and only monitors them here. Students browse the
 * storefront and preorder; until Microsoft 365 sign-in is connected they
 * sign in with a PROWARE password.
 */
enum UserRole: string
{
    case Specialist = 'specialist';
    case SchoolAdmin = 'school_admin';
    case Student = 'student';

    public function label(): string
    {
        return match ($this) {
            self::Specialist => 'PROWARE Specialist',
            self::SchoolAdmin => 'School Admin',
            self::Student => 'Student',
        };
    }

    public function isStaff(): bool
    {
        return $this !== self::Student;
    }
}
