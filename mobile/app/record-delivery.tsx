import { router } from 'expo-router';
import { ArrowLeft, Boxes, CircleCheck, PackagePlus, Search, TriangleAlert, Unlink, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatConversion, formatDate, formatUnits, isoDate, unitWord } from '@/lib/format';
import type { WaitingDeliveryGroup } from '@/lib/types';

type DateChoice = 'today' | 'yesterday' | 'other';

/** '' counts as 0; anything but digits is not a number (null). */
function wholeNumber(text: string | undefined): number | null {
    const trimmed = (text ?? '').trim();

    if (trimmed === '') {
        return 0;
    }

    return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

const remainingOf = (group: WaitingDeliveryGroup): number =>
    group.rows.reduce((sum, row) => sum + row.quantity_remaining, 0);

const isSplit = (group: WaitingDeliveryGroup): boolean => (group.stock_target?.split_into.length ?? 0) > 1;

/**
 * Record Delivery on the Specialist's phone, with the website's rules: the
 * date (today by default), SI # and DR #, and how many of each waiting item
 * arrived. A total fills the oldest order first. An item code shared by
 * several variants (e.g. every color) is counted per variant, and the counts
 * must make whole boxes. Linked items go into stock; the others are
 * recorded and wait to be linked on the website.
 */
export default function RecordDeliveryScreen() {
    const insets = useSafeAreaInsets();
    const { request } = useAuth();
    const [groups, setGroups] = useState<WaitingDeliveryGroup[] | null>(null);
    const [today, setToday] = useState(isoDate(new Date()));
    const [loadError, setLoadError] = useState<string | null>(null);

    const [dateChoice, setDateChoice] = useState<DateChoice>('today');
    const [otherDate, setOtherDate] = useState('');
    const [salesInvoice, setSalesInvoice] = useState('');
    const [deliveryReceipt, setDeliveryReceipt] = useState('');
    const [note, setNote] = useState('');
    const [totals, setTotals] = useState<Record<string, string>>({});
    const [splitCounts, setSplitCounts] = useState<Record<string, Record<number, string>>>({});
    const [searchText, setSearchText] = useState('');

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{ type: 'success' | 'warning'; message: string } | null>(null);

    useEffect(() => {
        request<{ groups: WaitingDeliveryGroup[]; today: string }>('/specialist/deliveries/waiting')
            .then((answer) => {
                setGroups(answer.groups);
                setToday(answer.today);
            })
            .catch((caught) =>
                setLoadError(caught instanceof ApiError ? caught.message : 'The waiting items could not be loaded. Go back and try again.'),
            );
    }, [request]);

    const yesterday = useMemo(() => {
        const [year, month, day] = today.split('-').map(Number);

        return isoDate(new Date(year, month - 1, day - 1));
    }, [today]);
    const receivedOn = dateChoice === 'today' ? today : dateChoice === 'yesterday' ? yesterday : otherDate.trim();

    /** How many arrived for a code, in Head Office's unit; null when not a number. */
    const unitsFor = (group: WaitingDeliveryGroup): number | null => {
        if (!isSplit(group)) {
            return wholeNumber(totals[group.item_code]);
        }

        const counted = countedPieces(group);
        const perUnit = group.stock_target?.pieces_per_unit ?? 1;

        return counted === null || counted % perUnit !== 0 ? null : counted / perUnit;
    };

    const countedPieces = (group: WaitingDeliveryGroup): number | null => {
        let total = 0;

        for (const variant of group.stock_target?.split_into ?? []) {
            const pieces = wholeNumber(splitCounts[group.item_code]?.[variant.id]);

            if (pieces === null) {
                return null;
            }

            total += pieces;
        }

        return total;
    };

    /** The units for a code shared out over its orders, oldest first. */
    const sharesFor = (group: WaitingDeliveryGroup): Map<number, number> => {
        let left = unitsFor(group) ?? 0;
        const shares = new Map<number, number>();

        for (const row of group.rows) {
            const share = Math.min(left, row.quantity_remaining);
            shares.set(row.purchase_order_item_id, share);
            left -= share;
        }

        return shares;
    };

    /** Why a code's numbers cannot be saved, in the website's words. */
    const problemOf = (group: WaitingDeliveryGroup): string | null => {
        const remaining = remainingOf(group);
        const target = group.stock_target;

        if (!isSplit(group)) {
            const typed = wholeNumber(totals[group.item_code]);

            return typed === null
                ? 'Enter a whole number.'
                : typed > remaining
                  ? `Only ${remaining.toLocaleString('en-PH')} left to receive for this item.`
                  : null;
        }

        const counted = countedPieces(group);
        const perUnit = target?.pieces_per_unit ?? 1;

        if (counted === null) {
            return 'Enter whole numbers.';
        }

        if (counted % perUnit !== 0) {
            return `Your counts add up to ${formatUnits(counted, 'Piece')}, but Head Office sends this by the ${target?.unit_name} of ${perUnit} pcs, so the total must be a multiple of ${perUnit}.`;
        }

        if (counted / perUnit > remaining) {
            return `Only ${formatUnits(remaining * perUnit, 'Piece')} left to receive for this item.`;
        }

        return null;
    };

    const all = groups ?? [];
    const receiving = all.filter((group) => (unitsFor(group) ?? 0) > 0);
    const problems = all.filter((group) => problemOf(group) !== null);
    const piecesIntoStock = receiving.reduce(
        (sum, group) => sum + (group.stock_target ? (unitsFor(group) ?? 0) * group.stock_target.pieces_per_unit : 0),
        0,
    );
    const notLinked = receiving.filter((group) => group.stock_target === null).length;
    const dateProblem =
        dateChoice === 'other' && !/^\d{4}-\d{2}-\d{2}$/.test(receivedOn)
            ? 'Type the date as YYYY-MM-DD, e.g. 2026-10-03.'
            : receivedOn > today
              ? 'The date received cannot be in the future.'
              : null;
    const canSave = !saving && receiving.length > 0 && problems.length === 0 && dateProblem === null;

    const term = searchText.trim().toLowerCase().replace(/^#/, '');
    const visible = all.filter(
        (group) =>
            term === '' ||
            group.item_code.toLowerCase().includes(term) ||
            group.description.toLowerCase().includes(term) ||
            group.rows.some((row) => (row.order_number ?? '').toLowerCase().includes(term)),
    );

    const save = async (): Promise<void> => {
        if (!canSave) {
            return;
        }

        setSaving(true);
        setError(null);

        const items = receiving.flatMap((group) =>
            [...sharesFor(group)]
                .filter(([, quantity]) => quantity > 0)
                .map(([purchaseOrderItemId, quantity]) => ({
                    purchase_order_item_id: purchaseOrderItemId,
                    quantity_received: quantity,
                })),
        );
        const splits = receiving.filter(isSplit).map((group) => ({
            item_code: group.item_code,
            pieces: (group.stock_target?.split_into ?? []).map((variant) => ({
                product_variant_id: variant.id,
                pieces: wholeNumber(splitCounts[group.item_code]?.[variant.id]) ?? 0,
            })),
        }));

        try {
            setResult(
                await request<{ type: 'success' | 'warning'; message: string }>('/specialist/deliveries', {
                    method: 'POST',
                    body: {
                        received_on: receivedOn,
                        sales_invoice_number: salesInvoice.trim(),
                        delivery_receipt_number: deliveryReceipt.trim(),
                        note: note.trim(),
                        items,
                        splits,
                    },
                }),
            );
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.message : 'The delivery could not be recorded. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (result) {
        const warning = result.type === 'warning';

        return (
            <ScrollView
                className="flex-1 bg-page"
                contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: 32, paddingHorizontal: 16, gap: 16 }}
            >
                <View
                    className={`items-center gap-2 rounded-3xl border px-5 py-6 ${warning ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}
                >
                    {warning ? <TriangleAlert size={44} color="#b45309" /> : <CircleCheck size={44} color="#059669" />}
                    <Text className={`font-sans-bold text-xl ${warning ? 'text-amber-900' : 'text-emerald-900'}`}>
                        Delivery recorded
                    </Text>
                    <Text className={`text-center font-sans text-sm leading-5 ${warning ? 'text-amber-900' : 'text-emerald-900'}`}>
                        {result.message.replace(/^Delivery recorded\.\s*/, '')}
                    </Text>
                </View>
                <Pressable
                    onPress={() => router.back()}
                    accessibilityRole="button"
                    className="items-center rounded-2xl bg-brand py-4"
                >
                    <Text className="font-sans-bold text-base text-white">Back to Deliveries</Text>
                </Pressable>
            </ScrollView>
        );
    }

    return (
        <KeyboardAvoidingView className="flex-1 bg-page" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
                contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 24, paddingHorizontal: 16, gap: 16 }}
                keyboardShouldPersistTaps="handled"
            >
                <Pressable
                    onPress={() => router.back()}
                    accessibilityRole="button"
                    className="flex-row items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2"
                >
                    <ArrowLeft size={17} color="#334155" />
                    <Text className="font-sans-bold text-sm text-slate-700">Back</Text>
                </Pressable>

                <View>
                    <Text className="font-sans-bold text-2xl text-slate-900">Record Delivery</Text>
                    <Text className="mt-1 font-sans text-sm text-slate-500">
                        Count what arrived and type it below. PROWARE fills the oldest order first.
                    </Text>
                </View>

                {loadError ? (
                    <Text className="font-sans-semibold text-sm text-red-600">{loadError}</Text>
                ) : groups === null ? (
                    <ActivityIndicator color="#0D6EFD" className="mt-10" />
                ) : groups.length === 0 ? (
                    <View className="items-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12">
                        <Boxes size={40} color="#cbd5e1" />
                        <Text className="mt-3 font-sans-bold text-lg text-slate-800">Nothing is waiting for delivery</Text>
                        <Text className="mt-1 text-center font-sans text-sm text-slate-500">
                            Every uploaded order has arrived or was closed. Upload new orders on the website.
                        </Text>
                    </View>
                ) : (
                    <>
                        <View className="gap-3 rounded-3xl border border-slate-200 bg-white p-4">
                            <Text className="font-sans-bold text-sm text-slate-700">Date received</Text>
                            <View className="flex-row gap-2">
                                {(['today', 'yesterday', 'other'] as const).map((choice) => (
                                    <Pressable
                                        key={choice}
                                        onPress={() => setDateChoice(choice)}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: dateChoice === choice }}
                                        className={`flex-1 items-center rounded-xl border px-2 py-2.5 ${dateChoice === choice ? 'border-brand bg-brand' : 'border-slate-200 bg-white'}`}
                                    >
                                        <Text
                                            numberOfLines={1}
                                            className={`font-sans-bold text-xs ${dateChoice === choice ? 'text-white' : 'text-slate-600'}`}
                                        >
                                            {choice === 'today' ? 'Today' : choice === 'yesterday' ? 'Yesterday' : 'Other date'}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                            {dateChoice === 'other' ? (
                                <Field value={otherDate} onChangeText={setOtherDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
                            ) : (
                                <Text className="font-sans text-sm text-slate-600">{formatDate(receivedOn)}</Text>
                            )}
                            {dateProblem && <Text className="font-sans-semibold text-sm text-red-600">{dateProblem}</Text>}

                            <View className="flex-row gap-2">
                                <View className="flex-1 gap-1">
                                    <Text className="font-sans-bold text-xs text-slate-600">SI # (optional)</Text>
                                    <Field value={salesInvoice} onChangeText={setSalesInvoice} maxLength={40} />
                                </View>
                                <View className="flex-1 gap-1">
                                    <Text className="font-sans-bold text-xs text-slate-600">DR # (optional)</Text>
                                    <Field value={deliveryReceipt} onChangeText={setDeliveryReceipt} maxLength={40} />
                                </View>
                            </View>
                            <View className="gap-1">
                                <Text className="font-sans-bold text-xs text-slate-600">Note (optional)</Text>
                                <Field value={note} onChangeText={setNote} maxLength={500} />
                            </View>
                        </View>

                        <View className="flex-row items-center gap-2 rounded-full border border-slate-200 bg-white px-4">
                            <Search size={17} color="#94a3b8" />
                            <TextInput
                                value={searchText}
                                onChangeText={setSearchText}
                                placeholder="Item code, name or Order #"
                                placeholderTextColor="#94a3b8"
                                autoCorrect={false}
                                className="flex-1 py-3 font-sans-medium text-sm text-slate-900"
                            />
                            {searchText !== '' && (
                                <Pressable onPress={() => setSearchText('')} accessibilityLabel="Clear search" hitSlop={10}>
                                    <X size={17} color="#64748b" />
                                </Pressable>
                            )}
                        </View>

                        {visible.length === 0 && (
                            <Text className="font-sans text-sm text-slate-500">No waiting item matches your search.</Text>
                        )}

                        {visible.map((group) => (
                            <GroupCard
                                key={group.item_code}
                                group={group}
                                total={totals[group.item_code] ?? ''}
                                onTotal={(value) => setTotals({ ...totals, [group.item_code]: value })}
                                counts={splitCounts[group.item_code] ?? {}}
                                onCount={(variantId, value) =>
                                    setSplitCounts({
                                        ...splitCounts,
                                        [group.item_code]: { ...splitCounts[group.item_code], [variantId]: value },
                                    })
                                }
                                counted={countedPieces(group)}
                                units={unitsFor(group) ?? 0}
                                shares={sharesFor(group)}
                                problem={problemOf(group)}
                            />
                        ))}
                    </>
                )}
            </ScrollView>

            {groups !== null && groups.length > 0 && (
                <View
                    style={{ paddingBottom: insets.bottom + 12 }}
                    className="gap-2 border-t border-slate-200 bg-white px-4 pt-3"
                >
                    {error && <Text className="font-sans-semibold text-sm text-red-600">{error}</Text>}
                    {receiving.length > 0 && (
                        <Text className="font-sans text-xs text-slate-600">
                            {receiving.length} {receiving.length === 1 ? 'item' : 'items'} received
                            {piecesIntoStock > 0 ? ` · ${formatUnits(piecesIntoStock, 'Piece')} into stock` : ''}
                            {notLinked > 0 ? ` · ${notLinked} not linked (recorded, not in stock)` : ''}
                        </Text>
                    )}
                    <Pressable
                        onPress={save}
                        disabled={!canSave}
                        accessibilityRole="button"
                        className={`flex-row items-center justify-center gap-2 rounded-2xl bg-brand py-4 ${canSave ? '' : 'opacity-50'}`}
                    >
                        {saving ? <ActivityIndicator color="#ffffff" /> : <PackagePlus size={18} color="#ffffff" />}
                        <Text className="font-sans-bold text-base text-white">Record Delivery</Text>
                    </Pressable>
                </View>
            )}
        </KeyboardAvoidingView>
    );
}

function Field(props: React.ComponentProps<typeof TextInput>) {
    return (
        <TextInput
            placeholderTextColor="#94a3b8"
            autoCorrect={false}
            {...props}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-sans text-sm text-slate-900"
        />
    );
}

function GroupCard({
    group,
    total,
    onTotal,
    counts,
    onCount,
    counted,
    units,
    shares,
    problem,
}: {
    group: WaitingDeliveryGroup;
    total: string;
    onTotal: (value: string) => void;
    counts: Record<number, string>;
    onCount: (variantId: number, value: string) => void;
    counted: number | null;
    units: number;
    shares: Map<number, number>;
    problem: string | null;
}) {
    const target = group.stock_target;
    const remaining = remainingOf(group);
    const split = isSplit(group);

    return (
        <View
            style={{ borderLeftWidth: 5, borderLeftColor: problem ? '#f87171' : units > 0 ? '#10b981' : '#e2e8f0' }}
            className="gap-3 rounded-2xl border border-slate-200 bg-white p-4"
        >
            <View>
                <Text className="font-sans-bold text-base text-slate-900">{group.item_code}</Text>
                <Text className="font-sans text-sm text-slate-600">{group.description}</Text>
                <Text className="mt-1 font-sans-semibold text-xs text-slate-500">
                    {target ? formatUnits(remaining, target.unit_name) : `${remaining.toLocaleString('en-PH')} (as ordered on the eStore)`} still to
                    come across {group.rows.length} {group.rows.length === 1 ? 'order' : 'orders'}
                </Text>
            </View>

            {target ? (
                <View className="flex-row items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2">
                    <Boxes size={15} color="#047857" />
                    <Text className="flex-1 font-sans text-xs leading-5 text-emerald-900">
                        Into stock:{' '}
                        <Text className="font-sans-bold">
                            {target.product_name}
                            {split ? '' : target.has_options ? ` (${target.variant_label})` : ''}
                        </Text>
                        {' · '}
                        {target.pieces_per_unit > 1
                            ? `sent by the ${target.unit_name} (${target.pieces_per_unit} pcs each)`
                            : 'sent by the piece'}
                    </Text>
                </View>
            ) : (
                <View className="flex-row items-start gap-2 rounded-xl bg-amber-50 px-3 py-2">
                    <Unlink size={15} color="#b45309" />
                    <Text className="flex-1 font-sans text-xs leading-5 text-amber-900">
                        Not linked to a product yet: it is recorded but not added to stock. Link it on the website.
                    </Text>
                </View>
            )}

            {split && target ? (
                <View className="gap-2">
                    <Text className="font-sans-bold text-sm text-slate-700">How many of each arrived (pcs)</Text>
                    {target.split_into.map((variant) => (
                        <View key={variant.id} className="flex-row items-center gap-3">
                            <Text className="flex-1 font-sans-semibold text-sm text-slate-800">{variant.label}</Text>
                            <TextInput
                                value={counts[variant.id] ?? ''}
                                onChangeText={(value) => onCount(variant.id, value.replace(/\D/g, '').slice(0, 7))}
                                keyboardType="number-pad"
                                placeholder="0"
                                placeholderTextColor="#94a3b8"
                                accessibilityLabel={`${variant.label} pieces`}
                                className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-right font-sans-bold text-base text-slate-900"
                            />
                        </View>
                    ))}
                    <Text className="font-sans-semibold text-xs text-slate-600">
                        Total counted: {formatUnits(counted ?? 0, 'Piece')}
                    </Text>
                </View>
            ) : (
                <View className="gap-1">
                    <Text className="font-sans-bold text-sm text-slate-700">How many arrived</Text>
                    <View className="flex-row items-center gap-3">
                        <TextInput
                            value={total}
                            onChangeText={(value) => onTotal(value.replace(/\D/g, '').slice(0, 7))}
                            keyboardType="number-pad"
                            placeholder="0"
                            placeholderTextColor="#94a3b8"
                            accessibilityLabel={`How many ${group.item_code} arrived`}
                            className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-right font-sans-bold text-base text-slate-900"
                        />
                        <Text className="font-sans-semibold text-sm text-slate-500">
                            {target ? unitWord(units, target.unit_name) : 'as ordered on the eStore'}
                        </Text>
                    </View>
                    {target && units > 0 && problem === null && (
                        <Text className="font-sans-bold text-xs text-emerald-700">
                            Into stock: {formatConversion(units, target.unit_name, target.pieces_per_unit)}
                        </Text>
                    )}
                </View>
            )}

            {problem && <Text className="font-sans-semibold text-sm text-red-600">{problem}</Text>}

            <View className="gap-1 rounded-xl bg-slate-50 px-3 py-2">
                {group.rows.map((row) => {
                    const now = shares.get(row.purchase_order_item_id) ?? 0;

                    return (
                        <Text key={row.purchase_order_item_id} className="font-sans text-xs text-slate-600">
                            <Text className="font-sans-bold text-blue-700">
                                {row.order_number ? `#${row.order_number}` : 'No Order #'}
                            </Text>
                            {` · ${row.quantity_remaining.toLocaleString('en-PH')} of ${row.quantity_ordered.toLocaleString('en-PH')} left`}
                            {now > 0 ? (
                                <Text className="font-sans-bold text-emerald-700">{` → receives ${now.toLocaleString('en-PH')}`}</Text>
                            ) : (
                                ''
                            )}
                        </Text>
                    );
                })}
            </View>
        </View>
    );
}
