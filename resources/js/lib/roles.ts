import type { User } from '@/types';

/**
 * Students and STI staff (teachers and employees) buy from the store; the
 * PROWARE Specialist and the School Admin run it.
 */
export function isBuyer(user: User | null | undefined): boolean {
    return user?.role === 'student' || user?.role === 'employee';
}

/** What the store says to the Specialist and the School Admin, who do not buy. */
export const NOT_A_BUYER =
    'Buying is for students and STI staff. You are signed in with a PROWARE Specialist or School Admin account.';
