import { Form, Head, Link } from '@inertiajs/react';
import { AuthStatus, AuthSubmitButton } from '@/components/auth-field';
import { logout } from '@/routes';
import { send } from '@/routes/verification';

/** Ask for the email check link again. */
export default function VerifyEmail({ status }: { status?: string }) {
    return (
        <>
            <Head title="Check your email" />

            {status === 'verification-link-sent' && (
                <AuthStatus>
                    A new link was sent to the email you registered with.
                </AuthStatus>
            )}

            <Form {...send.form()} className="space-y-4">
                {({ processing }) => (
                    <AuthSubmitButton
                        processing={processing}
                        label="Send the link again"
                        processingLabel="Sending..."
                    />
                )}
            </Form>

            <div className="mt-6 text-center">
                <Link
                    href={logout()}
                    as="button"
                    className="text-sm text-slate-400 transition hover:text-slate-700"
                >
                    Log out
                </Link>
            </div>
        </>
    );
}

VerifyEmail.layout = {
    title: 'Check your email',
    description: 'Open the link we emailed you to confirm your email address.',
};
