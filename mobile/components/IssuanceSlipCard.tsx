import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { formatDate, formatPeso } from '@/lib/format';
import type { IssuanceSlipData } from '@/lib/types';

/** The paper form's colors: gold bands and blue rules. */
const GOLD = '#F7D44C';
const BLUE = '#1E4E9C';

/**
 * An order's issuance slip on the phone, like the website's and STI
 * College-Ormoc's paper form: the school's name and address, ISSUANCE SLIP
 * on a gold band, the QR the Specialist scans (large, so it scans from the
 * screen), No. (the order number), Date, Student Name, Section, the items
 * with QTY / ITEM / AMOUNT, and the Total Amount. A cancelled slip is
 * stamped CANCELLED and a released one RELEASED, so it cannot be used
 * twice. The Specialist's copy leaves the QR out (they just scanned it).
 */
export default function IssuanceSlipCard({
    slip,
    showQr = true,
}: {
    slip: IssuanceSlipData;
    showQr?: boolean;
}) {
    return (
        <View className="overflow-hidden rounded-2xl border border-slate-300 bg-white px-4 py-5">
            <Text className="text-center font-sans-bold text-base tracking-wide text-slate-900">
                {slip.school}
            </Text>
            {slip.address_lines.map((line) => (
                <Text key={line} className="text-center font-sans text-[11px] text-slate-600">
                    {line}
                </Text>
            ))}

            <View
                style={{ backgroundColor: GOLD, borderColor: BLUE }}
                className="mt-3 border-y-2 py-1.5"
            >
                <Text className="text-center font-sans-bold text-sm tracking-[4px] text-slate-900">
                    ISSUANCE SLIP
                </Text>
            </View>

            {showQr && slip.qr_svg && (
                <View className="mt-4 items-center">
                    <View className="rounded-xl border border-slate-200 bg-white p-2">
                        <SvgXml xml={slip.qr_svg} width={220} height={220} />
                    </View>
                    <Text className="mt-1.5 font-sans-semibold text-xs text-slate-500">
                        Scan at the PROWARE office
                    </Text>
                </View>
            )}

            <View className="mt-4 gap-2.5">
                <SlipField label="No.">
                    <Text className="font-sans-bold text-base text-red-700">{slip.number}</Text>
                </SlipField>
                <SlipField label="Date">{formatDate(slip.date)}</SlipField>
                <SlipField label="Student Name">{slip.student_name}</SlipField>
                <SlipField label="Section">{slip.section ?? ''}</SlipField>
            </View>

            <View style={{ borderColor: BLUE }} className="mt-4 border">
                <View style={{ backgroundColor: GOLD, borderColor: BLUE }} className="flex-row border-b">
                    <HeadingCell className="w-12">QTY</HeadingCell>
                    <HeadingCell className="flex-1" divider>
                        ITEM
                    </HeadingCell>
                    <HeadingCell className="w-24" divider>
                        AMOUNT
                    </HeadingCell>
                </View>
                {slip.items.map((line, index) => (
                    <View
                        key={index}
                        style={{ borderColor: BLUE }}
                        className={`flex-row ${index === 0 ? '' : 'border-t'}`}
                    >
                        <View className="w-12 justify-center py-2">
                            <Text className="text-center font-sans-bold text-sm text-slate-900">
                                {line.quantity}
                            </Text>
                        </View>
                        <View style={{ borderColor: BLUE }} className="flex-1 border-l px-2 py-2">
                            <Text className="font-sans text-sm text-slate-900">{line.item}</Text>
                            <Text className="font-sans text-[11px] text-slate-500">
                                {formatPeso(line.unit_price_centavos)} each
                            </Text>
                        </View>
                        <View style={{ borderColor: BLUE }} className="w-24 justify-center border-l px-2 py-2">
                            <Text className="text-right font-sans-bold text-sm text-slate-900">
                                {formatPeso(line.amount_centavos)}
                            </Text>
                        </View>
                    </View>
                ))}
            </View>

            <View style={{ borderColor: BLUE }} className="mt-4 self-end border-2 px-4 py-2">
                <Text className="text-right font-sans-bold text-[11px] text-slate-700">
                    Total Amount
                </Text>
                <Text className="text-right font-sans-bold text-xl text-slate-900">
                    {formatPeso(slip.total_centavos)}
                </Text>
            </View>

            {slip.released_on && (
                <Text className="mt-4 font-sans text-xs text-slate-600">
                    Received {formatDate(slip.released_on)}
                    {slip.issued_by ? ` · issued by ${slip.issued_by}` : ''}
                </Text>
            )}

            <SlipStamp status={slip.status} />
        </View>
    );
}

function SlipField({ label, children }: { label: string; children: ReactNode }) {
    return (
        <View className="flex-row items-end gap-2">
            <Text className="font-sans-bold text-sm text-slate-900">{label}:</Text>
            <View className="min-h-6 flex-1 justify-end border-b border-slate-400 pb-0.5">
                {typeof children === 'string' ? (
                    <Text className="font-sans text-sm text-slate-900">{children}</Text>
                ) : (
                    children
                )}
            </View>
        </View>
    );
}

function HeadingCell({
    className,
    divider = false,
    children,
}: {
    className: string;
    divider?: boolean;
    children: string;
}) {
    return (
        <View style={{ borderColor: BLUE }} className={`py-1 ${divider ? 'border-l' : ''} ${className}`}>
            <Text className="text-center font-sans-bold text-[11px] text-slate-900">{children}</Text>
        </View>
    );
}

/**
 * CANCELLED in red or RELEASED in green across the slip, so a used or
 * cancelled slip is not taken for an open one.
 */
function SlipStamp({ status }: { status: IssuanceSlipData['status'] }) {
    if (status !== 'cancelled' && status !== 'picked_up') {
        return null;
    }

    const cancelled = status === 'cancelled';

    return (
        <View
            pointerEvents="none"
            className="absolute inset-0 items-center justify-center"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
        >
            <View
                style={{ transform: [{ rotate: '-12deg' }], opacity: 0.3 }}
                className={`rounded-xl border-4 px-5 py-1.5 ${cancelled ? 'border-red-600' : 'border-emerald-600'}`}
            >
                <Text
                    className={`font-sans-bold text-4xl tracking-[4px] ${cancelled ? 'text-red-600' : 'text-emerald-600'}`}
                >
                    {cancelled ? 'CANCELLED' : 'RELEASED'}
                </Text>
            </View>
        </View>
    );
}
