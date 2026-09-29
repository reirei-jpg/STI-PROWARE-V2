export type ScannedPurchaseOrderItem = {
    row_number: number;
    item_code: string | null;
    description: string;
    stock_on_hand: number | null;
    quantity_ordered: number | null;
    unit_price_centavos: number | null;
    amount_centavos: number | null;
};

export type ScanWarning = {
    row: number | null;
    message: string;
    blocking: boolean;
};

export type ScannedPurchaseOrder = {
    date_ordered: string | null;
    time_ordered: string | null;
    category: string | null;
    total_amount_centavos: number | null;
    items: ScannedPurchaseOrderItem[];
    warnings: ScanWarning[];
};

export type DuplicateUpload = {
    uploaded_at: string | null;
    uploaded_by: string;
};

export type PurchaseOrderSummary = {
    id: number;
    date_ordered: string;
    category: string | null;
    total_amount_centavos: number | null;
    items_count: number;
    uploaded_by: string;
    uploaded_at: string | null;
};

export type PurchaseOrderItemDetails = {
    row_number: number;
    item_code: string;
    description: string;
    stock_on_hand: number | null;
    quantity_ordered: number;
    unit_price_centavos: number;
    amount_centavos: number;
};

export type PurchaseOrderDetails = {
    id: number;
    date_ordered: string;
    time_ordered: string | null;
    category: string | null;
    total_amount_centavos: number | null;
    uploaded_by: string;
    uploaded_at: string | null;
    items: PurchaseOrderItemDetails[];
};

export type PurchaseOrderTotals = {
    orders_count: number;
    total_qty_ordered: number;
    total_amount_centavos: number;
};

export type Paginated<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    from: number | null;
    to: number | null;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
};
