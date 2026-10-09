import { Banknote, Check, XCircle } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import BottomSheet from '@/components/BottomSheet';
import { formatPeso } from '@/lib/format';
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
 * Release as three numbered steps, like the website's slip page: collect
 * the amount (shown large), tick "The student has paid", and only then
 * release the items (they leave the shelf only now). The tick clears after
 * each release.
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
    const [paid, setPaid] = useState(false);

    useEffect(() => {
        setPaid(false);
    }, [order.id, order.status]);

    return (
        <View className="gap-4 rounded-3xl border border-slate-200 bg-white p-4">
            <ReleaseStep number={1} title="Collect the payment">
                <Text className="font-sans-bold text-3xl text-emerald-700">
                    {formatPeso(order.total_centavos)}
                </Text>
            </ReleaseStep>
            <ReleaseStep number={2} title="Confirm it">
                <Pressable
                    onPress={() => setPaid(!paid)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: paid }}
                    className={`flex-row items-center gap-3 rounded-2xl border px-4 py-3.5 ${paid ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}
                >
                    <View
                        className={`h-6 w-6 items-center justify-center rounded-md border-2 ${paid ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white'}`}
                    >
                        {paid && <Check size={16} color="#ffffff" strokeWidth={3} />}
                    </View>
                    <Text className="flex-1 font-sans-bold text-sm text-slate-800">
                        The student has paid {formatPeso(order.total_centavos)}.
                    </Text>
                </Pressable>
            </ReleaseStep>
            <ReleaseStep number={3} title="Hand over the items">
                <ActionButton
                    tone="green"
                    icon={busy ? <ActivityIndicator color="#ffffff" /> : <Banknote size={18} color="#ffffff" />}
                    busy={busy}
                    disabled={!paid}
                    onPress={onRelease}
                >
                    Release the items
                </ActionButton>
            </ReleaseStep>
        </View>
    );
}

function ReleaseStep({ number, title, children }: { number: number; title: string; children: ReactNode }) {
    return (
        <View className="flex-row gap-3">
            <View className="h-7 w-7 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50">
                <Text className="font-sans-bold text-xs text-emerald-700">{number}</Text>
            </View>
            <View className="flex-1 gap-1.5">
                <Text className="pt-1 font-sans-bold text-[11px] uppercase tracking-wide text-slate-500">
                    {title}
                </Text>
                {children}
            </View>
        </View>
    );
}

/** Cancel with the reason the student will see, like the website. */
export function CancelSheet({
    order,
    open,
    onClose,
    onCancel,
    busy,
    error,
}: {
    order: SpecialistOrder;
    open: boolean;
    onClose: () => void;
    onCancel: (reason: string) => void;
    busy: boolean;
    error: string | null;
}) {
    const [reason, setReason] = useState('');

    useEffect(() => {
        if (open) {
            setReason('');
        }
    }, [open]);

    return (
        <BottomSheet
            open={open}
            onClose={onClose}
            title={`Cancel ${order.number}?`}
            subtitle={`${order.student_name} · ${formatPeso(order.total_centavos)}`}
            icon={<XCircle size={20} color="#b91c1c" />}
            footer={
                <Pressable
                    onPress={() => onCancel(reason.trim())}
                    disabled={busy || reason.trim() === ''}
                    accessibilityRole="button"
                    className={`flex-row items-center justify-center gap-2 rounded-2xl bg-red-600 py-4 ${busy || reason.trim() === '' ? 'opacity-50' : ''}`}
                >
                    {busy && <ActivityIndicator color="#ffffff" />}
                    <Text className="font-sans-bold text-base text-white">Cancel order</Text>
                </Pressable>
            }
        >
            <Text className="font-sans text-sm leading-5 text-slate-700">
                Its items go back to stock and {order.student_name} is told why.
            </Text>
            <View className="gap-2">
                <Text className="font-sans-bold text-sm text-slate-700">Reason (the student will see it)</Text>
                <TextInput
                    value={reason}
                    onChangeText={setReason}
                    placeholder="e.g. The item was damaged."
                    placeholderTextColor="#94a3b8"
                    maxLength={200}
                    multiline
                    className="min-h-24 rounded-xl border border-slate-200 bg-white px-3 py-3 font-sans text-sm text-slate-900"
                    style={{ textAlignVertical: 'top' }}
                />
            </View>
            {error && <Text className="font-sans-semibold text-sm text-red-600">{error}</Text>}
        </BottomSheet>
    );
}
