import { Form, Head } from '@inertiajs/react';
import { KeyRound, LoaderCircle } from 'lucide-react';
import { useRef } from 'react';
import SecurityController from '@/actions/App/Http/Controllers/Settings/SecurityController';
import InputError from '@/components/input-error';
import Panel from '@/components/panel';
import PasswordInput from '@/components/password-input';
import { cn } from '@/lib/utils';

const inputClasses =
    'h-11 rounded-xl border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm placeholder:font-normal placeholder:text-slate-400 focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-100 aria-invalid:border-red-400 aria-invalid:ring-2 aria-invalid:ring-red-100';

/**
 * Change your password: the current one first, then a new one (different
 * from it) twice.
 */
export default function Security({ passwordRules }: { passwordRules: string }) {
    const passwordInput = useRef<HTMLInputElement>(null);
    const currentPasswordInput = useRef<HTMLInputElement>(null);

    return (
        <>
            <Head title="Password settings" />

            <Panel
                title="Change password"
                description="Use a password only you know. You sign in with it on the website and the phone app."
            >
                <Form
                    {...SecurityController.update.form()}
                    options={{ preserveScroll: true }}
                    resetOnError={[
                        'password',
                        'password_confirmation',
                        'current_password',
                    ]}
                    resetOnSuccess
                    onError={(errors) => {
                        if (errors.password) {
                            passwordInput.current?.focus();
                        }

                        if (errors.current_password) {
                            currentPasswordInput.current?.focus();
                        }
                    }}
                    className="space-y-5 px-6 py-5"
                >
                    {({ errors, processing }) => (
                        <>
                            <label className="grid gap-1.5">
                                <span className="text-sm font-black text-slate-700">
                                    Current password
                                </span>
                                <PasswordInput
                                    ref={currentPasswordInput}
                                    name="current_password"
                                    autoComplete="current-password"
                                    placeholder="Current password"
                                    aria-invalid={Boolean(
                                        errors.current_password,
                                    )}
                                    className={inputClasses}
                                />
                                <InputError message={errors.current_password} />
                            </label>

                            <label className="grid gap-1.5">
                                <span className="text-sm font-black text-slate-700">
                                    New password
                                </span>
                                <PasswordInput
                                    ref={passwordInput}
                                    name="password"
                                    autoComplete="new-password"
                                    placeholder="New password"
                                    passwordrules={passwordRules}
                                    aria-invalid={Boolean(errors.password)}
                                    className={inputClasses}
                                />
                                <span
                                    className={cn(
                                        'text-xs',
                                        errors.password
                                            ? 'hidden'
                                            : 'text-slate-500',
                                    )}
                                >
                                    At least 8 characters, with a lowercase
                                    letter, a number and a symbol (e.g. ! @ #
                                    $).
                                </span>
                                <InputError message={errors.password} />
                            </label>

                            <label className="grid gap-1.5">
                                <span className="text-sm font-black text-slate-700">
                                    Type the new password again
                                </span>
                                <PasswordInput
                                    name="password_confirmation"
                                    autoComplete="new-password"
                                    placeholder="New password again"
                                    passwordrules={passwordRules}
                                    aria-invalid={Boolean(
                                        errors.password_confirmation,
                                    )}
                                    className={inputClasses}
                                />
                                <InputError
                                    message={errors.password_confirmation}
                                />
                            </label>

                            <div className="flex justify-end border-t border-slate-100 pt-5">
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:opacity-60"
                                    data-test="update-password-button"
                                >
                                    {processing ? (
                                        <LoaderCircle
                                            size={17}
                                            className="animate-spin"
                                        />
                                    ) : (
                                        <KeyRound size={17} />
                                    )}
                                    Change password
                                </button>
                            </div>
                        </>
                    )}
                </Form>
            </Panel>
        </>
    );
}
