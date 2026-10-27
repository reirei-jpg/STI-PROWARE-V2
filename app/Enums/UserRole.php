<?php

namespace App\Enums;

/**
 * Who uses STI PROWARE.
 *
 * The PROWARE Specialist runs the day-to-day inventory work (uploading the
 * eStore purchase orders, recording deliveries). The School Admin approves
 * orders inside the eStore and only monitors them here. Students and STI
 * staff (teachers and employees, shown as "STI Staff") are the buyers: they
 * browse the storefront, order and preorder; until Microsoft 365 sign-in is
 * connected they sign in with a PROWARE password.
 */
enum UserRole: string
{
    case Specialist = 'specialist';
    case SchoolAdmin = 'school_admin';
    case Student = 'student';
    case Employee = 'employee';

    public function label(): string
    {
        return match ($this) {
            self::Specialist => 'PROWARE Specialist',
            self::SchoolAdmin => 'School Admin',
            self::Student => 'Student',
            self::Employee => 'STI Staff',
        };
    }

    /**
     * Students and STI staff buy from the store; the PROWARE Specialist and
     * the School Admin run it.
     */
    public function isBuyer(): bool
    {
        return $this === self::Student || $this === self::Employee;
    }
}
