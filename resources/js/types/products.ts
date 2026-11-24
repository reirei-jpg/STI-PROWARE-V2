export type ProductStatus = 'draft' | 'preorder' | 'available' | 'on_sale';

export type ReorderStatus = 'out_of_stock' | 'reorder' | 'on_order' | 'ok';

/**
 * A size or color's Reorder Point (pieces used per day × days Head Office
 * takes to deliver + safety stock), its status and how many to order.
 */
export type ReorderView = {
    reorder_point: number;
    used_last_30_days: number;
    safety_stock: number;
    lead_days: number;
    /** Pieces still coming on eStore orders not complete yet. */
    on_order: number;
    /** Pieces to order now (in whole packs); 0 when none are needed. */
    suggested: number;
    status: ReorderStatus;
    status_label: string;
    /** How the Reorder Point was worked out, in words. */
    formula: string;
};

export type ProductListItem = {
    id: number;
    name: string;
    /** The eStore's category, e.g. PROWARE Merchandise. */
    category_label: string | null;
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
    /** The safety stock: pieces of each variant always kept (part of its Reorder Point). */
    low_stock_alert_at: number;
    /** On sale to students with a variant at or below its Reorder Point. */
    low_stock: boolean;
    /** Sold for less than one piece cost on the latest eStore order (its variant furthest below). */
    below_cost: {
        price_centavos: number;
        cost_centavos: number;
        variant_label: string | null;
        order_number: string | null;
    } | null;
    /** When the sale ends, for an On Sale product. */
    sale_ends_at: string | null;
    /** When stock first arrived; null if it never did. */
    first_received_at: string | null;
    /** When something was last sold; null if nothing was. */
    last_sale_at: string | null;
    photo_url: string | null;
    variants_count: number;
    /** How many sizes or colors have each status; Available ones with no pieces count as out_of_stock. */
    variant_statuses: Record<VariantStatus | 'out_of_stock', number>;
    /** Pieces of its Draft sizes or colors (shown in the Draft list). */
    draft_stock_on_hand: number;
    /** Slow-moving: days since its last sale (up to the end of the time), or since it arrived when never sold. */
    days_without_sale: number | null;
    /** Slow-moving: pieces sold in the time chosen. */
    sold_in_period: number | null;
    /** In the Reorder or Out of stock list: those sizes or colors (label null without options). */
    stock_sizes:
        | {
              label: string | null;
              free_to_sell: number;
              reorder: ReorderView | null;
          }[]
        | null;
    updated_at: string | null;
};

/** One product for its View Details popup on the Products list. */
export type ProductDetails = {
    id: number;
    name: string;
    category_label: string | null;
    status: ProductStatus;
    status_label: string;
    sale_ends_at: string | null;
    /** The safety stock: pieces of each variant always kept (part of its Reorder Point). */
    low_stock_alert_at: number;
    /** Days Head Office takes to deliver (Maintenance). */
    lead_days: number;
    /** The most pieces one buyer can get, all sizes together; null: no limit. */
    most_per_buyer: number | null;
    /** Only Available and On Sale products are watched for low stock. */
    watched_for_low_stock: boolean;
    updated_at: string | null;
    variants: {
        id: number;
        /** Null for a product without sizes or colors. */
        label: string | null;
        /** Its own Item Code, e.g. BP-01-S-G11-RED; null while not linked. */
        item_code: string | null;
        status: VariantStatus;
        status_label: string;
        /** Hidden from buyers (not sold yet), so never out of stock or low. */
        is_draft: boolean;
        stock_on_hand: number;
        /** Pieces kept for paid preorders (orders do not hold stock). */
        held_pieces: number;
        free_to_sell: number;
        /** Its Reorder Point and status; null when not watched (Draft, or not for sale). */
        reorder: ReorderView | null;
        price_centavos: number | null;
        sale_price_centavos: number | null;
    }[];
};

export type ProductFilters = {
    search: string | null;
    status: ProductStatus | null;
    stock: 'low' | 'out' | 'slow' | null;
    /** Slow-moving means no sales for this many days (a link from the Dashboard). */
    slow_days: number;
    /** The last week, month or year, or From – To days picked on the calendar. */
    slow?: 'week' | 'month' | 'year' | 'range' | 'days';
    /** The From and To days picked on the calendar ("YYYY-MM-DD"). */
    slow_from?: string | null;
    slow_to?: string | null;
    /** How slow: all slow (5 sold or fewer), no sales, 1–2 sold, or 3–5 sold. */
    sold?: 'all' | 'none' | 'few' | 'some';
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

/** What one variant can be set to on the product form. */
export type VariantStatus = 'draft' | 'preorder' | 'available';

export type EditableProduct = {
    id: number;
    name: string;
    /** The product's own Item Code, e.g. BP-01; empty for one saved before codes. */
    /** The eStore's category, e.g. proware_merchandise; empty when not chosen yet. */
    category: string;
    item_code: string;
    sold_by_piece: boolean;
    price: string;
    status: ProductStatus;
    /** When the sale ends, for an On Sale product. */
    sale_ends_at: string | null;
    /** Last day students can preorder ("YYYY-MM-DD"), or empty. */
    preorders_close_on: string;
    /** First and last day it is expected to arrive ("YYYY-MM-DD"), or empty. */
    expected_arrival_from: string;
    expected_arrival_to: string;
    /** Early-bird price per piece in pesos and how many pieces get it, or empty. */
    early_bird_price: string;
    early_bird_pieces: string;
    low_stock_alert_at: string;
    /** The most pieces one buyer can get, or empty for no limit. */
    most_per_buyer: string;
    photos: { id: number; url: string; label: string }[];
    packs: ProductPackInput[];
    options: ProductOptionInput[];
    variants: {
        combination: string;
        /** Draft: hidden from buyers while the other variants are in the store. */
        status: VariantStatus;
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
    /** The eStore order's category, chosen for her; null when unknown. */
    category: string | null;
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
    /** Pieces on the shelf across all variants. */
    stock_on_hand: number;
    /** Pieces on the shelf held for students' open orders. */
    held_pieces: number;
    /** Pieces on the shelf students can still order. */
    free_to_sell: number;
    /** The safety stock: pieces of each variant always kept (part of its Reorder Point). */
    low_stock_alert_at: number;
    /** Days Head Office takes to deliver (Maintenance). */
    lead_days: number;
    /** Available or On Sale: only these get reorder warnings. */
    is_sold: boolean;
};

export type StockVariant = {
    id: number;
    label: string;
    /** Hidden from buyers (not sold yet), so never low or out of stock. */
    is_draft: boolean;
    stock_on_hand: number;
    held_pieces: number;
    free_to_sell: number;
    estore_item_code: string | null;
    /** "Pack (10 pcs)" when Head Office sends it by a pack; null by the piece. */
    sent_by: string | null;
    /** Its Reorder Point and status; null when not watched (Draft, or not for sale). */
    reorder: ReorderView | null;
};

/** Pieces held on the shelf for an order of an arrived preorder (other orders hold nothing). */
export type StockHold = {
    order_id: number;
    order_number: string | null;
    student_name: string;
    variant_label: string;
    pieces: number;
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
    /** "Preorder", "Available", "On Sale" or "Draft". */
    status_label: string;
    variants: { id: number; label: string; estore_item_code: string | null }[];
    packs: { id: number; name: string; pieces: number }[];
};
