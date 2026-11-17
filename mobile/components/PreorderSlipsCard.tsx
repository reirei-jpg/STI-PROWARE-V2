import { router } from 'expo-router';
import { Banknote } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import BottomSheet from '@/components/BottomSheet';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatPeso } from '@/lib/format';

type Tab = 'to_verify' | 'paid' | 'all';

type Counts = { to_verify: number; paid: number; all: number };

type SlipRow = {
    slip_id: number;
    number: string | null;
    buyer_name: string;
    buyer_id_number: string | null;
    is_staff: boolean;
    product_name: string;
    items: string;
    pieces: number;
    amount_centavos: number;
    paid: boolean;
    paid_on: string | null;
    pay_from: string | null;
    pay_until: string | null;
};

/** One buyer with their slips: a buyer has one slip per press of Preorder. */
type BuyerRow = {
    buyer_id: number;
    buyer_name: string;
    buyer_id_number: string | null;
    is_staff: boolean;
    unpaid_slips: number;
    unpaid_centavos: number;
    slips: SlipRow[];
};

type SlipPage = { data: BuyerRow[]; current_page: number; last_page: number; total: number; counts: Counts };

const TABS: { key: Tab; label: string }[] = [
    { key: 'to_verify', label: 'To verify' },
    { key: 'paid', label: 'Paid' },
    { key: 'all', label: 'All' },
];

/**
 * The website's Preorders card on the Specialist's phone To-do: a shortcut
 * to the preorder slips still waiting for their items, unpaid first. Check
 * payment opens the slip check, where the cashier's receipt is checked and
 * the slip is marked paid, as when it is scanned.
 */
