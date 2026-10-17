import { Head, useForm } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { Fragment } from 'react';
import MaintenanceController from '@/actions/App/Http/Controllers/MaintenanceController';
import InputError from '@/components/input-error';
import PageHeader from '@/components/page-header';
import Panel, { TableHeading } from '@/components/panel';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

type SettingRow = {
    key: string;
    label: string;
    help: string;
    type: 'choice' | 'text';
    value: number | string;
    default: number | string;
    choices: { value: number; label: string }[];
    max_length: number | null;
    changed_at: string | null;
    changed_by: string | null;
};

type Area = { area: string; settings: SettingRow[] };

/**
 * The Specialist's Maintenance page, as a plain back-office settings table:
 * each area (Orders, Deliveries, Products & Sales, Free Uniforms, Issuance
 * Slip) with one row per setting: its name and one line of help, its value,
 * and who changed it last. Changes are saved together with one button and
 * apply right away on the website and the phone app.
 */
export default function Maintenance({ areas }: { areas: Area[] }) {
    const settings = areas.flatMap((area) => area.settings);
    const saved = Object.fromEntries(
        settings.map((setting) => [setting.key, String(setting.value)]),
    );
    const form = useForm<Record<string, string>>(saved);
    const changed = settings.filter(
        (setting) => form.data[setting.key] !== saved[setting.key],
    );

    const save = () =>
        form.patch(MaintenanceController.update().url, {
            preserveScroll: true,
            onSuccess: () => form.setDefaults(),
        });

    return (
        <>
            <Head title="Maintenance" />

            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    save();
                }}
                className="space-y-4 pb-24"
            >
                <PageHeader
                    title="Maintenance"
                    description="System settings. Changes apply right away on the website and the phone app."
                />

                <Panel>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-190 text-sm">
                            <thead className="bg-slate-50">
                                <tr className="border-b border-slate-200">
                                    <TableHeading>Setting</TableHeading>
                                    <TableHeading>Value</TableHeading>
                                    <TableHeading>Last changed</TableHeading>
                                </tr>
                            </thead>
                            <tbody>
                                {areas.map((area) => (
                                    <Fragment key={area.area}>
                                        <tr className="border-b border-slate-200 bg-slate-100/70">
                                            <th
                                                colSpan={3}
                                                className="px-5 py-2 text-left text-xs font-black tracking-wide text-slate-600 uppercase"
                                            >
                                                {area.area}
                                            </th>
                                        </tr>
                                        {area.settings.map((setting) => (
                                            <SettingRowView
                                                key={setting.key}
                                                setting={setting}
                                                value={form.data[setting.key]}
                                                isChanged={
                                                    form.data[setting.key] !==
                                                    saved[setting.key]
                                                }
                                                error={form.errors[setting.key]}
                                                onChange={(value) => {
                                                    form.setData(
                                                        setting.key,
                                                        value,
                                                    );
                                                    form.clearErrors(
                                                        setting.key,
                                                    );
                                                }}
                                            />
                                        ))}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Panel>

                <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur md:left-72">
                    <div className="flex flex-wrap items-center justify-end gap-3 px-6 py-3">
                        <p className="mr-auto text-sm text-slate-500">
                            {changed.length === 0
                                ? 'No unsaved changes.'
                                : `${changed.length} ${changed.length === 1 ? 'change' : 'changes'} not saved yet.`}
                        </p>
                        <button
                            type="button"
                            disabled={changed.length === 0 || form.processing}
                            onClick={() => {
                                form.setData(saved);
                                form.clearErrors();
                            }}
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Undo changes
                        </button>
                        <button
                            type="submit"
                            disabled={changed.length === 0 || form.processing}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#0D6EFD] px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {form.processing && (
                                <LoaderCircle
                                    size={15}
                                    className="animate-spin"
                                />
                            )}
                            Save changes
                        </button>
                    </div>
                </div>
            </form>
        </>
    );
}

function SettingRowView({
    setting,
    value,
    isChanged,
    error,
    onChange,
}: {
    setting: SettingRow;
    value: string;
    isChanged: boolean;
    error?: string;
    onChange: (value: string) => void;
}) {
    const fieldClasses = cn(
        'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100',
        error ? 'border-red-400' : 'border-slate-300',
    );

    return (
        <tr
            className={cn(
                'border-b border-slate-100 align-top last:border-b-0',
                isChanged && 'bg-amber-50/60',
            )}
        >
            <td className="w-[46%] px-5 py-3">
                <label
                    htmlFor={`setting-${setting.key}`}
                    className="font-bold text-slate-800"
                >
                    {setting.label}
                </label>
                <p className="mt-0.5 text-xs text-slate-500">{setting.help}</p>
            </td>
            <td className="w-[30%] px-5 py-3">
                {setting.type === 'choice' ? (
                    <select
                        id={`setting-${setting.key}`}
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                        aria-invalid={error ? true : undefined}
                        className={fieldClasses}
                    >
                        {setting.choices.map((choice) => (
                            <option key={choice.value} value={choice.value}>
                                {choice.label}
                                {choice.value === setting.default
                                    ? ' (default)'
                                    : ''}
                            </option>
                        ))}
                    </select>
                ) : (
                    <input
                        id={`setting-${setting.key}`}
                        value={value}
                        maxLength={setting.max_length ?? undefined}
                        onChange={(event) => onChange(event.target.value)}
                        aria-invalid={error ? true : undefined}
                        className={fieldClasses}
                    />
                )}
                <InputError message={error} className="mt-1" />
            </td>
            <td className="px-5 py-3 text-xs text-slate-500">
                {setting.changed_at ? (
                    <>
                        <span className="font-semibold text-slate-700">
                            {setting.changed_by ?? 'Someone'}
                        </span>
                        <br />
                        {formatDateTime(setting.changed_at)}
                    </>
                ) : (
                    'Default, not changed'
                )}
            </td>
        </tr>
    );
}
