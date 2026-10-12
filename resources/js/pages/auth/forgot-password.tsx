import { Form, Head, Link } from '@inertiajs/react';
import { Mail } from 'lucide-react';
import {
    AuthField,
    AuthStatus,
    AuthSubmitButton,
    authLinkClasses,
} from '@/components/auth-field';
import { login } from '@/routes';
import { email } from '@/routes/password';

/** Ask for a link to set a new password, sent to the account's email. */
export default function ForgotPassword({ status }: { status?: string }) {
    return (
        <>
            <Head title="Forgot password" />

            {status && <AuthStatus>{status}</AuthStatus>}

            <Form {...email.form()} className="space-y-4">
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
                                    autoFocus
                                    placeholder="Email address"
                                    aria-label="Email address"
                                />
                            }
                        />

                        <AuthSubmitButton
                            processing={processing}
                            label="Send me the link"
                            processingLabel="Sending..."
                            dataTest="email-password-reset-link-button"
                        />
                    </>
                )}
            </Form>

            <p className="mt-6 text-center text-sm text-slate-500">
                Remembered it?{' '}
                <Link href={login()} className={authLinkClasses}>
                    Back to Log in
                </Link>
            </p>
        </>
    );
}

ForgotPassword.layout = {
    title: 'Forgot your password?',
    description:
        'Type the email you log in with. We will send you a link to set a new password.',
};