export default function PreorderSlipsCard({ counts: initialCounts }: { counts: Counts }) {
    const { request } = useAuth();
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<Tab>('to_verify');
    const [search, setSearch] = useState('');
    const [rows, setRows] = useState<BuyerRow[]>([]);
    const [page, setPage] = useState<SlipPage | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const latest = useRef(0);
    const counts = page?.counts ?? initialCounts;

    const load = async (pageNumber: number): Promise<void> => {
        const requestNumber = ++latest.current;
        setLoading(true);
        setError(null);

        try {
            const query = new URLSearchParams({ tab, search: search.trim(), page: String(pageNumber) });
            const result = await request<SlipPage>(`/specialist/preorder-slips?${query.toString()}`);

            if (requestNumber === latest.current) {
                setPage(result);
                setRows((current) => (pageNumber === 1 ? result.data : [...current, ...result.data]));
            }
        } catch (caught) {
            if (requestNumber === latest.current) {
                setError(caught instanceof ApiError ? caught.message : 'The slips could not be loaded. Check the connection, then try again.');
            }
        } finally {
            if (requestNumber === latest.current) {
                setLoading(false);
            }
        }
    };

    // Reload from the first page when the sheet opens, the tab changes or the Specialist types.
    useEffect(() => {
        if (!open) {
            return;
        }

        const timer = setTimeout(() => void load(1), search === '' ? 0 : 300);

        return () => clearTimeout(timer);
        // `load` reads the current tab and search.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, tab, search]);

    const check = (row: SlipRow): void => {
        setOpen(false);
        router.push({ pathname: '/slip-check', params: { code: row.number ?? '' } });
    };

    return (
        <>
            <Pressable
                onPress={() => setOpen(true)}
                accessibilityRole="button"
                className="w-full flex-row items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4"
            >
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
                    <Banknote size={19} color="#b45309" />
                </View>
                <View className="flex-1">
                    <Text className="font-sans-bold text-[11px] uppercase tracking-wide text-slate-500">Preorders</Text>
                    <Text className="font-sans-bold text-base text-slate-900">{initialCounts.to_verify}</Text>
                    <Text className="font-sans text-xs text-slate-500">
                        unpaid to verify · {initialCounts.all} {initialCounts.all === 1 ? 'slip' : 'slips'} in all
                    </Text>
                </View>
            </Pressable>

            <BottomSheet
                open={open}
                onClose={() => setOpen(false)}
                title="Preorders"
                subtitle="Preorders waiting for their items, by buyer, unpaid first. Check payment opens the slip: check the cashier's receipt, then mark it paid."
                icon={<Banknote size={20} color="#b45309" />}
                footer={
                    <Pressable
                        onPress={() => setOpen(false)}
                        accessibilityRole="button"
                        className="items-center justify-center rounded-2xl border border-slate-200 bg-white py-3.5"
                    >
                        <Text className="font-sans-bold text-base text-slate-700">Close</Text>
                    </Pressable>
                }
            >
                <View className="gap-3">
                    <View className="flex-row gap-2">
                        {TABS.map((item) => (
                            <Pressable
                                key={item.key}
                                onPress={() => setTab(item.key)}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: tab === item.key }}
                                className={`flex-1 items-center rounded-xl border py-2 ${tab === item.key ? 'border-brand bg-brand' : 'border-slate-200 bg-white'}`}
                            >
                                <Text className={`font-sans-bold text-xs ${tab === item.key ? 'text-white' : 'text-slate-600'}`}>
                                    {item.label} ({counts[item.key]})
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        maxLength={120}
                        placeholder="Search slip number or buyer name"
                        placeholderTextColor="#94a3b8"
                        autoCapitalize="none"
                        className="rounded-xl border border-slate-200 bg-white px-3 py-3 font-sans-medium text-sm text-slate-900"
                    />

                    {error ? (
                        <View className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                            <Text className="font-sans-semibold text-sm text-red-700">{error}</Text>
                        </View>
                    ) : page === null ? (
                        <ActivityIndicator color="#0D6EFD" />
                    ) : rows.length === 0 ? (
                        <Text className="font-sans text-sm text-slate-500">
                            {search.trim() !== ''
                                ? `No slip or buyer in ${TABS.find((item) => item.key === tab)?.label} matches "${search.trim()}".`
                                : tab === 'to_verify'
                                  ? 'Every preorder slip waiting for its items is paid.'
                                  : tab === 'paid'
                                    ? 'No paid preorder slip is waiting for its items.'
                                    : 'No preorder slip is waiting for its items.'}
                        </Text>
                    ) : (
                        <View className={`gap-2.5 ${loading ? 'opacity-60' : ''}`}>
                            {rows.map((buyer) => (
                                <View key={buyer.buyer_id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                    <View className="gap-1 bg-slate-50 px-4 py-3">
                                        <View className="flex-row flex-wrap items-center gap-1.5">
                                            <Text className="font-sans-bold text-sm text-slate-900">{buyer.buyer_name}</Text>
                                            {buyer.is_staff && (
                                                <View className="rounded-full bg-slate-100 px-2 py-0.5">
                                                    <Text className="font-sans-bold text-[10px] uppercase text-slate-700">Staff</Text>
                                                </View>
                                            )}
                                            {buyer.buyer_id_number && (
                                                <Text className="font-sans text-xs text-slate-500">{buyer.buyer_id_number}</Text>
                                            )}
                                        </View>
                                        <Text className={`font-sans-bold text-xs ${buyer.unpaid_slips > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                            {buyer.unpaid_slips > 0 ? `Not paid: ${formatPeso(buyer.unpaid_centavos)}` : 'All paid'}
                                        </Text>
                                    </View>
                                    {buyer.slips.map((row) => (
                                        <View key={row.slip_id} className="gap-2 border-t border-slate-100 px-4 py-3">
                                            <View>
                                                <Text className="font-sans-bold text-sm text-slate-800">
                                                    {row.product_name}: {row.items}
                                                </Text>
                                                <Text className="font-sans text-xs text-slate-500">
                                                    {row.number} · <Text className="font-sans-bold text-slate-900">{formatPeso(row.amount_centavos)}</Text> ·{' '}
                                                    <Text className={`font-sans-bold ${row.paid ? 'text-emerald-700' : 'text-amber-700'}`}>
                                                        {row.paid
                                                            ? `Paid ${formatDate(row.paid_on)}`
                                                            : row.pay_until === null
                                                              ? 'Not paid yet'
                                                              : `Not paid yet · pay ${formatDate(row.pay_from)} to ${formatDate(row.pay_until)}`}
                                                    </Text>
                                                </Text>
                                            </View>
                                            <Pressable
                                                onPress={() => check(row)}
                                                accessibilityRole="button"
                                                className={`flex-row items-center justify-center gap-1.5 rounded-lg px-3 py-2 ${row.paid ? 'border border-slate-300 bg-white' : 'bg-brand'}`}
                                            >
                                                <Banknote size={15} color={row.paid ? '#1d4ed8' : '#ffffff'} />
                                                <Text className={`font-sans-bold text-sm ${row.paid ? 'text-blue-700' : 'text-white'}`}>
                                                    {row.paid ? 'View slip' : 'Check payment'}
                                                </Text>
                                            </Pressable>
                                        </View>
                                    ))}
                                </View>
                            ))}
                            {page.current_page < page.last_page && (
                                <Pressable
                                    onPress={() => void load(page.current_page + 1)}
                                    disabled={loading}
                                    accessibilityRole="button"
                                    className="flex-row items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3"
                                >
                                    {loading && <ActivityIndicator size="small" color="#0D6EFD" />}
                                    <Text className="font-sans-bold text-sm text-blue-700">
                                        Show more buyers ({rows.length} of {page.total})
                                    </Text>
                                </Pressable>
                            )}
                        </View>
                    )}
                </View>
            </BottomSheet>
        </>
    );
}
