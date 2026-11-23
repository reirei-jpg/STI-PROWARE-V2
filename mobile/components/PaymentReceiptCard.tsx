import { CheckCircle2 } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { formatDateTime, formatPeso } from '@/lib/format';
import type { PaymentReceipt } from '@/lib/types';

/**
 * A Payment Receipt on the phone, like the website's and V1's: a till slip
 * in a typewriter font with dashed lines. STI PROWARE and the school on
 * top, PAYMENT RECEIPT, the receipt number, slip, date and cashier, who
 * paid, each item with "qty x price", the total between two thick lines,
 * how it was paid, PAYMENT CONFIRMED and the note that it is not an
 * official receipt. A voided receipt is stamped VOID with the reason.
 */
export default function PaymentReceiptCard({ receipt }: { receipt: PaymentReceipt }) {
    const { row } = receipt;
    const pieces = receipt.lines.reduce((sum, line) => sum + line.quantity, 0);

    return (
        <View className="overflow-hidden bg-white px-5 py-6" style={{ elevation: 4 }}>
            <View className="items-center">
                <Mono bold size={20}>
                    STI PROWARE
                </Mono>
                <Mono bold size={10} className="mt-1 text-center">
                    {receipt.school}
                </Mono>
                {receipt.address_lines.map((line) => (
                    <Mono key={line} size={10} className="text-center">
                        {line}
                    </Mono>
                ))}
                <Mono bold size={12} className="mt-3" style={{ letterSpacing: 2 }}>
                    PAYMENT RECEIPT
                </Mono>
            </View>

            {row.void && (
                <View
                    className="mt-3 items-center self-center px-5 py-0.5"
                    style={{ transform: [{ rotate: '-8deg' }], borderWidth: 4, borderStyle: 'solid', borderColor: '#dc2626', borderRadius: 10 }}
                >
                    <Mono bold size={32} style={{ color: '#dc2626', letterSpacing: 6 }}>
                        VOID
                    </Mono>
                </View>
            )}

            <Divider />

            <Row label="RECEIPT NO." value={row.receipt_number ?? '—'} />
            <Row label={row.kind === 'order' ? 'ORDER' : 'PREORDER SLIP'} value={row.number ?? '—'} />
            <Row label="DATE PAID" value={formatDateTime(row.paid_at)} />
            <Row label="CASHIER" value={row.cashier ?? '—'} />

            <Divider />

            <Mono bold>{row.is_staff ? 'EMPLOYEE' : 'STUDENT'}</Mono>
            <Mono bold className="mt-1">
                {row.buyer_name}
            </Mono>
            <Mono>{row.buyer_id || '—'}</Mono>
            <Mono>{receipt.section || '—'}</Mono>

            <Divider />

            <View className="flex-row justify-between">
                <Mono bold>ITEM</Mono>
                <Mono bold>AMOUNT</Mono>
            </View>
            <View className="mt-3 gap-3">
                {receipt.lines.map((line, index) => {
                    const { name, option } = splitItem(line.item);

                    return (
                        <View key={`${line.item}-${index}`} className="flex-row justify-between gap-3">
                            <View className="flex-1">
                                <Mono bold>{name}</Mono>
                                {option ? <Mono size={10}>{option}</Mono> : null}
                                <Mono size={10}>
                                    {line.quantity} x {formatPeso(line.unit_price_centavos)}
                                </Mono>
                            </View>
                            <Mono bold>{formatPeso(line.amount_centavos)}</Mono>
                        </View>
                    );
                })}
            </View>

            <Divider />

            <Row label="TOTAL ITEMS" value={String(pieces)} />

            <View className="my-4 flex-row items-end justify-between py-3" style={{ borderTopWidth: 2, borderBottomWidth: 2, borderColor: '#000000' }}>
                <Mono bold size={16}>
                    TOTAL
                </Mono>
                <Mono bold size={20} style={row.void ? { textDecorationLine: 'line-through' } : undefined}>
                    {formatPeso(row.amount_centavos)}
                </Mono>
            </View>

            <Row label="METHOD" value={row.method_label} />
            {row.method === 'cash' ? (
                <>
                    <Row label="AMOUNT RECEIVED" value={formatPeso(row.amount_received_centavos)} />
                    <Row label="CHANGE" value={formatPeso(row.change_centavos)} />
                </>
            ) : (
                <Row label="REFERENCE" value={row.gcash_reference ?? '—'} />
            )}

            {row.void && (
                <View className="mt-4 px-2 py-1.5" style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: '#b91c1c' }}>
                    <Mono bold size={11} style={{ color: '#991b1b' }}>
                        VOIDED {formatDateTime(row.voided_at)}
                        {row.voided_by ? ` by ${row.voided_by}` : ''}: {row.void_reason}
                    </Mono>
                </View>
            )}

            <Divider />

            <View className="items-center">
                {!row.void && (
                    <View className="flex-row items-center gap-2">
                        <CheckCircle2 size={16} color="#000000" />
                        <Mono bold>PAYMENT CONFIRMED</Mono>
                    </View>
                )}
                <Mono size={10} className="mt-2 text-center">
                    Keep this receipt as proof of your payment.
                </Mono>
                <Mono bold className="mt-5">
                    THANK YOU!
                </Mono>
            </View>

            <Divider />

            <Mono size={9} className="text-center">
                {receipt.note}
            </Mono>
        </View>
    );
}

/** "STI Classic Tee (Black / M)" -> the name, and the size/color below it. */
function splitItem(item: string): { name: string; option: string | null } {
    const match = item.match(/^(.*) \(([^()]*)\)$/);

    return match ? { name: match[1], option: match[2] } : { name: item, option: null };
}

/** Receipt text: the typewriter font of a till slip. */
function Mono({
    children,
    bold = false,
    size = 12,
    className = '',
    style,
}: {
    children: ReactNode;
    bold?: boolean;
    size?: number;
    className?: string;
    style?: object;
}) {
    return (
        <Text
            className={`text-black ${className}`}
            style={[{ fontFamily: 'monospace', fontSize: size, lineHeight: Math.round(size * 1.5), fontWeight: bold ? '700' : '400' }, style]}
        >
            {children}
        </Text>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <View className="flex-row items-start justify-between gap-4">
            <Mono>{label}</Mono>
            <Mono bold className="flex-1 text-right">
                {value}
            </Mono>
        </View>
    );
}

/**
 * A dashed line across the slip. Android draws a one-sided dashed border as
 * a solid line, so this is a dashed box with only its top edge showing.
 */
function Divider() {
    return (
        <View className="my-4" style={{ height: 1, overflow: 'hidden' }}>
            <View style={{ height: 2, borderWidth: 1, borderStyle: 'dashed', borderColor: '#00000099', borderRadius: 1 }} />
        </View>
    );
}
