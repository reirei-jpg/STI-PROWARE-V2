import { ChevronRight } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';

import ProductTile from '@/components/ProductTile';
import type { StorefrontTileProduct } from '@/lib/types';

const GAP = 8;

/** Three compact tiles fill the red box. */
const TILES_IN_VIEW = 3;

/**
 * On Sale as one swipeable row, like the website's carousel, so many sale
 * items never make Home long. It stops on a tile after each swipe.
 */
export default function OnSaleCarousel({
    products,
    width,
    onOpen,
}: {
    products: StorefrontTileProduct[];
    width: number;
    onOpen: (product: StorefrontTileProduct) => void;
}) {
    const tileWidth = Math.floor((width - GAP * (TILES_IN_VIEW - 1)) / TILES_IN_VIEW);
    const canSwipe = products.length > TILES_IN_VIEW;

    return (
        <View className="gap-2">
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={tileWidth + GAP}
                decelerationRate="fast"
                contentContainerStyle={{ gap: GAP }}
            >
                {products.map((product) => (
                    <ProductTile
                        key={product.id}
                        product={product}
                        width={tileWidth}
                        onOpen={onOpen}
                        compact
                    />
                ))}
            </ScrollView>

            {canSwipe && (
                <View className="flex-row items-center justify-end gap-1">
                    <Text className="font-sans-semibold text-xs text-red-700">
                        Swipe to see all {products.length} items
                    </Text>
                    <ChevronRight size={14} color="#b91c1c" />
                </View>
            )}
        </View>
    );
}
