import { Form, Head, Link } from '@inertiajs/react';
import { LockKeyhole, Mail } from 'lucide-react';
import { useState } from 'react';
import {
    AuthField,
    AuthStatus,
    AuthSubmitButton,
    ShowPasswordButton,
    authLinkClasses,
} from '@/components/auth-field';
import PasskeyVerify from '@/components/passkey-verify';
import { MicrosoftLogo } from '@/components/sign-in-prompt';
import { home, register } from '@/routes';
import { store } from '@/routes/login';
import { request } from '@/routes/password';

type Props = {
    status?: string;
    canResetPassword: boolean;
};

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

            {status && <AuthStatus>{status}</AuthStatus>}

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
                        <AuthField
                            icon={<Mail size={17} />}
                            error={errors.email}
                            input={
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    autoComplete="email"
                                    maxLength={255}
                                    placeholder="Email address"
                                    aria-label="Email address"
                                />
                            }
                        />
                        <AuthField
                            icon={<LockKeyhole size={17} />}
                            error={errors.password}
                            input={
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    required
                                    autoComplete="current-password"
                                    maxLength={255}
                                    placeholder="Password"
                                    aria-label="Password"
                                />
                            }
                            trailing={
                                <ShowPasswordButton
                                    shown={showPassword}
                                    onToggle={() =>
                                        setShowPassword((shown) => !shown)
                                    }
                                />
                            }
                        />

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
                                    className={`text-sm ${authLinkClasses}`}
                                >
                                    Forgot password?
                                </Link>
                            )}
                        </div>

                        <AuthSubmitButton
                            processing={processing}
                            label="Login"
                            processingLabel="Logging in..."
                            dataTest="login-button"
                        />
                    </>
                )}
            </Form>

            <div className="mt-6 text-center">
                <p className="text-sm text-slate-500">
                    Student without an account?{' '}
                    <Link href={register()} className={authLinkClasses}>
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
