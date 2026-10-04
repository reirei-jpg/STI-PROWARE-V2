import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ImageIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    ScrollView,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PriceLines from '@/components/PriceLines';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { StorefrontProductDetails } from '@/lib/types';

/**
 * One product. For now: its photo, name and price. The sizes and colors,
 * Add to Cart and Preorder are the next step.
 */
export default function ProductScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const { request } = useAuth();
    const [product, setProduct] = useState<StorefrontProductDetails | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        request<StorefrontProductDetails>(`/products/${id}`)
            .then(setProduct)
            .catch((caught) =>
                setError(
                    caught instanceof ApiError && caught.status === 404
                        ? 'This item is no longer in the store.'
                        : 'The item could not be loaded. Go back and try again.',
                ),
            );
    }, [id, request]);

    return (
        <ScrollView
            className="flex-1 bg-page"
            contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 32 }}
        >
            <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                className="mx-4 mb-3 flex-row items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
                <ArrowLeft size={17} color="#334155" />
                <Text className="font-sans-bold text-sm text-slate-700">Back</Text>
            </Pressable>

            {error ? (
                <Text className="mx-4 font-sans-semibold text-sm text-red-600">{error}</Text>
            ) : product === null ? (
                <ActivityIndicator color="#0D6EFD" className="mt-10" />
            ) : (
                <View>
                    <View
                        style={{ width, height: width }}
                        className="items-center justify-center bg-slate-100"
                    >
                        {product.photo_url ? (
                            <Image
                                source={{ uri: product.photo_url }}
                                style={{ width, height: width }}
                                resizeMode="cover"
                            />
                        ) : (
                            <ImageIcon size={48} color="#cbd5e1" />
                        )}
                    </View>

                    <View className="gap-3 px-4 pt-4">
                        <Text className="font-sans-bold text-2xl text-slate-900">
                            {product.name}
                        </Text>
                        <PriceLines price={product.price} large />
                        <View className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5">
                            <Text className="text-center font-sans-semibold text-sm text-slate-500">
                                Choosing a size or color, Add to Cart and
                                Preorder come in the next step.
                            </Text>
                        </View>
                    </View>
                </View>
            )}
        </ScrollView>
    );
}
