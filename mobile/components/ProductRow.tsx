import { ChevronRight } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';

import ProductTile from '@/components/ProductTile';
import type { StorefrontTileProduct } from '@/lib/types';

const GAP = 12;

/** Two tiles fill the row, the same size as All Merchandise's. */
const TILES_IN_VIEW = 2;

/**
 * Coming Soon or On Sale as one swipeable row of full tiles (photo, price,
 * Preorder or Add to Cart), like the website's rows, so many items never
 * make Home long. It stops on a tile after each swipe.
 */
export default function ProductRow({
    products,
    width,
    onOpen,
    hintClass,
    hintColor,
}: {
    products: StorefrontTileProduct[];
    width: number;
    onOpen: (product: StorefrontTileProduct) => void;
    /** The "Swipe to see all" text color, matching the section. */
    hintClass: string;
    hintColor: string;
}) {
    const tileWidth = Math.floor((width - GAP * (TILES_IN_VIEW - 1)) / TILES_IN_VIEW);

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
                    <ProductTile key={product.id} product={product} width={tileWidth} onOpen={onOpen} />
                ))}
            </ScrollView>

            {products.length > TILES_IN_VIEW && (
                <View className="flex-row items-center justify-end gap-1">
                    <Text className={`font-sans-semibold text-xs ${hintClass}`}>
                        Swipe to see all {products.length} items
                    </Text>
                    <ChevronRight size={14} color={hintColor} />
                </View>
            )}
        </View>
    );
}
