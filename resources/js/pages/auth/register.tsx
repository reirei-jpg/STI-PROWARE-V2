import { Head, Link, useForm } from '@inertiajs/react';
import {
    Eye,
    EyeOff,
    IdCard,
    LoaderCircle,
    LockKeyhole,
    Mail,
    User,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { login } from '@/routes';
import { store } from '@/routes/register';

type RegisterForm = {
    name: string;
    last_name: string;
    student_id: string;
    section: string;
    email: string;
    password: string;
    password_confirmation: string;
    terms: boolean;
};

/**
 * The STI school email: the last name (letters and numbers only) and the
 * last 6 digits of the Student ID, as the server checks (CreateNewUser).
 */
function schoolEmail(studentId: string, lastName: string): string {
    const last = lastName
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

    return last !== '' && studentId.length === 11
        ? `${last}.${studentId.slice(-6)}@sti.edu.ph`
        : '';
}

/**
 * Temporary student registration, as on V1, until STI's Microsoft 365
 * sign-in is connected: name, last name, 11-digit Student ID, course /
 * section, the school email (filled in from the last name and Student ID),
 * and a password. The new student is signed in right away.
 */
export default function Register() {
    const [showPassword, setShowPassword] = useState(false);
    const form = useForm<RegisterForm>({
        name: '',
        last_name: '',
        student_id: '',
        section: '',
        email: '',
        password: '',
        password_confirmation: '',
        terms: false,
    });
    const { data, errors, processing } = form;

    // The email follows the last name and Student ID as they are typed.
    const update = (changes: Partial<RegisterForm>) => {
        const next = { ...data, ...changes };
        form.setData({
            ...next,
            email: schoolEmail(next.student_id, next.last_name),
        });
    };

    return (
        <>
            <Head title="Student Registration" />

            <p className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs leading-5 text-blue-900">
                For now, students register here with their STI school email.
                Signing in with Microsoft 365 will replace this soon.
            </p>

            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post(store().url, {
                        onFinish: () =>
                            form.reset('password', 'password_confirmation'),
                    });
                }}
                className="space-y-4"
            >
                <Field
                    icon={<User size={17} />}
                    error={errors.name}
                    input={
                        <input
                            value={data.name}
                            onChange={(event) =>
                                update({ name: event.target.value })
                            }
                            maxLength={120}
                            autoComplete="name"
                            placeholder="Full name, e.g. Juan Dela Cruz"
                            aria-label="Full name"
                            required
                            autoFocus
                        />
                    }
                />
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                        icon={<User size={17} />}
                        error={errors.last_name}
                        input={
                            <input
                                value={data.last_name}
                                onChange={(event) =>
                                    update({ last_name: event.target.value })
                                }
                                maxLength={60}
                                autoComplete="family-name"
                                placeholder="Last name"
                                aria-label="Last name"
                                required
                            />
                        }
                    />
                    <Field
                        icon={<IdCard size={17} />}
                        error={errors.student_id}
                        input={
                            <input
                                value={data.student_id}
                                onChange={(event) =>
                                    update({
                                        student_id: event.target.value
                                            .replace(/\D/g, '')
                                            .slice(0, 11),
                                    })
                                }
                                inputMode="numeric"
                                placeholder="Student ID (11 digits)"
                                aria-label="Student ID"
                                required
                            />
                        }
                    />
                </div>
                <Field
                    icon={<Users size={17} />}
                    error={errors.section}
                    input={
                        <input
                            value={data.section}
                            onChange={(event) =>
                                update({ section: event.target.value })
                            }
                            maxLength={40}
                            placeholder="Course / Section (optional), e.g. BSIT 1-A"
                            aria-label="Course / Section"
                        />
                    }
                />
                <Field
                    icon={<Mail size={17} />}
                    error={errors.email}
                    hint={
                        data.email === ''
                            ? 'Filled in from your last name and Student ID.'
                            : 'Your STI school email.'
                    }
                    input={
                        <input
                            value={data.email}
                            readOnly
                            placeholder="School email (filled in for you)"
                            aria-label="STI school email"
                            className="bg-slate-50"
                        />
                    }
                />
                <Field
                    icon={<LockKeyhole size={17} />}
                    error={errors.password}
                    hint="At least 8 characters, with a letter, a number and a symbol."
                    input={
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={data.password}
                            onChange={(event) =>
                                form.setData('password', event.target.value)
                            }
                            maxLength={255}
                            autoComplete="new-password"
                            placeholder="Password"
                            aria-label="Password"
                            required
                        />
                    }
                    trailing={
                        <button
                            type="button"
                            onClick={() => setShowPassword((shown) => !shown)}
                            className="text-slate-400 transition hover:text-blue-600"
                            aria-label={
                                showPassword ? 'Hide password' : 'Show password'
                            }
                        >
                            {showPassword ? (
                                <EyeOff size={17} />
                            ) : (
                                <Eye size={17} />
                            )}
                        </button>
                    }
                />
                <Field
                    icon={<LockKeyhole size={17} />}
                    error={errors.password_confirmation}
                    input={
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={data.password_confirmation}
                            onChange={(event) =>
                                form.setData(
                                    'password_confirmation',
                                    event.target.value,
                                )
                            }
                            maxLength={255}
                            autoComplete="new-password"
                            placeholder="Type the password again"
                            aria-label="Confirm password"
                            required
                        />
                    }
                />

                <label className="flex cursor-pointer items-start gap-2 px-2 text-sm text-slate-600">
                    <input
                        type="checkbox"
                        checked={data.terms}
                        onChange={(event) =>
                            form.setData('terms', event.target.checked)
                        }
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    This information is mine, and I am an STI College student.
                </label>
                {errors.terms && (
                    <p className="px-4 text-sm text-red-600">{errors.terms}</p>
                )}

                <button
                    type="submit"
                    disabled={processing}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-[#005BFF] via-[#0D6EFD] to-[#0045CC] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition hover:-translate-y-0.5 hover:from-blue-600 hover:to-blue-800 focus:ring-4 focus:ring-blue-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {processing && (
                        <LoaderCircle size={17} className="animate-spin" />
                    )}
                    {processing ? 'Creating your account...' : 'Register'}
                </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
                Already have an account?{' '}
                <Link
                    href={login()}
                    className="font-semibold text-blue-600 hover:text-blue-700"
                >
                    Log in
                </Link>
            </p>
        </>
    );
}

