import { CircleCheck } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { formatDateTime, formatPeso, formatUnits } from '@/lib/format';
import type { SpecialistOrder } from '@/lib/types';

/*
 * The Specialist's order buttons, shared by the order screen and a scanned
 * issuance slip, so both work the same way as the website.
 */

export function ActionButton({
    tone,
    icon,
    busy,
    disabled = false,
    small = false,
    onPress,
    children,
}: {
    tone: 'blue' | 'green' | 'red' | 'plain';
    icon: ReactNode;
    busy: boolean;
    disabled?: boolean;
    /** The quieter size for the less common steps (Undo, Cancel). */
    small?: boolean;
    onPress: () => void;
    children: string;
}) {
    const classes = {
        blue: 'bg-brand',
        green: 'bg-emerald-600',
        red: 'border border-red-200 bg-red-50',
        plain: 'border border-slate-200 bg-white',
    }[tone];
    const text = { blue: 'text-white', green: 'text-white', red: 'text-red-700', plain: 'text-slate-700' }[tone];

    return (
        <Pressable
            onPress={onPress}
            disabled={busy || disabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy || disabled }}
            className={`flex-row items-center justify-center gap-2 ${small ? 'rounded-xl px-3 py-3' : 'rounded-2xl py-4'} ${classes} ${busy || disabled ? 'opacity-50' : ''}`}
        >
            {icon}
            <Text className={`font-sans-bold ${small ? 'text-sm' : 'text-base'} ${text}`}>{children}</Text>
        </Pressable>
    );
}


/**
 * Release, like the website's order popup: once the cashier marked the
 * order paid (panel revision, 20 Nov 2026), one green box shows what was
 * paid and Release the items (they leave the shelf only now). There is no
 * receipt box any more: the cashier's Paid is the check.
 */
export function ReleaseBox({
    order,
    busy,
    onRelease,
}: {
    order: SpecialistOrder;
    busy: boolean;
    onRelease: () => void;
}) {
    const short = order.items.filter((item) => item.quantity_short > 0);

    return (
        <View className="gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
            <Text className="font-sans-bold text-xs uppercase tracking-wide text-emerald-800">Paid at the cashier</Text>
            <Text className="font-sans-bold text-3xl text-emerald-700">{formatPeso(order.total_centavos)}</Text>
            {order.paid_at ? (
                <Text className="font-sans-semibold text-xs text-emerald-900">
                    {formatDateTime(order.paid_at)}
                    {order.paid_to ? ` · ${order.paid_to}` : ''}
                </Text>
            ) : null}
            {short.length > 0 && (
                <Text className="rounded-xl bg-amber-50 px-3 py-2 font-sans-semibold text-sm leading-5 text-amber-900">
                    Not paid for (sold out before payment). Do not hand over:{' '}
                    {short
                        .map((item) => `${formatUnits(item.quantity_short, item.unit_name)} of ${item.product_name}${item.variant_label ? ` (${item.variant_label})` : ''}`)
                        .join(', ')}
                </Text>
            )}
            <ActionButton
                tone="green"
                icon={busy ? <ActivityIndicator color="#ffffff" /> : <CircleCheck size={18} color="#ffffff" />}
                busy={busy}
                onPress={() => confirmRelease(order, onRelease)}
            >
                Release the items
            </ActionButton>
            <Text className="font-sans-semibold text-xs text-emerald-900/70">
                The items will be deducted from stock immediately. This action cannot be undone.
            </Text>
        </View>
    );
}

/**
 * "Release Order PW-0042 to Juan Dela Cruz?": the items leave the stock and a
 * release is final, so the Specialist answers first, like the website.
 */
function confirmRelease(order: SpecialistOrder, onRelease: () => void): void {
    // What was paid for (a line short at payment is not handed over).
    const pieces = order.items.reduce((sum, item) => sum + (item.quantity - item.quantity_short) * item.pieces_per_unit, 0);
    const piecesText = `${pieces} ${pieces === 1 ? 'pc' : 'pcs'}`;
    const first = order.items[0];
    const what =
        order.items.length === 1 && first
            ? `${piecesText} of ${first.product_name}${first.variant_label ? ` (${first.variant_label})` : ''}`
            : `${order.items.length} items (${piecesText})`;

    Alert.alert(
        `Release Order ${order.number} to ${order.student_name}?`,
        `${what} ${pieces === 1 ? 'leaves' : 'leave'} the stock now. This action cannot be undone.`,
        [
            { text: 'Check again', style: 'cancel' },
            { text: 'Release', onPress: onRelease },
        ],
    );
}