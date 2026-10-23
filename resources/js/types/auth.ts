export type UserRole = 'specialist' | 'school_admin' | 'student';

export type User = {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    /** A student's 11-digit Student ID (null for staff and older accounts). */
    student_id?: string | null;
    avatar?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
};

export type Auth = {
    user: User;
};
