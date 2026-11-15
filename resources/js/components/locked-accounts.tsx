import { router } from '@inertiajs/react';
import { LockKeyhole, LockOpen, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import LockedAccountController from '@/actions/App/Http/Controllers/LockedAccountController';
import ConfirmDialog from '@/components/confirm-dialog';
import { formatDateTime } from '@/lib/format';
import type { LockedAccount } from '@/types';

/**
 * Accounts locked after 5 wrong passwords that the signed-in staff may
 * unlock before the 15 minutes are up: buyers for the Specialist
 * (Maintenance), the Specialist for the School Admin (Dashboard). Unlock
 * asks first, since it should be the owner asking.
 */
export default function LockedAccounts({
    accounts,
    emptyText,
}: {
    accounts: LockedAccount[];
    /** Said when nobody is locked; null hides the list then. */
    emptyText: string | null;
}) {
    const [unlocking, setUnlocking] = useState<LockedAccount | null>(null);
    const [busy, setBusy] = useState(false);

    if (accounts.length === 0) {
        return emptyText === null ? null : (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
                {emptyText}
            </p>
        );
    }

    const unlock = (account: LockedAccount) => {
        setBusy(true);
        router.post(
            LockedAccountController.unlock(account.id).url,
            {},
            {
                preserveScroll: true,
                onFinish: () => {
                    setBusy(false);
                    setUnlocking(null);
                },
            },
        );
    };

    return (
        <>
            <div className="overflow-hidden rounded-2xl border border-red-200">
                <table className="w-full text-left text-sm">
                    <thead className="bg-red-50 text-xs font-black tracking-wide text-red-800 uppercase">
                        <tr>
                            <th className="px-4 py-2.5">Account</th>
                            <th className="px-4 py-2.5">Locked until</th>
                            <th className="px-4 py-2.5">
                                <span className="sr-only">Unlock</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-red-100 bg-white">
                        {accounts.map((account) => (
                            <tr key={account.id} className="align-top">
                                <td className="px-4 py-3">
                                    <p className="flex items-center gap-1.5 font-bold text-slate-900">
                                        <LockKeyhole
                                            size={14}
                                            className="text-red-600"
                                        />
                                        {account.name}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {account.email} · {account.role_label}
                                    </p>
                                    {account.locks_today >= 3 && (
                                        <p className="mt-1 flex items-center gap-1 text-xs font-black text-red-700">
                                            <TriangleAlert size={13} />
                                            Locked {account.locks_today} times
                                            today: someone may be guessing the
                                            password.
                                        </p>
                                    )}
                                </td>
                                <td className="px-4 py-3 font-bold whitespace-nowrap text-red-700">
                                    {formatDateTime(account.locked_until)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <button
                                        type="button"
                                        onClick={() => setUnlocking(account)}
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-black whitespace-nowrap text-emerald-700 transition hover:bg-emerald-100"
                                    >
                                        <LockOpen size={15} />
                                        Unlock
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {unlocking && (
                <ConfirmDialog
                    open
                    title={`Unlock ${unlocking.name}'s account?`}
                    description={`Check that you are talking to ${unlocking.name} first. They can sign in right away.`}
                    cancelLabel="Keep locked"
                    confirmLabel="Unlock"
                    tone="green"
                    busy={busy}
                    onConfirm={() => unlock(unlocking)}
                    onClose={() => setUnlocking(null)}
                />
            )}
        </>
    );
}
