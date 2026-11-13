export type SalesPeriod = 'all' | 'today' | 'week' | 'month' | 'custom';

export type SalesTab = 'spent' | 'sold' | 'best' | 'free';

/** The numbers at the top for the period. */
export type SalesSummary = {
    /** What the uploaded eStore orders cost. */
    spent_centavos: number;
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
    total_centavos: number;
    uploaded_by: string;
    /** All the quantities ordered, as on the eStore order. */
    quantity_ordered: number;
    /** How much of it was for buyers' preorders; null on POs saved before this was tracked. */
    preorder_quantity: number | null;
};

/** One item sold at one price. */
export type SoldRow = {
    key: string;
    variant_id: number;
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
};