/** A V1 round field with its icon, an optional hint, and its error. */
function Field({
    icon,
    input,
    error,
    hint,
    trailing,
}: {
    icon: ReactNode;
    input: ReactNode;
    error?: string;
    hint?: string;
    trailing?: ReactNode;
}) {
    return (
        <div>
            <div
                className={`relative flex items-center rounded-full border transition focus-within:ring-4 ${
                    error
                        ? 'border-red-400 focus-within:border-red-500 focus-within:ring-red-100'
                        : 'border-slate-300 focus-within:border-[#0D6EFD] focus-within:ring-blue-100'
                } [&_input]:w-full [&_input]:rounded-full [&_input]:bg-transparent [&_input]:py-3 [&_input]:pr-5 [&_input]:pl-12 [&_input]:text-sm [&_input]:font-medium [&_input]:text-slate-900 [&_input]:outline-none [&_input]:placeholder:text-slate-400`}
            >
                <span className="pointer-events-none absolute left-4 text-slate-500">
                    {icon}
                </span>
                {input}
                {trailing && (
                    <span className="absolute right-4 flex">{trailing}</span>
                )}
            </div>
            {error ? (
                <p className="mt-1.5 px-4 text-xs text-red-600">{error}</p>
            ) : (
                hint && (
                    <p className="mt-1.5 px-4 text-xs text-slate-500">{hint}</p>
                )
            )}
        </div>
    );
}

Register.layout = {
    title: 'Student Registration',
    description: 'Create your STI PROWARE account with your school email.',
};
