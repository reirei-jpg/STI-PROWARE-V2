<?php

namespace App\Enums;

/**
 * The staff roles that use STI PROWARE.
 *
 * The PROWARE Specialist runs the day-to-day inventory work (uploading the
 * eStore purchase orders, recording deliveries). The School Admin approves
 * orders inside the eStore and only monitors them here.
 */
enum UserRole: string
{
    case Specialist = 'specialist';
    case SchoolAdmin = 'school_admin';

    public function label(): string
    {
        return match ($this) {
            self::Specialist => 'PROWARE Specialist',
            self::SchoolAdmin => 'School Admin',
        };
    }
}
