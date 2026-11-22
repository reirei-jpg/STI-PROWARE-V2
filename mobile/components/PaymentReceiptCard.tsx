import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { formatDateTime, formatPeso } from '@/lib/format';
import type { PaymentReceipt } from '@/lib/types';

/**
 * A Payment Receipt on the phone, like the website's: the school, PAYMENT
 * RECEIPT on a gold band, the receipt number and date, who paid for which
 * slip, each line paid for, the total, how it was paid (cash with the
 * amount received and the change, or GCash with its reference), and who
 * received it. A voided receipt is stamped VOID with the reason.
 */
export default function PaymentReceiptCard({ receipt }: { receipt: PaymentReceipt }) {
    const { row } = receipt;

    return (
        <View className="overflow-hidden rounded-3xl border border-slate-300 bg-white p-4">
            <View className="items-center">
                <Text className="font-sans-bold text-base text-slate-900">{receipt.school}</Text>
                {receipt.address_lines.map((line) => (
                    <Text key={line} className="font-sans text-[11px] text-slate-600">
                        {line}
                    </Text>
                ))}
                <Text className="mt-0.5 font-sans-bold text-[11px] text-slate-600">PROWARE Merchandise</Text>
            </View>

            <View className="mt-3 border-y-2 border-[#1E4E9C] bg-[#F7D44C] py-1.5">
                <Text className="text-center font-sans-bold text-sm tracking-[3px] text-slate-900">PAYMENT RECEIPT</Text>
            </View>

            {row.void && (
                <View className="mt-3 items-center rounded-xl border-4 border-red-500/60 py-1">
                    <Text className="font-sans-bold text-3xl tracking-[6px] text-red-600/80">VOID</Text>
                </View>
            )}

            <View className="mt-3 gap-1.5">
                <Field label="Receipt No.">
                    <Text className="font-sans-bold text-base text-red-700">{row.receipt_number}</Text>
                </Field>
                <Field label="Date">{formatDateTime(row.paid_at)}</Field>
                <Field label="Received from">{row.buyer_name}</Field>
                <Field label={row.is_staff ? 'Employee ID' : 'Student ID'}>{row.buyer_id ?? '—'}</Field>
                <Field label={row.is_staff ? 'Office/Department' : 'Section'}>{receipt.section ?? '—'}</Field>
                <Field label="For">{receipt.for_label}</Field>
            </View>

            <View className="mt-3 overflow-hidden rounded-xl border border-[#1E4E9C]">
                <View className="flex-row bg-[#F7D44C] px-2 py-1.5">
                    <Text className="w-10 font-sans-bold text-[11px] text-slate-900">QTY</Text>
                    <Text className="flex-1 font-sans-bold text-[11px] text-slate-900">ITEM</Text>
                    <Text className="w-24 text-right font-sans-bold text-[11px] text-slate-900">AMOUNT</Text>
                </View>
                {receipt.lines.map((line, index) => (
                    <View key={`${line.item}-${index}`} className="flex-row border-t border-[#1E4E9C]/40 px-2 py-1.5">
                        <Text className="w-10 font-sans text-sm text-slate-900">{line.quantity}</Text>
                        <View className="flex-1 pr-2">
                            <Text className="font-sans text-sm text-slate-900">{line.item}</Text>
                            <Text className="font-sans text-[11px] text-slate-500">{formatPeso(line.unit_price_centavos)} each</Text>
                        </View>
                        <Text className="w-24 text-right font-sans-bold text-sm text-slate-900">{formatPeso(line.amount_centavos)}</Text>
                    </View>
                ))}
                <View className="flex-row border-t border-[#1E4E9C] px-2 py-2">
                    <Text className="flex-1 font-sans-bold text-xs uppercase text-slate-900">Total amount paid</Text>
                    <Text className="font-sans-bold text-base text-slate-900">{formatPeso(row.amount_centavos)}</Text>
                </View>
            </View>

            <View className="mt-3 gap-1.5">
                <Field label="Payment method">{row.method_label}</Field>
                {row.method === 'cash' ? (
                    <>
                        <Field label="Amount received">{formatPeso(row.amount_received_centavos)}</Field>
                        <Field label="Change">{formatPeso(row.change_centavos)}</Field>
                    </>
                ) : (
                    <Field label="GCash reference no.">{row.gcash_reference ?? '—'}</Field>
                )}
                <Field label="Received by">{row.cashier ?? '—'}</Field>
            </View>

            {row.void && (
                <Text className="mt-3 rounded-xl bg-red-50 px-3 py-2 font-sans-semibold text-xs leading-5 text-red-800">
                    Voided on {formatDateTime(row.voided_at)}
                    {row.voided_by ? ` by ${row.voided_by}` : ''}: {row.void_reason}
                </Text>
            )}

            <Text className="mt-4 border-t border-slate-200 pt-3 text-center font-sans text-[11px] leading-4 text-slate-500">
                {receipt.note}
            </Text>
        </View>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <View className="flex-row items-start gap-2">
            <Text className="w-32 font-sans-bold text-xs text-slate-500">{label}</Text>
            {typeof children === 'string' ? (
                <Text className="flex-1 font-sans text-sm text-slate-900">{children}</Text>
            ) : (
                <View className="flex-1">{children}</View>
            )}
        </View>
    );
}
