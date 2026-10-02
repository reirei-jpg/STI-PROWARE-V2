/** What a product costs students, as shown on its tile. */
export type StorefrontPrice = {
    /** The lowest price per piece; null when not sold by the piece. */
    piece_centavos: number | null;
    /** True when sizes or colors have different prices ("From ₱350"). */
    piece_from: boolean;
    /** The sale price when On Sale. */
    sale_centavos: number | null;
    packs: {
        name: string;
        pieces: number;
        price_centavos: number;
        /** The pack's sale price while the product is On Sale. */
        sale_price_centavos: number | null;
    }[];
};

export type StorefrontTileProduct = {
    id: number;
    name: string;
    status: 'preorder' | 'available' | 'on_sale';
    photo_url: string | null;
    price: StorefrontPrice;
    sold_out: boolean;
    almost_sold_out: boolean;
    /** Only given when few are left ("Only 3 left"). */
    pieces_left: number | null;
    /** When the sale ends, for an On Sale product. */
    sale_ends_at: string | null;
    /** The last day students can preorder, for a Preorder product. */
    preorders_close_on: string | null;
    accepts_preorders: boolean;
};

export type StorefrontVariantAvailability =
    | 'coming_soon'
    | 'in_stock'
    | 'almost_sold_out'
    | 'sold_out';

export type StorefrontProductDetails = StorefrontTileProduct & {
    photos: { url: string; label: string | null }[];
    options: { name: string; choices: string[] }[];
    variants: {
        id: number;
        label: string;
        price_centavos: number | null;
        availability: StorefrontVariantAvailability;
        pieces_left: number | null;
    }[];
};

export type StorefrontFilters = {
    search: string | null;
    show: 'in_stock' | 'sold_out' | null;
};
