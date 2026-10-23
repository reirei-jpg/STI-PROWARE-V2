import { Form, Head, usePage } from '@inertiajs/react';
import { LoaderCircle, Lock, Save } from 'lucide-react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import InputError from '@/components/input-error';
import Panel from '@/components/panel';
import { useInitials } from '@/hooks/use-initials';
import type { Auth, UserRole } from '@/types';

const roleLabels: Record<UserRole, string> = {
    specialist: 'PROWARE Specialist',
    school_admin: 'School Admin',
    student: 'Student',
};

const inputClasses =
    'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 aria-invalid:border-red-400 aria-invalid:ring-2 aria-invalid:ring-red-100';

/**
 * Your profile: who you are in PROWARE. The name can be changed; the email
 * is shown only (changing it needs it verified by email, so the system
 * administrator does it). A student also sees their Student ID.
 */
export default function Profile() {
    const { auth } = usePage<{ auth: Auth }>().props;
    const getInitials = useInitials();
    const isStudent = auth.user.role === 'student';

    return (
        <>
            <Head title="Profile settings" />

            <Panel
                title="Profile"
                description={
                    isStudent
                        ? 'Your name is printed on your issuance slips. Use your full name, e.g. Juan Dela Cruz.'
                        : 'Your name is shown on what you record, e.g. deliveries and released orders.'
                }
            >
                <div className="flex items-center gap-4 border-b border-slate-100 px-6 py-5">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#0D6EFD] text-lg font-black text-white">
                        {getInitials(auth.user.name)}
                    </span>
                    <div className="min-w-0">
                        <p className="truncate font-black text-slate-900">
                            {auth.user.name}
                        </p>
                        <span className="mt-1 inline-flex rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black tracking-wide text-blue-700 uppercase">
                            {roleLabels[auth.user.role]}
                        </span>
                    </div>
                </div>

                <Form
                    {...ProfileController.update.form()}
                    options={{ preserveScroll: true }}
                    className="space-y-5 px-6 py-5"
                >
                    {({ processing, errors }) => (
                        <>
                            <label className="grid gap-1.5">
                                <span className="text-sm font-black text-slate-700">
                                    Name
                                </span>
                                <input
                                    name="name"
                                    defaultValue={auth.user.name}
                                    required
                                    maxLength={255}
                                    autoComplete="name"
                                    placeholder="Full name"
                                    aria-invalid={Boolean(errors.name)}
                                    className={inputClasses}
                                />
                                <InputError message={errors.name} />
                            </label>

                            <div className="grid gap-1.5">
                                <span className="text-sm font-black text-slate-700">
                                    Email
                                </span>
                                <p className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-600">
                                    <Lock
                                        size={15}
                                        className="shrink-0 text-slate-400"
                                    />
                                    <span className="truncate">
                                        {auth.user.email}
                                    </span>
                                </p>
                                <span className="text-xs text-slate-500">
                                    {isStudent
                                        ? 'Contact the PROWARE office to change your email.'
                                        : 'Contact the system administrator to change your email.'}
                                </span>
                            </div>

                            {isStudent && (
                                <div className="grid gap-1.5">
                                    <span className="text-sm font-black text-slate-700">
                                        Student ID
                                    </span>
                                    <p className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-600">
                                        <Lock
                                            size={15}
                                            className="shrink-0 text-slate-400"
                                        />
                                        <span className="truncate">
                                            {auth.user.student_id ??
                                                'Not recorded'}
                                        </span>
                                    </p>
                                    <span className="text-xs text-slate-500">
                                        Contact the PROWARE office to change
                                        your Student ID.
                                    </span>
                                </div>
                            )}

                            <div className="flex justify-end border-t border-slate-100 pt-5">
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:opacity-60"
                                    data-test="update-profile-button"
                                >
                                    {processing ? (
                                        <LoaderCircle
                                            size={17}
                                            className="animate-spin"
                                        />
                                    ) : (
                                        <Save size={17} />
                                    )}
                                    Save name
                                </button>
                            </div>
                        </>
                    )}
                </Form>
            </Panel>
        </>
    );
}
