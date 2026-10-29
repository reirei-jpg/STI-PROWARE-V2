import { Head, Link, useForm } from '@inertiajs/react';
import {
    Briefcase,
    GraduationCap,
    IdCard,
    LockKeyhole,
    Mail,
    User,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import {
    AuthField,
    AuthSubmitButton,
    ShowPasswordButton,
    authLinkClasses,
} from '@/components/auth-field';
import { login } from '@/routes';
import { store } from '@/routes/register';
import { cn } from '@/lib/utils';

type AccountType = 'student' | 'employee';

type RegisterForm = {
    account_type: AccountType;
    name: string;
    last_name: string;
    student_id: string;
    employee_id: string;
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
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

    return last !== '' && studentId.length === 11
        ? `${last}.${studentId.slice(-6)}@sti.edu.ph`
        : '';
}

/**
 * Temporary registration, as on V1, until STI's Microsoft 365 sign-in is
 * connected. A student gives their name, last name, 11-digit Student ID,
 * course / section, the school email (filled in from the last name and
 * Student ID) and a password. STI staff (teachers and employees) choose
 * STI Staff and give their name, Employee ID, office / department, their
 * STI email and a password. The new account is signed in right away.
 */
export default function Register() {
    const [showPassword, setShowPassword] = useState(false);
    const form = useForm<RegisterForm>({
        account_type: 'student',
        name: '',
        last_name: '',
        student_id: '',
        employee_id: '',
        section: '',
        email: '',
        password: '',
        password_confirmation: '',
        terms: false,
    });
    const { data, errors, processing } = form;
    const isEmployee = data.account_type === 'employee';

    // A student's email follows the last name and Student ID as they are
    // typed; STI staff type their own.
    const update = (changes: Partial<RegisterForm>) => {
        const next = { ...data, ...changes };
        form.setData({
            ...next,
            email:
                next.account_type === 'employee'
                    ? next.email
                    : schoolEmail(next.student_id, next.last_name),
        });
    };
    const chooseType = (accountType: AccountType) => {
        if (accountType === data.account_type) {
            return;
        }

        form.clearErrors();
        form.setData({
            ...data,
            account_type: accountType,
            email:
                accountType === 'employee'
                    ? ''
                    : schoolEmail(data.student_id, data.last_name),
        });
    };

    return (
        <>
            <Head title="Registration" />

            <p className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs leading-5 text-blue-900">
                For now, students and STI staff register here with their STI
                email. Signing in with Microsoft 365 will replace this soon.
            </p>

            <div
                role="radiogroup"
                aria-label="I am a"
                className="mb-4 grid grid-cols-2 gap-2 rounded-full bg-slate-100 p-1"
            >
                {(
                    [
                        ['student', 'Student', GraduationCap],
                        ['employee', 'STI Staff', Briefcase],
                    ] as const
                ).map(([type, label, Icon]) => (
                    <button
                        key={type}
                        type="button"
                        role="radio"
                        aria-checked={data.account_type === type}
                        onClick={() => chooseType(type)}
                        className={cn(
                            'flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition',
                            data.account_type === type
                                ? 'bg-white text-[#0D6EFD] shadow-sm'
                                : 'text-slate-500 hover:text-slate-700',
                        )}
                    >
                        <Icon size={16} />
                        {label}
                    </button>
                ))}
            </div>

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
                <AuthField
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
                {isEmployee ? (
                    <>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <AuthField
                                icon={<IdCard size={17} />}
                                error={errors.employee_id}
                                input={
                                    <input
                                        value={data.employee_id}
                                        onChange={(event) =>
                                            update({
                                                employee_id: event.target.value
                                                    .replace(
                                                        /[^A-Za-z0-9-]/g,
                                                        '',
                                                    )
                                                    .slice(0, 20),
                                            })
                                        }
                                        placeholder="Employee ID"
                                        aria-label="Employee ID"
                                        required
                                    />
                                }
                            />
                            <AuthField
                                icon={<Users size={17} />}
                                error={errors.section}
                                input={
                                    <input
                                        value={data.section}
                                        onChange={(event) =>
                                            update({
                                                section: event.target.value,
                                            })
                                        }
                                        maxLength={40}
                                        placeholder="Office / Department"
                                        aria-label="Office / Department"
                                        required
                                    />
                                }
                            />
                        </div>
                        <AuthField
                            icon={<Mail size={17} />}
                            error={errors.email}
                            hint="Your STI email, ending in sti.edu.ph."
                            input={
                                <input
                                    type="email"
                                    value={data.email}
                                    onChange={(event) =>
                                        update({ email: event.target.value })
                                    }
                                    maxLength={255}
                                    autoComplete="email"
                                    placeholder="STI email"
                                    aria-label="STI email"
                                    required
                                />
                            }
                        />
                    </>
                ) : (
                    <StudentFields
                        data={data}
                        errors={errors}
                        update={update}
                    />
                )}
                <AuthField
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
                        <ShowPasswordButton
                            shown={showPassword}
                            onToggle={() => setShowPassword((shown) => !shown)}
                        />
                    }
                />
                <AuthField
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
                    {isEmployee
                        ? 'This information is mine, and I work at STI College.'
                        : 'This information is mine, and I am an STI College student.'}
                </label>
                {errors.terms && (
                    <p className="px-4 text-sm text-red-600">{errors.terms}</p>
                )}

                <AuthSubmitButton
                    processing={processing}
                    label="Register"
                    processingLabel="Creating your account..."
                />
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
                Already have an account?{' '}
                <Link href={login()} className={authLinkClasses}>
                    Log in
                </Link>
            </p>
        </>
    );
}

/**
 * A student's last name, Student ID, course / section and the school email
 * filled in from them.
 */
function StudentFields({
    data,
    errors,
    update,
}: {
    data: RegisterForm;
    errors: Partial<Record<keyof RegisterForm, string>>;
    update: (changes: Partial<RegisterForm>) => void;
}) {
    return (
        <>
            <div className="grid gap-4 sm:grid-cols-2">
                <AuthField
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
                <AuthField
                    icon={<IdCard size={17} />}
                    error={errors.student_id}
                    hint="11 digits"
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
                            placeholder="Student ID"
                            aria-label="Student ID"
                            required
                        />
                    }
                />
            </div>
            <AuthField
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
            <AuthField
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
        </>
    );
}

Register.layout = {
    title: 'Registration',
    description: 'Create your STI PROWARE account with your STI email.',
};
