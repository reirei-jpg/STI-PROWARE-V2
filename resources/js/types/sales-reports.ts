export type SalesPeriod = 'today' | 'week' | 'month' | 'custom';

/** The numbers for the period's cards. */
export type SalesSummary = {
    orders: number;
    pieces: number;
    sales_centavos: number;
    /** eStore cost of the lines that have one. */
    cost_centavos: number;
    /** Sales of the lines that have a cost (profit is counted on these). */
    costed_sales_centavos: number;
    profit_centavos: number;
    /** Null when nothing with a cost was sold. */
    margin_percent: number | null;
    /** Lines sold whose pieces have no eStore price yet. */
    uncosted_lines: number;
    discount_centavos: number;
    on_sale_pieces: number;
    /** Lines ordered before normal prices were kept. */
    discount_not_recorded_lines: number;
};

/** One product (size or color) in the period. */
export type ProductSales = {
    variant_id: number;
    product_id: number;
    product_name: string;
    variant_label: string | null;
    pieces: number;
    sales_centavos: number;
    cost_centavos: number;
    costed_sales_centavos: number;
    uncosted_lines: number;
    profit_centavos: number;
    discount_centavos: number;
    on_sale_pieces: number;
};

/** One release of a product, in its details popup. */
export type ProductRelease = {
    order_id: number;
    order_number: string | null;
    released_at: string | null;
    student_name: string;
    quantity: number;
    unit_name: string;
    pieces: number;
    unit_price_centavos: number;
    normal_unit_price_centavos: number | null;
    line_total_centavos: number;
    cost_centavos: number | null;
    profit_centavos: number | null;
    on_sale: boolean;
};

export type ProductSalesDetails = {
    product: ProductSales | null;
    /** The newest first, up to 100. */
    releases: ProductRelease[];
    releases_count: number;
};

/** A size or color with pieces in stock that have no eStore price. */
export type VariantNeedingPrice = {
    variant_id: number;
    product_id: number;
    product_name: string;
    variant_label: string | null;
    uncosted_pieces: number;
};

export type SalesReportFilters = {
    period: SalesPeriod;
    date_from: string;
    date_to: string;
    search: string | null;
};
