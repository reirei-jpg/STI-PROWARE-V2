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
    /** Pieces at which the Specialist is warned, per variant. */
    low_stock_alert_at: number;
    /** On sale to students with a variant at or below that number. */
    low_stock: boolean;
    photo_url: string | null;
    variants_count: number;
    updated_at: string | null;
};

export type ProductFilters = {
    search: string | null;
    status: ProductStatus | null;
    stock: 'low' | null;
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
    low_stock_alert_at: string;
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
    /** Head Office's price per eStore unit on the latest order. */
    unit_price_centavos: number;
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

/** The product whose Stock History is shown. */
export type StockProduct = {
    id: number;
    name: string;
    has_options: boolean;
    /** Pieces in stock across all variants. */
    stock_on_hand: number;
    /** Pieces at which the Specialist is warned, per variant. */
    low_stock_alert_at: number;
    /** Available or On Sale: only these get low-stock warnings. */
    is_sold: boolean;
};

export type StockVariant = {
    id: number;
    label: string;
    stock_on_hand: number;
    estore_item_code: string | null;
    /** "Pack (10 pcs)" when Head Office sends it by a pack; null by the piece. */
    sent_by: string | null;
};

/** One change to a variant's stock, in pieces. */
export type StockMovementRow = {
    id: number;
    created_at: string | null;
    variant_label: string;
    type: 'delivery' | 'correction';
    type_label: string;
    /** + added, − taken out, in pieces. */
    quantity: number;
    balance_after: number;
    units_received: number | null;
    unit_name: string | null;
    pieces_per_unit: number | null;
    reason_label: string | null;
    note: string | null;
    delivery: {
        received_on: string;
        sales_invoice_number: string | null;
        order_number: string | null;
    } | null;
    recorded_by: string | null;
};

export type StockCorrectionReasonOption = {
    value: string;
    label: string;
    /** True: enter pieces to take out. False: enter the actual count. */
    removes_pieces: boolean;
};

/** A product to choose from in the Link pop-up. */
export type LinkableProduct = {
    id: number;
    name: string;
    variants: { id: number; label: string; estore_item_code: string | null }[];
    packs: { id: number; name: string; pieces: number }[];
};
