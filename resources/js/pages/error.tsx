import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, Lock, SearchX, ServerCrash, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { dashboard, home } from '@/routes';

const messages: Record<
    number,
    { title: string; text: string; icon: LucideIcon }
> = {
    403: {
        title: 'This page is not for your account',
        text: 'Your account cannot open this page. It belongs to another part of PROWARE.',
        icon: Lock,
    },
    404: {
        title: 'Page not found',
        text: 'The page or item you are looking for does not exist, or it was removed.',
        icon: SearchX,
    },
    500: {
        title: 'Something went wrong',
        text: 'The page could not be loaded. Try again in a moment.',
        icon: ServerCrash,
    },
    503: {
        title: 'PROWARE is being updated',
        text: 'Try again in a few minutes.',
        icon: Wrench,
    },
};

/**
 * The page shown instead of the server's bare error page (e.g. "403
 * Forbidden"): what happened in plain words, and a way back to the
 * dashboard (staff) or the store (students and visitors).
 */
export default function ErrorPage({ status }: { status: number }) {
    const { auth } = usePage().props;
    const message = messages[status] ?? messages[500];
    const Icon = message.icon;
    const isStaff = auth.user !== null && auth.user.role !== 'student';

    return (
        <>
            <Head title={message.title} />

            <main className="flex min-h-screen items-center justify-center bg-[#F3F7FA] px-4 py-12">
                <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <img
                        src="/images/sti-logo.png"
                        alt="STI PROWARE"
                        className="mx-auto h-12 w-12 rounded-xl"
                    />
                    <div className="mx-auto mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                        <Icon size={26} />
                    </div>
                    <p className="mt-4 text-xs font-black tracking-wide text-slate-400">
                        ERROR {status}
                    </p>
                    <h1 className="mt-1 text-xl font-black text-slate-900">
                        {message.title}
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                        {message.text}
                    </p>
                    <Link
                        href={isStaff ? dashboard() : home()}
                        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700"
                    >
                        <ArrowLeft size={16} />
                        {isStaff ? 'Back to my Dashboard' : 'Back to the store'}
                    </Link>
                </div>
            </main>
        </>
    );
}
