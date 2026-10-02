import { Link, router, usePage } from '@inertiajs/react';
import { ChevronDown, LogOut, Settings, UserRound } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useInitials } from '@/hooks/use-initials';
import { logout } from '@/routes';
import { edit } from '@/routes/profile';
import type { Auth, UserRole } from '@/types';

const roleLabels: Record<UserRole, string> = {
    specialist: 'PROWARE Specialist',
    school_admin: 'School Admin',
    student: 'Student',
};

/**
 * The account button in the top bar (as in V1): initials, name and role,
 * opening a menu with the account details, Settings and Log out.
 */
export default function AccountMenu() {
    const { auth } = usePage<{ auth: Auth }>().props;
    const getInitials = useInitials();
    const roleLabel = roleLabels[auth.user.role];

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-left transition outline-none hover:border-blue-200 hover:bg-blue-50/50 focus-visible:ring-2 focus-visible:ring-blue-300"
                    data-test="account-menu-button"
                >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0D6EFD] text-sm font-black text-white">
                        {getInitials(auth.user.name)}
                    </span>

                    <span className="hidden min-w-0 lg:block">
                        <span className="block max-w-40 truncate text-sm font-semibold text-slate-900">
                            {auth.user.name}
                        </span>
                        <span className="block max-w-40 truncate text-xs text-slate-500">
                            {roleLabel}
                        </span>
                    </span>

                    <ChevronDown
                        size={16}
                        className="hidden shrink-0 text-slate-400 sm:block"
                    />
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align="end"
                className="w-72 overflow-hidden rounded-2xl border-slate-200 p-0 shadow-xl shadow-slate-900/10"
            >
                <div className="border-b border-slate-100 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                            <UserRound size={21} />
                        </div>

                        <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-900">
                                {auth.user.name}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                                {auth.user.email}
                            </p>
                        </div>
                    </div>

                    <span className="mt-4 inline-flex rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black tracking-wide text-blue-700 uppercase">
                        {roleLabel}
                    </span>
                </div>

                <div className="p-2">
                    <DropdownMenuItem asChild>
                        <Link
                            href={edit()}
                            className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 focus:bg-blue-50 focus:text-blue-700"
                        >
                            <Settings size={17} />
                            Settings
                        </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem asChild>
                        <Link
                            href={logout()}
                            as="button"
                            onClick={() => router.flushAll()}
                            className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-red-600 focus:bg-red-50 focus:text-red-600"
                            data-test="logout-button"
                        >
                            <LogOut size={17} />
                            Log out
                        </Link>
                    </DropdownMenuItem>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
