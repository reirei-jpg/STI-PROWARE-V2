import { Head } from '@inertiajs/react';
import Profile from '@/pages/settings/profile';
import Security from '@/pages/settings/security';

/**
 * A student's My Account page in the store: their name (printed on the
 * issuance slip), email and Student ID (shown only), and their password.
 * Students sign in with a PROWARE password until Microsoft 365 sign-in is
 * connected.
 */
export default function Account({ passwordRules }: { passwordRules: string }) {
    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <div>
                <h1 className="text-3xl font-black text-slate-900">
                    My Account
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                    Your name on the issuance slip, and the password you sign in
                    with on the website and the phone app.
                </p>
            </div>

            <Profile />
            <Security passwordRules={passwordRules} />

            {/* Last, so it wins over the two forms' own titles. */}
            <Head title="My Account" />
        </div>
    );
}
