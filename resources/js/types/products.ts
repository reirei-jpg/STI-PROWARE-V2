export type ProductStatus = 'draft' | 'preorder' | 'available' | 'on_sale';

export type ProductListItem = {
    id: number;
    name: string;
    status: ProductStatus;
    status_label: string;
    sold_by_piece: boolean;
    /** Price per piece; null when students cannot buy it by the piece. */
    price_centavos: number | null;
    sale_price_centavos: number | null;
    packs_for_sale: { name: string; pieces: number; price_centavos: number }[];
    /** Pieces in stock across all variants. */
    stock_on_hand: number;
    photo_url: string | null;
    variants_count: number;
    updated_at: string | null;
};

export type ProductFilters = {
    search: string | null;
    status: ProductStatus | null;
};

export type ProductOptionInput = {
    name: string;
    choices: string[];
};

/**
 * A pack in the product form. `key` stays the same while the form is open
 * so a variant can point to a pack that is not saved yet.
 */
export type ProductPackInput = {
    key: string;
    id: number | null;
    name: string;
    pieces: string;
    sold_to_students: boolean;
    price: string;
};

export type EditableProduct = {
    id: number;
    name: string;
    sold_by_piece: boolean;
    price: string;
    sale_price: string;
    status: ProductStatus;
    photos: { id: number; url: string; label: string }[];
    packs: ProductPackInput[];
    options: ProductOptionInput[];
    variants: {
        combination: string;
        estore_item_code: string;
        /** The pack Head Office sends the item in; empty for by the piece. */
        estore_pack_key: string;
        price: string;
        stock_on_hand: number;
    }[];
};

/** The eStore item a new product is being created from (Items to Link). */
export type ProductFromItem = {
    item_code: string;
    description: string;
};

export type ItemToLink = {
    item_code: string;
    description: string;
    category: string | null;
    latest_order_number: string | null;
    latest_date_ordered: string;
    orders_count: number;
    quantity_ordered: number;
    /** Received from Head Office but not in stock, in eStore units. */
    waiting_for_stock: number;
};

export type ItemsToLinkFilters = {
    search: string | null;
};

/** A product to choose from in the Link pop-up. */
export type LinkableProduct = {
    id: number;
    name: string;
    variants: { id: number; label: string; estore_item_code: string | null }[];
    packs: { id: number; name: string; pieces: number }[];
};
