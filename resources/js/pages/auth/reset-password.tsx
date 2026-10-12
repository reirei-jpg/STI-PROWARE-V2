import { Form, Head } from '@inertiajs/react';
import { LockKeyhole, Mail } from 'lucide-react';
import { useState } from 'react';
import {
    AuthField,
    AuthSubmitButton,
    ShowPasswordButton,
} from '@/components/auth-field';
import { update } from '@/routes/password';

type Props = {
    token: string;
    email: string;
    passwordRules: string;
};

/** Set a new password from the emailed link. */
export default function ResetPassword({ token, email, passwordRules }: Props) {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <>
            <Head title="Set a new password" />

            <Form
                {...update.form()}
                transform={(data) => ({ ...data, token, email })}
                resetOnSuccess={['password', 'password_confirmation']}
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
                                    autoComplete="email"
                                    value={email}
                                    aria-label="Email address"
                                    readOnly
                                />
                            }
                        />
                        <AuthField
                            icon={<LockKeyhole size={17} />}
                            error={errors.password}
                            hint="At least 8 characters, with a letter, a number and a symbol."
                            input={
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    required
                                    autoComplete="new-password"
                                    maxLength={255}
                                    autoFocus
                                    placeholder="New password"
                                    aria-label="New password"
                                    passwordrules={passwordRules}
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
                        <AuthField
                            icon={<LockKeyhole size={17} />}
                            error={errors.password_confirmation}
                            input={
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="password_confirmation"
                                    required
                                    autoComplete="new-password"
                                    maxLength={255}
                                    placeholder="Type the new password again"
                                    aria-label="Confirm new password"
                                    passwordrules={passwordRules}
                                />
                            }
                        />

                        <AuthSubmitButton
                            processing={processing}
                            label="Save new password"
                            processingLabel="Saving..."
                            dataTest="reset-password-button"
                        />
                    </>
                )}
            </Form>
        </>
    );
}

ResetPassword.layout = {
    title: 'Set a new password',
    description: 'Choose the password you will log in with from now on.',
};
