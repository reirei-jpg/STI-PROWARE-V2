export type SalesPeriod = 'all' | 'today' | 'week' | 'month' | 'custom';

export type SalesTab = 'spent' | 'sold' | 'best' | 'free';

/** The numbers at the top for the period. */
export type SalesSummary = {
    /** What the uploaded eStore orders cost (closed short: only what arrived). */
    spent_centavos: number;
    /** What orders closed short ordered but never received (not counted). */
    not_arrived_centavos: number;
    /** How many orders were closed short with something not arriving. */
    short_orders: number;
    purchase_orders: number;
    /** The part of it ordered for buyers' preorders. */
    spent_for_preorders_centavos: number;
    /** What students paid (released orders). */
    price_centavos: number;
    /** What those items cost on the eStore orders (those with a Cost). */
    cost_centavos: number;
    /** What students paid for the sales that have a Cost (Profit = this − Cost). */
    costed_price_centavos: number;
    profit_centavos: number;
    orders: number;
    pieces: number;
    /** Sales whose Cost is not set yet (left out of the profit). */
    missing_cost_lines: number;
    below_cost_lines: number;
    below_cost_loss_centavos: number;
    free_pieces: number;
    /** Free uniforms at what they cost PROWARE. */
    free_cost_centavos: number;
    /** Free uniforms at their normal Price. */
    free_price_centavos: number;
};

/** One uploaded eStore order. */
export type SpentRow = {
    id: number;
    order_number: string | null;
    date_ordered: string;
    items_count: number;
    /** "STI Varsity Hoodie", or "BSIT Polo and 3 more". */
    items_label: string;
    /** What counts: all of it, or what arrived on an order closed short. */
    total_centavos: number;
    /** The amount on the eStore order. */
    ordered_centavos: number;
    /** Ordered but never received (closed short); 0 otherwise. */
    not_arrived_centavos: number;
    uploaded_by: string;
    delivery_status:
        | 'awaiting'
        | 'partially_received'
        | 'completed'
        | 'completed_short';
    delivery_status_label: string;
    /** All the quantities ordered, as on the eStore order. */
    quantity_ordered: number;
    /** All the quantities received so far. */
    quantity_received: number;
    /** How much of it was for buyers' preorders; null on POs saved before this was tracked. */
    preorder_quantity: number | null;
};

/** One size or color sold at one price (a product's View Details on Sales). */
export type SoldRow = {
    key: string;
    variant_id: number;
    product_id: number;
    product_name: string;
    variant_label: string | null;
    unit_name: string;
    pieces_per_unit: number;
    quantity: number;
    price_each_centavos: number;
    /** The normal price, when it was sold on sale or at the early-bird price. */
    normal_each_centavos: number | null;
    /** Why it was lower: 'sale' or 'early_bird' (null at the normal price). */
    lower_price_reason: 'sale' | 'early_bird' | null;
    /** "On sale" or "Early-bird price". */
    lower_price_label: string | null;
    /** Null while its Cost is not set. */
    cost_each_centavos: number | null;
    price_total_centavos: number;
    cost_total_centavos: number | null;
    profit_centavos: number | null;
    below_cost: boolean;
    loss_centavos: number;
    missing_cost_lines: number;
};

/** One free uniform given (promo). */
/** One product among the best sellers of the period. */
export type BestSellerRow = {
    rank: number;
    product_id: number;
    product_name: string;
    /** All sizes, colors and packs together, in pieces. */
    pieces: number;
    price_total_centavos: number;
    /** Null while none of its sales has a Cost. */
    profit_centavos: number | null;
    /** The size or color that sold the most (null: one size). */
    top_variant_label: string | null;
    top_variant_pieces: number;
};

/** One piece given free one by one, before there were groups. */
export type FreePiece = {
    id: number;
    given_at: string | null;
    product_name: string;
    variant_label: string | null;
    pieces: number;
    recipient_name: string | null;
    enrollment_form_number: string | null;
    cost_centavos: number | null;
    price_centavos: number;
};

/** One Free Uniforms group (or one day of pieces given one by one). */
export type FreeRow = {
    key: string;
    /** Null for pieces given one by one, before there were groups. */
    group_id: number | null;
    given_at: string;
    /** The first two students; more_names says how many others. */
    names: string[];
    more_names: number;
    students_count: number;
    /** e.g. "BSIT × 3 · BSTM × 2"; null outside a group. */
    sets: string | null;
    pieces: number;
    still_to_give: number;
    cost_centavos: number;
    /** Pieces whose Cost is not set (left out of Worth at Cost). */
    missing_cost_pieces: number;
    price_centavos: number;
    given_by: string | null;
    /** The pieces, only for a day of pieces given one by one. */
    items: FreePiece[];
};

export type SalesReportFilters = {
    tab: SalesTab;
    period: SalesPeriod;
    date_from: string;
    date_to: string;
    search: string | null;
    /** Sales showing only the products sold below cost. */
    only: 'below_cost' | null;
};

/** Sales: one product, all its sizes, colors and prices together. */
export type SoldProduct = {
    product_id: number;
    product_name: string;
    /** How many sizes or colors of it sold. */
    variants_count: number;
    pieces: number;
    /** What one piece sold for (lowest and highest). */
    price_from_centavos: number;
    price_to_centavos: number;
    /** "On sale", "Early-bird price": lower prices some of it sold at. */
    lower_price_labels: string[];
    price_total_centavos: number;
    /** Null while none of its sales has a Cost. */
    cost_total_centavos: number | null;
    profit_centavos: number | null;
    below_cost: boolean;
    loss_centavos: number;
    missing_cost_lines: number;
    /** Head Office's price now: its latest eStore order (null: never ordered). */
    item_code: string | null;
    estore_unit_price_centavos: number | null;
    estore_unit_name: string;
    estore_pieces_per_unit: number;
    estore_cost_per_piece_centavos: number | null;
    estore_order_number: string | null;
    /** Up or down from the order before; null with one order. */
    estore_change_centavos: number | null;
    estore_previous_order_number: string | null;
};

/** A product's View Details on Sales. */
export type SoldDetails = {
    product_id: number;
    product_name: string;
    /** Each size or color at each price it sold for. */
    variants: SoldRow[];
    /** Every eStore order of it; null when the product is gone. */
    estore: PriceHistory | null;
};
/** A product's eStore orders with their Unit Price, newest first. */
export type PriceHistory = {
    product_id: number;
    product_name: string;
    item_code: string | null;
    unit_name: string;
    pieces_per_unit: number;
    price_from_centavos: number | null;
    price_to_centavos: number | null;
    orders: {
        purchase_order_id: number;
        order_number: string | null;
        date_ordered: string;
        quantity_ordered: number;
        unit_price_centavos: number;
        cost_per_piece_centavos: number;
        /** Up or down from the order before; null on the first order. */
        change_centavos: number | null;
    }[];
};
