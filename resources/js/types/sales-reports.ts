export type SalesPeriod = 'today' | 'week' | 'month' | 'custom';

export type SalesTab = 'spent' | 'sold' | 'free';

/** The numbers at the top for the period. */
export type SalesSummary = {
    /** What the uploaded eStore orders cost. */
    spent_centavos: number;
    purchase_orders: number;
    /** What students paid (released orders). */
    price_centavos: number;
    /** What those items cost on the eStore orders (those with a Cost). */
    cost_centavos: number;
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
    /** The normal price, when it was sold on sale. */
    normal_each_centavos: number | null;
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
export type FreeRow = {
    id: number;
    given_at: string | null;
    product_name: string;
    variant_label: string | null;
    pieces: number;
    recipient_name: string | null;
    enrollment_form_number: string | null;
    cost_centavos: number | null;
    price_centavos: number;
    recorded_by: string | null;
};

export type SalesReportFilters = {
    tab: SalesTab;
    period: SalesPeriod;
    date_from: string;
    date_to: string;
    search: string | null;
};
