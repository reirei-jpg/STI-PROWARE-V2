/*
 * What the PROWARE server sends to the app. These match the website's types
 * (resources/js/types/storefront.ts), since both come from the same code.
 */

/** What a product costs students, as shown on its tile. */
export type StorefrontPrice = {
    /** The lowest price per piece; null when not sold by the piece. */
    piece_centavos: number | null;
    /** True when sizes or colors have different prices ("From ₱350"). */
    piece_from: boolean;
    /** The lowest sale price while On Sale. */
    sale_centavos: number | null;
    packs: {
        name: string;
        pieces: number;
        price_centavos: number;
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
    sale_ends_at: string | null;
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
        sale_price_centavos: number | null;
        buy_price_centavos: number | null;
        stock_pieces: number;
        availability: StorefrontVariantAvailability;
        pieces_left: number | null;
    }[];
    buy_packs: {
        id: number;
        name: string;
        pieces: number;
        price_centavos: number;
    }[];
};

/** A page of a long list (Laravel's paginator). */
export type Page<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
};

export type StorefrontHome = {
    coming_soon: StorefrontTileProduct[];
    on_sale: StorefrontTileProduct[];
};
