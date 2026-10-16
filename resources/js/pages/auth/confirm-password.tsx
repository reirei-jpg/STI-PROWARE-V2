import { Form, Head } from '@inertiajs/react';
import { LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import {
    AuthField,
    AuthSubmitButton,
    ShowPasswordButton,
} from '@/components/auth-field';
import { store } from '@/routes/password/confirm';

/** Type the password again before a sensitive change. */
export default function ConfirmPassword() {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <>
            <Head title="Confirm password" />

            <Form
                {...store.form()}
                resetOnSuccess={['password']}
                className="space-y-4"
            >
                {({ processing, errors }) => (
                    <>
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
                                    autoFocus
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

                        <AuthSubmitButton
                            processing={processing}
                            label="Confirm"
                            processingLabel="Confirming..."
                            dataTest="confirm-password-button"
                        />
                    </>
                )}
            </Form>
        </>
    );
}

ConfirmPassword.layout = {
    title: 'Confirm your password',
    description: 'For your safety, type your password again to continue.',
};
