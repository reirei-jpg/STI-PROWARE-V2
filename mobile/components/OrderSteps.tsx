import type { ReactNode } from 'react';
import { Text, View } from 'react-native';


/**
 * What happens after Place Order, as three numbered steps (cart and the
 * "Order placed" screen): place it, pay at the cashier, then show the
 * receipt and the issuance slip at the PROWARE office. Nothing is set aside
 * for an order: whoever pays first gets the items.
 */
export default function OrderSteps({ placed = false }: { placed?: boolean }) {
    return (
        <View className="gap-3">
            <Step number={1} done={placed}>
                {placed ? 'Order placed' : 'Place your order'}
            </Step>
            <Step number={2}>Pay at the cashier and keep the official receipt</Step>
            <Step number={3}>Show the receipt and your issuance slip at the PROWARE office to get your items</Step>
            <Text className="ml-10 font-sans text-xs text-slate-500">
                First to pay, first served.
            </Text>
        </View>
    );
}
function Step({ number, done = false, children }: { number: number; done?: boolean; children: ReactNode }) {
    return (
        <View className="flex-row items-center gap-3">
            <View
                className={`h-7 w-7 items-center justify-center rounded-full border ${done ? 'border-emerald-600 bg-emerald-600' : 'border-blue-200 bg-blue-50'}`}
            >
                <Text className={`font-sans-bold text-xs ${done ? 'text-white' : 'text-blue-700'}`}>
                    {done ? '✓' : number}
                </Text>
            </View>
            <Text className="flex-1 font-sans-medium text-sm leading-5 text-slate-700">{children}</Text>
        </View>
    );
}
