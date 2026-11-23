import { router } from 'expo-router';
import { ArrowLeft, Boxes, CircleCheck, PackagePlus, Search, TriangleAlert, Unlink, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DraftRestoredNotice from '@/components/DraftRestoredNotice';
import RequiredLabel from '@/components/RequiredLabel';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatConversion, formatUnits, unitWord } from '@/lib/format';
import type { WaitingDeliveryGroup } from '@/lib/types';
import { useDraft, useUnsavedChanges } from '@/lib/unsaved-changes';

/** An SI # or DR #: letters, numbers, spaces, hyphens and slashes (as the server checks). */
const PAPER_NUMBER = /^[A-Za-z0-9](?:[A-Za-z0-9 /-]*[A-Za-z0-9])?$/;

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

/**
 * Record Delivery on the Specialist's phone, with the website's rules: SI #
 * and DR # (required: they confirm the delivery), and how many of each waiting item arrived (it is received on the
 * day it is recorded). A total fills the oldest order first. Each Item Code is
 * one size or color, so a linked item goes into that one; the others are
 * recorded and wait to be linked on the website.
 */
export default function RecordDeliveryScreen() {
    const insets = useSafeAreaInsets();
    const { request } = useAuth();
    const [groups, setGroups] = useState<WaitingDeliveryGroup[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [salesInvoice, setSalesInvoice] = useState('');
    const [deliveryReceipt, setDeliveryReceipt] = useState('');
    const [note, setNote] = useState('');
    const [totals, setTotals] = useState<Record<string, string>>({});
    const [searchText, setSearchText] = useState('');

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{ type: 'success' | 'warning'; message: string } | null>(null);

    // What was counted is kept until saved, and leaving asks first (like the website).
    const typed = { salesInvoice, deliveryReceipt, note, totals };
    const draft = useDraft('delivery', typed, (saved) => {
        setSalesInvoice(saved.salesInvoice);
        setDeliveryReceipt(saved.deliveryReceipt);
        setNote(saved.note);
        setTotals(saved.totals);
    });
    const hasTyping = [salesInvoice, deliveryReceipt, note, ...Object.values(totals)].some((value) => value.trim() !== '');
    useUnsavedChanges(hasTyping && !saving && result === null, { discardDraft: draft.discard });

    useEffect(() => {
        request<{ groups: WaitingDeliveryGroup[] }>('/specialist/deliveries/waiting')
            .then((answer) => setGroups(answer.groups))
            .catch((caught) =>
                setLoadError(caught instanceof ApiError ? caught.message : 'The waiting items could not be loaded. Go back and try again.'),
            );
    }, [request]);

    /** How many arrived for a code, in Head Office's unit; null when not a number. */
    const unitsFor = (group: WaitingDeliveryGroup): number | null => wholeNumber(totals[group.item_code]);
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

    /** Why a code's number cannot be saved, in the website's words. */
    const problemOf = (group: WaitingDeliveryGroup): string | null => {
        const remaining = remainingOf(group);
        const typed = wholeNumber(totals[group.item_code]);

        return typed === null
            ? 'Enter a whole number, e.g. 5.'
            : typed > remaining
              ? `Only ${remaining.toLocaleString('en-PH')} left to receive for this item.`
              : null;
    };
    const all = groups ?? [];
    const receiving = all.filter((group) => (unitsFor(group) ?? 0) > 0);
    const problems = all.filter((group) => problemOf(group) !== null);
    const piecesIntoStock = receiving.reduce(
        (sum, group) => sum + (group.stock_target ? (unitsFor(group) ?? 0) * group.stock_target.pieces_per_unit : 0),
        0,
    );
    const notLinked = receiving.filter((group) => group.stock_target === null).length;
    // The SI # and DR # confirm the delivery: both required, in the website's words.
    const paperProblem = (typed: string, label: 'SI #' | 'DR #', example: string): string | null =>
        typed.trim() === '' || PAPER_NUMBER.test(typed.trim())
            ? null
            : `The ${label} may have only letters, numbers, spaces, hyphens and slashes, e.g. ${example}.`;
    const salesInvoiceProblem = paperProblem(salesInvoice, 'SI #', 'SI-00123');
    const deliveryReceiptProblem = paperProblem(deliveryReceipt, 'DR #', 'DR-04567');
    const papersMissing = salesInvoice.trim() === '' || deliveryReceipt.trim() === '';
    const papersWrong = salesInvoiceProblem !== null || deliveryReceiptProblem !== null;
    const canSave = !saving && receiving.length > 0 && problems.length === 0 && !papersMissing && !papersWrong;

    const term = searchText.trim().toLowerCase().replace(/^#/, '');
    const visible = all.filter(
        (group) =>
            term === '' ||
            group.item_code.toLowerCase().includes(term) ||
            group.description.toLowerCase().includes(term) ||
            group.rows.some((row) => (row.order_number ?? '').toLowerCase().includes(term)),
    );

    /** "Everything arrived": what is left of every item shown arrived. */
    const fillShown = (): void =>
        setTotals({ ...totals, ...Object.fromEntries(visible.map((group) => [group.item_code, String(remainingOf(group))])) });
    const everythingShownTyped = visible.every((group) => totals[group.item_code] === String(remainingOf(group)));

    // Saving adds the stock and serves and notifies waiting buyers at once,
    // and cannot be undone, so the Specialist answers first.
    const save = (): void => {
        if (!canSave) {
            return;
        }

        const added = piecesIntoStock > 0 ? `It adds ${formatUnits(piecesIntoStock, 'Piece')} to stock now. ` : 'It is recorded on the order. ';
        const unlinked =
            notLinked > 0 ? `${notLinked === 1 ? '1 item is' : `${notLinked} items are`} not linked to a product, so only recorded. ` : '';

        Alert.alert(
            'Stock in this delivery?',
            `${added}${unlinked}Buyers waiting for these items are served first and notified. This cannot be undone.`,
            [
                { text: 'Check again', style: 'cancel' },
                { text: 'Stock in', onPress: () => void record() },
            ],
        );
    };

    const record = async (): Promise<void> => {
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

        try {
            const saved = await request<{ type: 'success' | 'warning'; message: string }>('/specialist/deliveries', {
                    method: 'POST',
                    body: {
                        sales_invoice_number: salesInvoice.trim(),
                        delivery_receipt_number: deliveryReceipt.trim(),
                        note: note.trim(),
                        items,
                    },
            });
            draft.clear();
            setResult(saved);
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.message : 'The delivery could not be recorded. Try again.');
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
                    <Text className="font-sans-bold text-base text-white">Back to Stock In</Text>
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
                    <Text className="font-sans-bold text-2xl text-slate-900">Stock In</Text>
                    <Text className="mt-1 font-sans text-sm text-slate-500">
                        Count what arrived and type it below. PROWARE fills the oldest order first.
                    </Text>
                </View>

                {draft.restored && <DraftRestoredNotice onDiscard={draft.discard} />}

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
                            <View className="flex-row gap-2">
                                <View className="flex-1 gap-1">
                                    <Text className="font-sans-bold text-xs text-slate-600">
                                        <RequiredLabel required={salesInvoice.trim() === ''}>SI # (Sales Invoice)</RequiredLabel>
                                    </Text>
                                    <Field
                                        value={salesInvoice}
                                        onChangeText={(value) => {
                                            setSalesInvoice(value);
                                            setError(null);
                                        }}
                                        maxLength={40}
                                        autoCapitalize="characters"
                                    />
                                    {salesInvoiceProblem && <Text className="font-sans-semibold text-xs text-red-600">{salesInvoiceProblem}</Text>}
                                </View>
                                <View className="flex-1 gap-1">
                                    <Text className="font-sans-bold text-xs text-slate-600">
                                        <RequiredLabel required={deliveryReceipt.trim() === ''}>DR # (Delivery Receipt)</RequiredLabel>
                                    </Text>
                                    <Field
                                        value={deliveryReceipt}
                                        onChangeText={(value) => {
                                            setDeliveryReceipt(value);
                                            setError(null);
                                        }}
                                        maxLength={40}
                                        autoCapitalize="characters"
                                    />
                                    {deliveryReceiptProblem && <Text className="font-sans-semibold text-xs text-red-600">{deliveryReceiptProblem}</Text>}
                                </View>
                            </View>
                            <View className="gap-1">
                                <Text className="font-sans-bold text-xs text-slate-600">Note</Text>
                                <Field value={note} onChangeText={setNote} maxLength={500} placeholder="e.g. 1 box slightly damaged" />
                            </View>
                        </View>

                        <View className="gap-2">
                            <Text className="font-sans-bold text-sm text-slate-900">WHAT ARRIVED</Text>
                            {/* Goes once at least one item is filled in correctly. */}
                            {(receiving.length === 0 || problems.length > 0) && (
                                <Text className="font-sans text-sm text-slate-600">
                                    Type at least one <RequiredLabel>How many arrived</RequiredLabel> before Stock In can be pressed.
                                </Text>
                            )}
                            <Pressable
                                onPress={fillShown}
                                disabled={visible.length === 0 || everythingShownTyped}
                                accessibilityRole="button"
                                className={`flex-row items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-3 ${visible.length === 0 || everythingShownTyped ? 'opacity-50' : ''}`}
                            >
                                <Boxes size={17} color="#047857" />
                                <Text className="font-sans-bold text-sm text-emerald-800">
                                    {term === '' ? 'Everything arrived' : 'Everything shown arrived'}
                                </Text>
                            </Pressable>
                        </View>

                        <View className="flex-row items-center gap-2 rounded-full border border-slate-200 bg-white px-4">
                            <Search size={17} color="#94a3b8" />
                            <TextInput
                                value={searchText}
                                onChangeText={setSearchText} maxLength={120}
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
                                onTotal={(value) => setTotals({ ...totals, [group.item_code]: value.slice(0, 12) })}
                                units={unitsFor(group) ?? 0}
                                shares={sharesFor(group)}
                                problem={problemOf(group)}
                                // "*… required" stays on a wrong box, or on all while none is filled in.
                                needed={problemOf(group) !== null || receiving.length === 0}
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
                    {problems.length > 0 || papersWrong ? (
                        <Text className="font-sans-bold text-xs text-red-600">Fix the boxes marked in red first.</Text>
                    ) : papersMissing ? (
                        <Text className="font-sans-bold text-xs text-amber-800">Enter the SI # and DR # from Head Office&apos;s papers.</Text>
                    ) : (
                        receiving.length === 0 && (
                            <Text className="font-sans-bold text-xs text-amber-800">
                                Type how many arrived, or press Everything arrived.
                            </Text>
                        )
                    )}
                    {/* What saving adds shows only once the numbers can be saved. */}
                    {receiving.length > 0 && problems.length === 0 && (
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
                        <Text className="font-sans-bold text-base text-white">Stock In</Text>
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
    units,
    shares,
    problem,
    needed,
}: {
    group: WaitingDeliveryGroup;
    total: string;
    onTotal: (value: string) => void;
    units: number;
    shares: Map<number, number>;
    problem: string | null;
    needed: boolean;
}) {
    const target = group.stock_target;
    const remaining = remainingOf(group);

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
                        Goes into:{' '}
                        <Text className="font-sans-bold">
                            {target.product_name}
                            {target.has_options ? ` · ${target.variant_label}` : ''}
                        </Text>
                        {target.pieces_per_unit > 1 ? ` · by the ${target.unit_name} (${target.pieces_per_unit} pcs each)` : ''}
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

            <View className="gap-1">
                    <RequiredLabel required={needed}>How many arrived</RequiredLabel>
                    <View className="flex-row items-center gap-3">
                        <TextInput
                            value={total}
                            // Kept as typed (".5", "-1", letters): a wrong number shows in red and blocks Stock In.
                            onChangeText={onTotal}
                            keyboardType="numbers-and-punctuation"
                            placeholder="0"
                            placeholderTextColor="#94a3b8"
                            accessibilityLabel={`How many ${group.item_code} arrived`}
                            className={`w-28 rounded-xl border bg-white px-3 py-2.5 text-right font-sans-bold text-base text-slate-900 ${problem ? 'border-red-400' : 'border-slate-200'}`}
                        />
                        <Text className="flex-1 font-sans-semibold text-sm text-slate-500">
                            {target ? unitWord(units, target.unit_name) : 'as ordered on the eStore'}
                        </Text>
                    </View>
                    {target && units > 0 && problem === null && (
                        <Text className="font-sans-bold text-xs text-emerald-700">
                            Into stock: {formatConversion(units, target.unit_name, target.pieces_per_unit)}
                        </Text>
                    )}
                </View>

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
                            {now > 0 && problem === null ? (
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
