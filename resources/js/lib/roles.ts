import type { User } from '@/types';

/**
 * Students and STI staff (teachers and employees) buy from the store; the
 * PROWARE Specialist and the School Admin run it.
 */
export function isBuyer(user: User | null | undefined): boolean {
    return user?.role === 'student' || user?.role === 'employee';
}

/**
 * The Specialist and the School Admin manage the products and the stock:
 * Scan eStore PO, Stock In, Items to Link, Products, Put on Sale and
 * Correct stock (panel revision, 24 Nov 2026). Orders, preorders, Free
 * Uniforms, Sales Reports and Maintenance stay the Specialist's.
 */
export function managesStock(user: User | null | undefined): boolean {
    return user?.role === 'specialist' || user?.role === 'school_admin';
}

/** What the store says to the Specialist and the School Admin, who do not buy. */
export const NOT_A_BUYER =
    'Buying is for students and STI staff. You are signed in with a PROWARE Specialist or School Admin account.';
