import { Head, router, useForm } from '@inertiajs/react';
import {
    CircleAlert,
    ClipboardList,
    Gift,
    History,
    LoaderCircle,
    PackageCheck,
    Save,
    UserPlus,
    Users,
} from 'lucide-react';
import MaintenanceController from '@/actions/App/Http/Controllers/MaintenanceController';
import ConfirmDialog from '@/components/confirm-dialog';
import InputError from '@/components/input-error';
import PageHeader from '@/components/page-header';
import Panel from '@/components/panel';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { formatDateTime } from '@/lib/format';
import { wholeNumberInput } from '@/lib/number-input';
import { cn } from '@/lib/utils';

type NumberSetting = {
    value: number;
    min: number;
    max: number;
    changed_at: string | null;
    changed_by: string | null;
};

type LimitSetting = {
    value: number;
    min: number;
    max: number;
    default: number;
    changed_at: string | null;
    changed_by: string | null;
};

/** A buyer the Specialist allowed more of one item than everyone else. */
type BuyerAllowedMore = {
    id: number;
    name: string;
    email: string;
    most_per_item: number;
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
    followUpDays,
    promoGroupSize,
    mostPerItem,
    buyersAllowedMore,
    preordersBeforeOrdering,
}: {
    followUpDays: ChoiceSetting;
    promoGroupSize: NumberSetting;
    mostPerItem: LimitSetting;
    buyersAllowedMore: BuyerAllowedMore[];
    preordersBeforeOrdering: LimitSetting;
}) {
    return (
        <>
            <Head title="Maintenance" />

            <div className="space-y-6">
                <PageHeader
                    title="Maintenance"
                    description="Settings that change how PROWARE works. Changes apply right away, on the website and the phone app."
                />

                <Panel title="Orders" description="How orders are handled.">
                    <MostPerItemSetting setting={mostPerItem} />
                    <div className="border-t border-slate-100">
                        <BuyersAllowedMoreSetting
                            buyers={buyersAllowedMore}
                            setting={mostPerItem}
                        />
                    </div>
                </Panel>

                <Panel
                    title="Preorders"
                    description="When Coming Soon items are ready to order."
                >
                    <PreordersBeforeOrderingSetting
                        setting={preordersBeforeOrdering}
                    />
                </Panel>

                <Panel
                    title="Stock In"
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
 * After how many days from its Date Ordered a purchase order not complete
 * is shown to follow up with Head Office (Deliveries, dashboards).
 */
function FollowUpDaysSetting({ setting }: { setting: ChoiceSetting }) {
    const form = useForm({ follow_up_days: setting.value });

    return (
        <SettingRow
            icon={<CircleAlert size={19} className="text-red-600" />}
            title="Days before a purchase order is followed up"
            explanation="Head Office gives no delivery date. A purchase order not fully delivered this many days after its Date Ordered is shown as Not complete on the Stock In page and the dashboards, so you know to ask Head Office about the rest."
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
            explanation="Students who enroll together in a group of at least this many each get one uniform set for free: a polo and pants, or a blouse and ladies' pants or a skirt. Record them on the Free Uniforms page."
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
 * The most of one item every buyer can get at once: in the cart (pieces,
 * packs or uniform sets) and preordered per size. Typed, since it can be
 * anything from 1 to 10,000.
 */
function MostPerItemSetting({ setting }: { setting: LimitSetting }) {
    const form = useForm({ most_per_item: String(setting.value) });
    const typed = Number(form.data.most_per_item) || 0;
    const changed = form.data.most_per_item !== '' && typed !== setting.value;

    return (
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1fr_22rem]">
            <SettingText
                icon={<PackageCheck size={19} className="text-blue-600" />}
                title="Most of one item per buyer"
                explanation="How many of one item a buyer can get at once: in one cart line (pieces, packs or uniform sets), and preordered per size or color in all. An item in stock also stops at its stock. For a buyer who needs more, add them under Buyers allowed more."
                example={`Example with ${setting.default}: a buyer can add ${setting.default} lanyards, but not ${setting.default + 1}. They are told: "You can get at most ${setting.default} of one item. Contact the PROWARE office to get more."`}
                setting={setting}
            />

            <form
                className="space-y-3 self-start rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    form.patch(MaintenanceController.updateMostPerItem().url, {
                        preserveScroll: true,
                    });
                }}
            >
                <p className="text-xs font-black tracking-wide text-slate-500 uppercase">
                    Now:{' '}
                    <span className="text-slate-900">
                        {setting.value.toLocaleString('en-PH')} of one item
                    </span>
                </p>
                <label className="block space-y-1.5">
                    <span className="text-sm font-bold text-slate-700">
                        Most of one item ({setting.min} to{' '}
                        {setting.max.toLocaleString('en-PH')})
                    </span>
                    <input
                        inputMode="numeric"
                        value={form.data.most_per_item}
                        onChange={(event) =>
                            form.setData(
                                'most_per_item',
                                wholeNumberInput(
                                    event.target.value,
                                    setting.max,
                                ),
                            )
                        }
                        aria-invalid={form.errors.most_per_item !== undefined}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                    />
                </label>
                <InputError message={form.errors.most_per_item} />
                <SaveButton disabled={!changed} processing={form.processing} />
                {!changed && (
                    <p className="text-center text-xs font-semibold text-slate-500">
                        Type a different number to save.
                    </p>
                )}
            </form>
        </div>
    );
}

