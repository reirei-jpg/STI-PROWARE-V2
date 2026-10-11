import { Form, Head, Link } from '@inertiajs/react';
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from 'lucide-react';
import { useState } from 'react';
import PasskeyVerify from '@/components/passkey-verify';
import { MicrosoftLogo } from '@/components/sign-in-prompt';
import { home, register } from '@/routes';
import { store } from '@/routes/login';
import { request } from '@/routes/password';

type Props = {
    status?: string;
    canResetPassword: boolean;
};

const fieldClasses =
    'w-full rounded-full border bg-transparent py-3 pl-12 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400';

/**
 * PROWARE's sign-in, laid out as on V1: students sign in with their STI
 * Microsoft 365 account; staff (and demo accounts) with their PROWARE
 * email and password below.
 */
export default function Login({ status, canResetPassword }: Props) {
    const [showPassword, setShowPassword] = useState(false);
    const [triedMicrosoft, setTriedMicrosoft] = useState(false);

    return (
        <>
            <Head title="PROWARE Login" />

            <PasskeyVerify />

            {status && (
                <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    {status}
                </div>
            )}

            <button
                type="button"
                onClick={() => setTriedMicrosoft(true)}
                className="flex w-full items-center justify-center gap-3 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50 focus:ring-4 focus:ring-blue-100 focus:outline-none"
                data-test="microsoft-sign-in-button"
            >
                <MicrosoftLogo className="h-5 w-5" />
                Sign in with Microsoft 365
            </button>
            <p className="mt-2 text-center text-xs text-slate-500">
                For students, with your STI account (@sti.edu.ph)
            </p>

            {triedMicrosoft && (
                <div
                    role="status"
                    className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
                >
                    <p className="font-bold">Not connected yet</p>
                    <p className="mt-1">
                        Microsoft 365 sign-in is waiting for STI&apos;s
                        Microsoft account details. For now, sign in with your
                        email and password below, or register as a student.
                    </p>
                </div>
            )}

            <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-bold tracking-wide text-slate-400 uppercase">
                    or with your PROWARE email
                </span>
                <span className="h-px flex-1 bg-slate-200" />
            </div>

            <Form
                {...store.form()}
                resetOnSuccess={['password']}
                className="space-y-4"
            >
                {({ processing, errors }) => (
                    <>
                        <div>
                            <label htmlFor="email" className="sr-only">
                                Email address
                            </label>
                            <div className="relative">
                                <Mail
                                    size={17}
                                    className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-500"
                                />
                                <input
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    autoComplete="email"
                                    maxLength={255}
                                    placeholder="Email address"
                                    className={`${fieldClasses} pr-5 ${
                                        errors.email
                                            ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100'
                                            : 'border-slate-300 focus:border-[#0D6EFD] focus:ring-4 focus:ring-blue-100'
                                    }`}
                                />
                            </div>
                            {errors.email && (
                                <p className="mt-2 px-4 text-sm text-red-600">
                                    {errors.email}
                                </p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="password" className="sr-only">
                                Password
                            </label>
                            <div className="relative">
                                <LockKeyhole
                                    size={17}
                                    className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-500"
                                />
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    required
                                    autoComplete="current-password"
                                    maxLength={255}
                                    placeholder="Password"
                                    className={`${fieldClasses} pr-12 ${
                                        errors.password
                                            ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100'
                                            : 'border-slate-300 focus:border-[#0D6EFD] focus:ring-4 focus:ring-blue-100'
                                    }`}
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowPassword((current) => !current)
                                    }
                                    className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-400 transition hover:text-blue-600"
                                    aria-label={
                                        showPassword
                                            ? 'Hide password'
                                            : 'Show password'
                                    }
                                >
                                    {showPassword ? (
                                        <EyeOff size={17} />
                                    ) : (
                                        <Eye size={17} />
                                    )}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="mt-2 px-4 text-sm text-red-600">
                                    {errors.password}
                                </p>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 px-2">
                            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                                <input
                                    type="checkbox"
                                    name="remember"
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                Remember me
                            </label>
                            {canResetPassword && (
                                <Link
                                    href={request()}
                                    className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                                >
                                    Forgot password?
                                </Link>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={processing}
                            className="flex w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-[#005BFF] via-[#0D6EFD] to-[#0045CC] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition hover:-translate-y-0.5 hover:from-blue-600 hover:to-blue-800 focus:ring-4 focus:ring-blue-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                            data-test="login-button"
                        >
                            {processing && (
                                <LoaderCircle
                                    size={17}
                                    className="animate-spin"
                                />
                            )}
                            {processing ? 'Logging in...' : 'Login'}
                        </button>
                    </>
                )}
            </Form>

            <div className="mt-6 text-center">
                <p className="text-sm text-slate-500">
                    Student without an account?{' '}
                    <Link
                        href={register()}
                        className="font-semibold text-blue-600 hover:text-blue-700"
                    >
                        Register
                    </Link>
                </p>
                <Link
                    href={home()}
                    className="mt-2 inline-block text-sm text-slate-400 transition hover:text-slate-700"
                >
                    Return to home
                </Link>
            </div>
        </>
    );
}

Login.layout = {
    title: 'STI PROWARE',
    description: 'Merchandise and Inventory Management System',
};
