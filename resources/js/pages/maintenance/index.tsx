import { Head, useForm } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    Bell,
    Gift,
    History,
    LoaderCircle,
    Package,
    Pencil,
    ReceiptText,
    Save,
    ShoppingBag,
    Truck,
    X,
} from 'lucide-react';
import { useState } from 'react';
import MaintenanceController from '@/actions/App/Http/Controllers/MaintenanceController';
import InputError from '@/components/input-error';
import PageHeader from '@/components/page-header';
import Panel, { TableHeading } from '@/components/panel';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

type SettingRow = {
    key: string;
    area: string;
    label: string;
    description: string;
    example: string;
    type: 'choice' | 'text';
    choices: { value: number; label: string }[];
    max_length: number | null;
    value: number | string;
    display: string;
    is_default: boolean;
    changed_at: string | null;
    changed_by: string | null;
};

const areaIcons: Record<string, LucideIcon> = {
    Orders: ShoppingBag,
    Deliveries: Truck,
    'Products & Sales': Package,
    'Free Uniforms': Gift,
    'Issuance Slip': ReceiptText,
    Reminders: Bell,
};

/**
 * The Specialist's Maintenance page, as a back office: the settings that
 * change how PROWARE works without changing its code, one table per area
 * with each setting's current value and who changed it last. Change opens
 * a pop-up with what the setting does, an example, and its choices.
 */
export default function Maintenance({
    areas,
    settings,
}: {
    areas: string[];
    settings: SettingRow[];
}) {
    const [editing, setEditing] = useState<SettingRow | null>(null);

    return (
        <>
            <Head title="Maintenance" />

            <div className="space-y-6">
                <PageHeader
                    title="Maintenance"
                    description="Settings that change how PROWARE works, without changing its code. A change applies right away, on the website and the phone app."
                />

                {areas.map((area) => {
                    const rows = settings.filter(
                        (setting) => setting.area === area,
                    );
                    const Icon = areaIcons[area] ?? Package;

                    if (rows.length === 0) {
                        return null;
                    }

                    return (
                        <Panel key={area}>
                            <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                    <Icon size={18} />
                                </span>
                                <h2 className="font-black text-slate-900">
                                    {area}
                                </h2>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                                    {rows.length}
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <TableHeading>Setting</TableHeading>
                                            <TableHeading>
                                                Current value
                                            </TableHeading>
                                            <TableHeading>
                                                Last changed
                                            </TableHeading>
                                            <TableHeading align="right">
                                                Actions
                                            </TableHeading>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((setting) => (
                                            <SettingTableRow
                                                key={setting.key}
                                                setting={setting}
                                                onChange={() =>
                                                    setEditing(setting)
                                                }
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Panel>
                    );
                })}
            </div>

            <Dialog
                open={editing !== null}
                onOpenChange={(open) => !open && setEditing(null)}
            >
                <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-lg [&>button:last-child]:hidden">
                    {editing && (
                        <ChangeSetting
                            key={editing.key}
                            setting={editing}
                            onDone={() => setEditing(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

/** One setting: what it is, its value now, who changed it last, Change. */
function SettingTableRow({
    setting,
    onChange,
}: {
    setting: SettingRow;
    onChange: () => void;
}) {
    return (
        <tr className="border-t border-slate-100 align-top text-sm transition hover:bg-slate-50/70">
            <td className="px-5 py-4">
                <p className="font-bold text-slate-900">{setting.label}</p>
                <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
                    {setting.description}
                </p>
            </td>
            <td className="px-5 py-4">
                <p className="font-black whitespace-nowrap text-slate-900">
                    {setting.display}
                </p>
                {setting.is_default && (
                    <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                        Default
                    </span>
                )}
            </td>
            <td className="px-5 py-4 whitespace-nowrap">
                {setting.changed_at ? (
                    <>
                        <p className="font-semibold text-slate-700">
                            {setting.changed_by ?? 'Someone'}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                            {formatDateTime(setting.changed_at)}
                        </p>
                    </>
                ) : (
                    <p className="text-xs text-slate-400">Never changed</p>
                )}
            </td>
            <td className="px-5 py-4 text-right">
                <button
                    type="button"
                    onClick={onChange}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 text-sm font-black whitespace-nowrap text-blue-700 transition hover:bg-blue-100"
                >
                    <Pencil size={15} />
                    Change
                </button>
            </td>
        </tr>
    );
}

/**
 * The pop-up to change one setting: what it does, an example, who changed
 * it last, its choices (or a text box), and Save.
 */
function ChangeSetting({
    setting,
    onDone,
}: {
    setting: SettingRow;
    onDone: () => void;
}) {
    const form = useForm<{ value: number | string }>({ value: setting.value });
    const changed = form.data.value !== setting.value;
    const textEmpty =
        setting.type === 'text' && String(form.data.value).trim() === '';

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.patch(MaintenanceController.update(setting.key).url, {
                    preserveScroll: true,
                    onSuccess: onDone,
                });
            }}
            className="flex min-h-0 flex-col"
        >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                <div>
                    <p className="text-xs font-black tracking-wide text-blue-600 uppercase">
                        {setting.area}
                    </p>
                    <DialogTitle className="mt-1 text-lg font-black text-slate-900">
                        {setting.label}
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-sm leading-6 text-slate-500">
                        {setting.description}
                    </DialogDescription>
                </div>
                <DialogClose className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                    <X size={20} />
                    <span className="sr-only">Close</span>
                </DialogClose>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
                    <span className="font-bold text-slate-600">Example: </span>
                    {setting.example}
                </p>

                <p className="text-sm text-slate-600">
                    Now:{' '}
                    <span className="font-black text-slate-900">
                        {setting.display}
                    </span>
                </p>

                {setting.type === 'choice' ? (
                    <div
                        className={cn(
                            'grid gap-2',
                            setting.choices.length > 4
                                ? 'grid-cols-3'
                                : 'grid-cols-2',
                        )}
                    >
                        {setting.choices.map((choice) => (
                            <button
                                key={choice.value}
                                type="button"
                                onClick={() =>
                                    form.setData('value', choice.value)
                                }
                                aria-pressed={form.data.value === choice.value}
                                className={cn(
                                    'h-11 rounded-xl text-sm font-black transition',
                                    form.data.value === choice.value
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                                )}
                            >
                                {choice.label}
                            </button>
                        ))}
                    </div>
                ) : (
                    <input
                        value={String(form.data.value)}
                        onChange={(event) =>
                            form.setData('value', event.target.value)
                        }
                        maxLength={setting.max_length ?? 100}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        aria-label={setting.label}
                        autoFocus
                    />
                )}
                <InputError message={form.errors.value} />

                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <History size={14} />
                    {setting.changed_at
                        ? `Last changed by ${setting.changed_by ?? 'someone'} on ${formatDateTime(setting.changed_at)}`
                        : 'Never changed. Using the default.'}
                </p>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                <DialogClose className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                    Cancel
                </DialogClose>
                <button
                    type="submit"
                    disabled={!changed || textEmpty || form.processing}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {form.processing ? (
                        <LoaderCircle size={17} className="animate-spin" />
                    ) : (
                        <Save size={17} />
                    )}
                    Save
                </button>
            </div>
        </form>
    );
}