/**
 * How many pieces must be preordered before a Coming Soon item shows on the
 * dashboard as Ready to order, where the Specialist chooses Create PO or
 * Leave it.
 */
function PreordersBeforeOrderingSetting({
    setting,
}: {
    setting: LimitSetting;
}) {
    const form = useForm({ preorders_before_ordering: String(setting.value) });
    const typed = Number(form.data.preorders_before_ordering) || 0;
    const changed =
        form.data.preorders_before_ordering !== '' && typed !== setting.value;

    return (
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1fr_22rem]">
            <SettingText
                icon={<ClipboardList size={19} className="text-amber-600" />}
                title="Preorders before ordering"
                explanation="When this many pieces of a Coming Soon item are preordered, it shows on the dashboard as Ready to order. There you choose Create PO (its preorders close and it moves to To order) or Leave it (it comes back after 10 more are preordered)."
                example={`Example with ${setting.default}: a hoodie with 22 pieces preordered shows as Ready to order; one with 19 does not yet.`}
                setting={setting}
            />

            <form
                className="space-y-3 self-start rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    form.patch(
                        MaintenanceController.updatePreordersBeforeOrdering()
                            .url,
                        { preserveScroll: true },
                    );
                }}
            >
                <p className="text-xs font-black tracking-wide text-slate-500 uppercase">
                    Now:{' '}
                    <span className="text-slate-900">
                        {setting.value.toLocaleString('en-PH')}{' '}
                        {setting.value === 1 ? 'piece' : 'pieces'}
                    </span>
                </p>
                <label className="block space-y-1.5">
                    <span className="text-sm font-bold text-slate-700">
                        Pieces preordered ({setting.min} to{' '}
                        {setting.max.toLocaleString('en-PH')})
                    </span>
                    <input
                        inputMode="numeric"
                        value={form.data.preorders_before_ordering}
                        onChange={(event) =>
                            form.setData(
                                'preorders_before_ordering',
                                wholeNumberInput(
                                    event.target.value,
                                    setting.max,
                                ),
                            )
                        }
                        aria-invalid={
                            form.errors.preorders_before_ordering !== undefined
                        }
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                    />
                </label>
                <InputError message={form.errors.preorders_before_ordering} />
                <SaveButton disabled={!changed} processing={form.processing} />
                {!changed && (
                    <p className="text-center text-xs font-semibold text-slate-500">
                        Type a different number to save.
                    </p>
                )}
            </form>
        </div>
    );
}
/**
 * Buyers the Specialist allowed more of one item than everyone else (e.g.
 * 500 shirts for an event), found by their email. They keep their number
 * until they are removed.
 */
