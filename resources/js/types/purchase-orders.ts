export type ScannedPurchaseOrderItem = {
    row_number: number;
    item_code: string | null;
    description: string;
    product_name: string | null;
    program: string | null;
    variant: string | null;
    stock_on_hand: number | null;
    quantity_ordered: number | null;
    unit_price_centavos: number | null;
    amount_centavos: number | null;
};

export type ScanWarning = {
    row: number | null;
    message: string;
};

export type ScannedPurchaseOrder = {
    date_ordered: string | null;
    time_ordered: string | null;
    category: string | null;
    total_amount_centavos: number | null;
    items_total_centavos: number;
    items: ScannedPurchaseOrderItem[];
    warnings: ScanWarning[];
};
