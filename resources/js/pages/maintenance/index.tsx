import { Head, useForm } from '@inertiajs/react';
import { Clock, History, LoaderCircle, Save } from 'lucide-react';
import MaintenanceController from '@/actions/App/Http/Controllers/MaintenanceController';
import InputError from '@/components/input-error';
import PageHeader from '@/components/page-header';
import Panel from '@/components/panel';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

type NumberSetting = {
    value: number;
    min: number;
    max: number;
    changed_at: string | null;
    changed_by: string | null;
};

/**
 * The Specialist's Maintenance page: settings that change how PROWARE
 * works, without changing its code. Each shows what it does, its current
 * value, and who changed it last. Changes apply right away, on the
 * website and the phone app.
 */
export default function Maintenance({ holdDays }: { holdDays: NumberSetting }) {
    return (
        <>
            <Head title="Maintenance" />

            <div className="space-y-6">
                <PageHeader
                    title="Maintenance"
                    description="Settings that change how PROWARE works. Changes apply right away, on the website and the phone app."
                />

                <Panel
                    title="Orders"
                    description="How students' orders are handled."
                >
                    <HoldDaysSetting setting={holdDays} />
                </Panel>
            </div>
        </>
    );
}

/**
 * How many days a new order holds its items for the student before it
 * expires and the items are free to sell again.
 */
function HoldDaysSetting({ setting }: { setting: NumberSetting }) {
    const form = useForm({ hold_days: setting.value });
    const choices = Array.from(
        { length: setting.max - setting.min + 1 },
        (_, index) => setting.min + index,
    );
    const changed = form.data.hold_days !== setting.value;

    return (
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1fr_22rem]">
            <div>
                <h3 className="flex items-center gap-2 font-black text-slate-900">
                    <Clock size={19} className="text-amber-600" />
                    Days an order holds its items
                </h3>
                <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-600">
                    When a student places an order, its items are set aside so
                    no one else can buy them. The student must show the issuance
                    slip and pay within this many days; otherwise the order
                    expires and the items go back on sale.
                </p>
                <p className="mt-2 max-w-xl rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
                    Example with 2 days: an order placed on Monday must be
                    picked up by the end of Wednesday. Changing this affects new
                    orders only; orders already placed keep their pick-up date.
                </p>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                    <History size={14} />
                    {setting.changed_at
                        ? `Last changed by ${setting.changed_by ?? 'someone'} on ${formatDateTime(setting.changed_at)}`
                        : 'Never changed. Using the default.'}
                </p>
            </div>

            <form
                className="space-y-3 self-start rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    form.patch(MaintenanceController.updateHoldDays().url, {
                        preserveScroll: true,
                    });
                }}
            >
                <p className="text-xs font-black tracking-wide text-slate-500 uppercase">
                    Now:{' '}
                    <span className="text-slate-900">
                        {setting.value} {setting.value === 1 ? 'day' : 'days'}
                    </span>
                </p>
                <div
                    className="grid gap-2"
                    style={{
                        gridTemplateColumns: `repeat(${choices.length}, minmax(0, 1fr))`,
                    }}
                >
                    {choices.map((days) => (
                        <button
                            key={days}
                            type="button"
                            onClick={() => form.setData('hold_days', days)}
                            aria-pressed={form.data.hold_days === days}
                            className={cn(
                                'h-11 rounded-xl text-sm font-black transition',
                                form.data.hold_days === days
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                            )}
                        >
                            {days} {days === 1 ? 'day' : 'days'}
                        </button>
                    ))}
                </div>
                <InputError message={form.errors.hold_days} />
                <button
                    type="submit"
                    disabled={!changed || form.processing}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0D6EFD] px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {form.processing ? (
                        <LoaderCircle size={16} className="animate-spin" />
                    ) : (
                        <Save size={16} />
                    )}
                    Save
                </button>
            </form>
        </div>
    );
}
