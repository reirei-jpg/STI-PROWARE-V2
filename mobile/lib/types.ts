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

/** One line of the cart, at today's price. */
export type CartLine = {
    id: number;
    product_id: number;
    product_name: string;
    photo_url: string | null;
    variant_label: string | null;
    unit_name: string;
    pieces_per_unit: number;
    quantity: number;
    most_allowed: number;
    unit_price_centavos: number | null;
    on_sale: boolean;
    line_total_centavos: number;
    /** What to fix before Place Order, or null. */
    problem: string | null;
};

export type CartView = {
    lines: CartLine[];
    total_centavos: number;
    can_place_order: boolean;
    pick_up_by: string;
};

/** A student's order, with each item at the price it was ordered at. */
export type StudentOrder = {
    id: number;
    number: string | null;
    status: 'placed' | 'ready' | 'picked_up' | 'cancelled';
    status_label: string;
    student_name: string;
    total_centavos: number;
    items: {
        id: number;
        product_name: string;
        variant_label: string | null;
        unit_name: string;
        pieces_per_unit: number;
        quantity: number;
        unit_price_centavos: number;
        line_total_centavos: number;
    }[];
    placed_at: string | null;
    pick_up_by: string;
    ready_at: string | null;
    picked_up_at: string | null;
    cancelled_at: string | null;
    cancel_reason: string | null;
    can_cancel: boolean;
};

/** A student's preorder (a reservation; nothing to pay). */
export type StudentPreorder = {
    id: number;
    product_id: number;
    product_name: string;
    photo_url: string | null;
    variant_label: string | null;
    quantity: number;
    status: 'active' | 'cancelled';
    status_label: string;
    preorders_close_on: string | null;
    can_cancel: boolean;
    created_at: string | null;
};

/** What a student's notice is about (the same notices as the website's bell). */
export type StudentNotificationData =
    | {
          kind: 'order_ready';
          order_id: number;
          order_number: string;
          total_centavos: number;
          pick_up_by: string | null;
      }
    | { kind: 'order_cancelled'; order_id: number; order_number: string; reason: string | null }
    | { kind: 'preorder_arrived'; product_id: number; product_name: string };

export type StudentNotification = {
    id: string;
    data: StudentNotificationData;
    read: boolean;
    created_at: string | null;
};

export type StorefrontHome = {
    coming_soon: StorefrontTileProduct[];
    on_sale: StorefrontTileProduct[];
};
