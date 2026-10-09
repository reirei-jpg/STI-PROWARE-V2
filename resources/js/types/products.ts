export type ProductStatus = 'draft' | 'preorder' | 'available' | 'on_sale';

export type ProductListItem = {
    id: number;
    name: string;
    status: ProductStatus;
    status_label: string;
    sold_by_piece: boolean;
    /** Price per piece; null when students cannot buy it by the piece. */
    price_centavos: number | null;
    /** While On Sale: one sale price for every variant, or the lowest of their own. */
    sale_price_centavos: number | null;
    /** Sizes have their own sale prices ("Sale from ₱250"). */
    sale_by_variant: boolean;
    packs_for_sale: {
        name: string;
        pieces: number;
        price_centavos: number;
        /** While the product is On Sale, if this pack is discounted. */
        sale_price_centavos: number | null;
    }[];
    /** Pieces in stock across all variants. */
    stock_on_hand: number;
    /** Pieces at which the Specialist is warned, per variant. */
    low_stock_alert_at: number;
    /** On sale to students with a variant at or below that number. */
    low_stock: boolean;
    /** When the sale ends, for an On Sale product. */
    sale_ends_at: string | null;
    /** When stock first arrived; null if it never did. */
    first_received_at: string | null;
    /** When something was last sold; null if nothing was. */
    last_sale_at: string | null;
    photo_url: string | null;
    variants_count: number;
    updated_at: string | null;
};

export type ProductFilters = {
    search: string | null;
    status: ProductStatus | null;
    stock: 'low' | 'slow' | null;
    /** Slow-moving means no sales for this many days. */
    slow_days: number;
};

/** What the Put on Sale pop-up loads. */
export type ProductSaleDetails = {
    id: number;
    name: string;
    status: ProductStatus;
    sold_by_piece: boolean;
    /** The lowest normal price per piece. */
    piece_price_centavos: number | null;
    stock_on_hand: number;
    /** What one piece costs the school; null when unknown. */
    cost_per_piece_centavos: number | null;
    packs: {
        id: number;
        name: string;
        pieces: number;
        price_centavos: number;
        sale_price_centavos: number | null;
    }[];
    /**
     * The variants by normal price per piece, lowest first. One group: they
     * all cost the same (e.g. every color) and share one sale price. Several:
     * each price (e.g. S/M ₱300, XL ₱350) gets its own sale price.
     */
    price_groups: {
        price_centavos: number;
        /** The sale price they are on now, if any. */
        sale_price_centavos: number | null;
        variants: { id: number; label: string; stock_on_hand: number }[];
    }[];
    /** The running sale, if the product is On Sale. */
    sale: { sale_price_centavos: number | null; ends_at: string | null } | null;
    max_days: number;
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
    status: ProductStatus;
    /** When the sale ends, for an On Sale product. */
    sale_ends_at: string | null;
    /** Last day students can preorder ("YYYY-MM-DD"), or empty. */
    preorders_close_on: string;
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

/** A shared code's deliveries that arrived but are not split by variant yet. */
export type ItemToSplit = {
    item_code: string;
    description: string;
    product_name: string;
    unit_name: string;
    pieces_per_unit: number;
    units_waiting: number;
    pieces_waiting: number;
    split_into: { id: number; label: string; stock_on_hand: number }[];
};

export type ItemsToLinkFilters = {
    search: string | null;
};

/** The product whose Stock History is shown. */
export type StockProduct = {
    id: number;
    name: string;
    has_options: boolean;
    /** Pieces on the shelf across all variants. */
    stock_on_hand: number;
    /** Pieces on the shelf held for students' open orders. */
    held_pieces: number;
    /** Pieces on the shelf students can still order. */
    free_to_sell: number;
    /** Pieces at which the Specialist is warned, per variant. */
    low_stock_alert_at: number;
    /** Available or On Sale: only these get low-stock warnings. */
    is_sold: boolean;
};

export type StockVariant = {
    id: number;
    label: string;
    stock_on_hand: number;
    held_pieces: number;
    free_to_sell: number;
    estore_item_code: string | null;
    /** "Pack (10 pcs)" when Head Office sends it by a pack; null by the piece. */
    sent_by: string | null;
};

/** Pieces held on the shelf for a student's open order. */
export type StockHold = {
    order_id: number;
    order_number: string | null;
    student_name: string;
    variant_label: string;
    pieces: number;
    pick_up_by: string;
};

/** One change to a variant's stock, in pieces. */
export type StockMovementRow = {
    id: number;
    created_at: string | null;
    variant_label: string;
    type: 'delivery' | 'correction' | 'sale' | 'order_cancelled';
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
    /** The student's order, for a sale or a cancelled order. */
    order: { number: string | null; student_name: string } | null;
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
