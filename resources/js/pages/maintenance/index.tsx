import { Head, useForm } from '@inertiajs/react';
import {
    CircleAlert,
    Clock,
    Gift,
    History,
    LoaderCircle,
    Save,
} from 'lucide-react';
import MaintenanceController from '@/actions/App/Http/Controllers/MaintenanceController';
import InputError from '@/components/input-error';
import PageHeader from '@/components/page-header';
import Panel from '@/components/panel';
import type { ReactNode } from 'react';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

type NumberSetting = {
    value: number;
    min: number;
    max: number;
    changed_at: string | null;
    changed_by: string | null;
};

type ChoiceSetting = {
    value: number;
    choices: number[];
    changed_at: string | null;
    changed_by: string | null;
};

/**
 * The Specialist's Maintenance page: settings that change how PROWARE
 * works, without changing its code. Each shows what it does, its current
 * value, and who changed it last. Changes apply right away, on the
 * website and the phone app.
 */
export default function Maintenance({
    holdDays,
    followUpDays,
    promoGroupSize,
}: {
    holdDays: NumberSetting;
    followUpDays: ChoiceSetting;
    promoGroupSize: NumberSetting;
}) {
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

                <Panel
                    title="Deliveries"
                    description="How purchase orders from Head Office are followed up."
                >
                    <FollowUpDaysSetting setting={followUpDays} />
                </Panel>

                <Panel
                    title="Free Uniforms"
                    description="The enrollment promo: free uniform sets for students who enroll together."
                >
                    <PromoGroupSizeSetting setting={promoGroupSize} />
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

    return (
        <SettingRow
            icon={<Clock size={19} className="text-amber-600" />}
            title="Days an order holds its items"
            explanation="When a student places an order, its items are set aside so no one else can buy them. The student must show the issuance slip and pay within this many days; otherwise the order expires and the items go back on sale."
            example="Example with 2 days: an order placed on Monday must be picked up by the end of Wednesday. Changing this affects new orders only; orders already placed keep their pick-up date."
            setting={setting}
            choices={choices}
            chosen={form.data.hold_days}
            onChoose={(days) => form.setData('hold_days', days)}
            error={form.errors.hold_days}
            processing={form.processing}
            onSave={() =>
                form.patch(MaintenanceController.updateHoldDays().url, {
                    preserveScroll: true,
                })
            }
        />
    );
}

/**
 * After how many days from its Date Ordered a purchase order not complete
 * is shown to follow up with Head Office (Deliveries, dashboards).
 */
function FollowUpDaysSetting({ setting }: { setting: ChoiceSetting }) {
    const form = useForm({ follow_up_days: setting.value });

    return (
        <SettingRow
            icon={<CircleAlert size={19} className="text-red-600" />}
            title="Days before a purchase order is followed up"
            explanation="Head Office gives no delivery date. A purchase order not fully delivered this many days after its Date Ordered is shown as Not complete on the Deliveries page and the dashboards, so you know to ask Head Office about the rest."
            example="Example with 30 days: an order dated Sep 29 that has not fully arrived shows from Oct 29."
            setting={setting}
            choices={setting.choices}
            chosen={form.data.follow_up_days}
            onChoose={(days) => form.setData('follow_up_days', days)}
            error={form.errors.follow_up_days}
            processing={form.processing}
            onSave={() =>
                form.patch(MaintenanceController.updateFollowUpDays().url, {
                    preserveScroll: true,
                })
            }
        />
    );
}

/**
 * How many students must enroll together for each to get a free uniform
 * set (Free Uniforms page).
 */
function PromoGroupSizeSetting({ setting }: { setting: NumberSetting }) {
    const form = useForm({ group_size: setting.value });
    const choices = Array.from(
        { length: setting.max - setting.min + 1 },
        (_, index) => setting.min + index,
    );

    return (
        <SettingRow
            icon={<Gift size={19} className="text-emerald-600" />}
            title="Students needed for free uniforms"
            explanation="Students who enroll together in a group of at least this many each get one uniform set for free: a blouse or polo, and pants. Record them on the Free Uniforms page."
            example="Example with 5: five friends who enroll on the same day each get a set. A group of 4 does not. Groups already recorded stay as they are."
            unit="students"
            setting={setting}
            choices={choices}
            chosen={form.data.group_size}
            onChoose={(size) => form.setData('group_size', size)}
            error={form.errors.group_size}
            processing={form.processing}
            onSave={() =>
                form.patch(MaintenanceController.updatePromoGroupSize().url, {
                    preserveScroll: true,
                })
            }
        />
    );
}

/**
 * One setting: what it does with an example and who changed it last, then
 * its choices as buttons and Save.
 */
function SettingRow({
    icon,
    title,
    explanation,
    example,
    unit = 'days',
    setting,
    choices,
    chosen,
    onChoose,
    error,
    processing,
    onSave,
}: {
    icon: ReactNode;
    title: string;
    explanation: string;
    example: string;
    /** What the numbers count, e.g. "days" or "students". */
    unit?: string;
    setting: {
        value: number;
        changed_at: string | null;
        changed_by: string | null;
    };
    choices: number[];
    chosen: number;
    onChoose: (days: number) => void;
    error?: string;
    processing: boolean;
    onSave: () => void;
}) {
    const changed = chosen !== setting.value;
    // "1 day", "2 days".
    const counted = (count: number) =>
        `${count} ${count === 1 ? unit.replace(/s$/, '') : unit}`;

    return (
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1fr_22rem]">
            <div>
                <h3 className="flex items-center gap-2 font-black text-slate-900">
                    {icon}
                    {title}
                </h3>
                <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-600">
                    {explanation}
                </p>
                <p className="mt-2 max-w-xl rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
                    {example}
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
                    onSave();
                }}
            >
                <p className="text-xs font-black tracking-wide text-slate-500 uppercase">
                    Now:{' '}
                    <span className="text-slate-900">
                        {counted(setting.value)}
                    </span>
                </p>
                <div
                    className="grid gap-2"
                    style={{
                        // At most three buttons per row, so "60 days" fits.
                        gridTemplateColumns: `repeat(${Math.min(choices.length, 3)}, minmax(0, 1fr))`,
                    }}
                >
                    {choices.map((days) => (
                        <button
                            key={days}
                            type="button"
                            onClick={() => onChoose(days)}
                            aria-pressed={chosen === days}
                            className={cn(
                                'h-11 rounded-xl text-sm font-black transition',
                                chosen === days
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                            )}
                        >
                            {counted(days)}
                        </button>
                    ))}
                </div>
                <InputError message={error} />
                <button
                    type="submit"
                    disabled={!changed || processing}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0D6EFD] px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {processing ? (
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
