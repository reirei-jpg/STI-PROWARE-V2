import { Banknote, Check, PackageCheck, XCircle } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import BottomSheet from '@/components/BottomSheet';
import CancelReasonList from '@/components/CancelReasonList';
import { STAFF_CANCEL_REASONS, cancelReasonReady } from '@/lib/cancel-reasons';
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
 * Release, like the website's order popup: one green box where the
 * Specialist ticks "The student has paid" and only then releases the items
 * (they leave the shelf only now). The tick clears after each release.
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
        <View className="gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
            <Text className="font-sans-bold text-xs uppercase tracking-wide text-emerald-800">Release</Text>
            <Pressable
                onPress={() => setPaid(!paid)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: paid }}
                className={`flex-row items-center gap-3 rounded-xl border px-4 py-3 ${paid ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}
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
            <ActionButton
                tone="green"
                icon={busy ? <ActivityIndicator color="#ffffff" /> : <Banknote size={18} color="#ffffff" />}
                busy={busy}
                disabled={!paid}
                onPress={onRelease}
            >
                Release the items
            </ActionButton>
            {!paid && (
                <Text className="font-sans-semibold text-xs text-emerald-900/70">
                    Tick the box above once the student has paid.
                </Text>
            )}
        </View>
    );
}

/**
 * "Mark Order PW-0042 as ready for pickup?": the student is notified at once
 * and it cannot be taken back, so a mis-tap asks first, like the website.
 */
export function ReadySheet({
    order,
    open,
    onClose,
    onConfirm,
    busy,
}: {
    order: SpecialistOrder;
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    busy: boolean;
}) {
    return (
        <BottomSheet
            open={open}
            onClose={onClose}
            title={`Mark ${order.number} as ready for pickup?`}
            subtitle={`${order.student_name} · ${formatPeso(order.total_centavos)}`}
            icon={<PackageCheck size={20} color="#1d4ed8" />}
            footer={
                <View className="flex-row gap-3">
                    <Pressable
                        onPress={onClose}
                        accessibilityRole="button"
                        className="flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white py-4"
                    >
                        <Text className="font-sans-bold text-base text-slate-700">Not yet</Text>
                    </Pressable>
                    <Pressable
                        onPress={onConfirm}
                        disabled={busy}
                        accessibilityRole="button"
                        className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 ${busy ? 'opacity-50' : ''}`}
                    >
                        {busy && <ActivityIndicator color="#ffffff" />}
                        <Text className="font-sans-bold text-base text-white">Mark as ready</Text>
                    </Pressable>
                </View>
            }
        >
            <Text className="font-sans text-sm leading-5 text-slate-700">
                {order.student_name} will be notified to collect and pay for the order. This cannot be undone.
            </Text>
        </BottomSheet>
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
    onCancel: (reason: string, note: string) => void;
    busy: boolean;
    error: string | null;
}) {
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const ready = cancelReasonReady(reason, note);

    useEffect(() => {
        if (open) {
            setReason('');
            setNote('');
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
                    onPress={() => onCancel(reason, note.trim())}
                    disabled={busy || !ready}
                    accessibilityRole="button"
                    className={`flex-row items-center justify-center gap-2 rounded-2xl bg-red-600 py-4 ${busy || !ready ? 'opacity-50' : ''}`}
                >
                    {busy && <ActivityIndicator color="#ffffff" />}
                    <Text className="font-sans-bold text-base text-white">Cancel order</Text>
                </Pressable>
            }
        >
            <Text className="font-sans text-sm leading-5 text-slate-700">
                Its items go back to stock and {order.student_name} is notified with the reason.
            </Text>
            <Text className="font-sans-bold text-sm text-slate-700">Why is it cancelled? (the student will see it)</Text>
            <CancelReasonList
                reasons={STAFF_CANCEL_REASONS}
                reason={reason}
                note={note}
                onReason={setReason}
                onNote={setNote}
                notePlaceholder="e.g. The student changed course and needs another uniform."
            />
            {error && <Text className="font-sans-semibold text-sm text-red-600">{error}</Text>}
        </BottomSheet>
    );
}