function BuyersAllowedMoreSetting({
    buyers,
    setting,
}: {
    buyers: BuyerAllowedMore[];
    setting: LimitSetting;
}) {
    const form = useForm({ email: '', most_per_item: '' });
    const [removing, setRemoving] = useState<BuyerAllowedMore | null>(null);
    const [busy, setBusy] = useState(false);

    const remove = (buyer: BuyerAllowedMore) => {
        setBusy(true);
        router.delete(
            MaintenanceController.removeBuyerAllowance(buyer.id).url,
            {
                preserveScroll: true,
                onFinish: () => {
                    setBusy(false);
                    setRemoving(null);
                },
            },
        );
    };

    return (
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1fr_22rem]">
            <div>
                <h3 className="flex items-center gap-2 font-black text-slate-900">
                    <Users size={19} className="text-emerald-600" />
                    Buyers allowed more
                </h3>
                <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-600">
                    A buyer who needs more of one item than everyone else, e.g.
                    500 shirts for an event. They can get up to their own number
                    until you remove them; everyone else stays at{' '}
                    {setting.value.toLocaleString('en-PH')}.
                </p>

                {buyers.length === 0 ? (
                    <p className="mt-3 max-w-xl rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
                        No buyer is allowed more. Everyone can get at most{' '}
                        {setting.value.toLocaleString('en-PH')} of one item.
                    </p>
                ) : (
                    <div className="mt-3 max-w-xl overflow-hidden rounded-2xl border border-slate-200">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-xs font-black tracking-wide text-slate-500 uppercase">
                                <tr>
                                    <th className="px-4 py-2.5">Buyer</th>
                                    <th className="px-4 py-2.5 text-right">
                                        Most of one item
                                    </th>
                                    <th className="px-4 py-2.5">
                                        <span className="sr-only">Remove</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {buyers.map((buyer) => (
                                    <tr key={buyer.id}>
                                        <td className="px-4 py-3">
                                            <p className="font-bold text-slate-900">
                                                {buyer.name}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {buyer.email}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 text-right font-black text-slate-900">
                                            {buyer.most_per_item.toLocaleString(
                                                'en-PH',
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setRemoving(buyer)
                                                }
                                                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-black text-red-700 transition hover:bg-red-100"
                                            >
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <form
                className="space-y-3 self-start rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post(MaintenanceController.allowBuyerMore().url, {
                        preserveScroll: true,
                        onSuccess: () => form.reset(),
                    });
                }}
            >
                <p className="text-xs font-black tracking-wide text-slate-500 uppercase">
                    Allow a buyer more
                </p>
                <label className="block space-y-1.5">
                    <span className="text-sm font-bold text-slate-700">
                        Buyer's email
                    </span>
                    <input
                        type="email"
                        value={form.data.email}
                        onChange={(event) =>
                            form.setData('email', event.target.value)
                        }
                        placeholder="delacruz.123456@sti.edu.ph"
                        aria-invalid={form.errors.email !== undefined}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                    />
                </label>
                <InputError message={form.errors.email} />
                <label className="block space-y-1.5">
                    <span className="text-sm font-bold text-slate-700">
                        Most of one item ({setting.min} to{' '}
                        {setting.max.toLocaleString('en-PH')})
                    </span>
                    <input
                        inputMode="numeric"
                        value={form.data.most_per_item}
                        onChange={(event) =>
                            form.setData(
                                'most_per_item',
                                wholeNumberInput(
                                    event.target.value,
                                    setting.max,
                                ),
                            )
                        }
                        placeholder="500"
                        aria-invalid={form.errors.most_per_item !== undefined}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                    />
                </label>
                <InputError message={form.errors.most_per_item} />
                <button
                    type="submit"
                    disabled={form.processing}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0D6EFD] px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {form.processing ? (
                        <LoaderCircle size={16} className="animate-spin" />
                    ) : (
                        <UserPlus size={16} />
                    )}
                    Allow
                </button>
            </form>

            {removing && (
                <ConfirmDialog
                    open
                    title={`Remove ${removing.name}?`}
                    description={`${removing.name} goes back to the limit for everyone: ${setting.value.toLocaleString('en-PH')} of one item. A cart line above it must be lowered before they can order.`}
                    cancelLabel="Keep"
                    confirmLabel="Remove"
                    tone="red"
                    busy={busy}
                    onConfirm={() => remove(removing)}
                    onClose={() => setRemoving(null)}
                />
            )}
        </div>
    );
}

/**
 * The left side of a setting: what it does, an example, and who changed
 * it last.
 */
function SettingText({
    icon,
    title,
    explanation,
    example,
    setting,
}: {
    icon: ReactNode;
    title: string;
    explanation: string;
    example: string;
    setting: { changed_at: string | null; changed_by: string | null };
}) {
    return (
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
    );
}

function SaveButton({
    disabled,
    processing,
}: {
    disabled: boolean;
    processing: boolean;
}) {
    return (
        <button
            type="submit"
            disabled={disabled || processing}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0D6EFD] px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
            {processing ? (
                <LoaderCircle size={16} className="animate-spin" />
            ) : (
                <Save size={16} />
            )}
            Save
        </button>
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
                {!changed && (
                    <p className="text-center text-xs font-semibold text-slate-500">
                        Choose a different number to save.
                    </p>
                )}
            </form>
        </div>
    );
}
