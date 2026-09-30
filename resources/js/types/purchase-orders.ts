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
    order_number: string | null;
    school: string | null;
    ordered_by: string | null;
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
    order_number: string | null;
    ordered_by: string | null;
    date_ordered: string;
    category: string | null;
    total_amount_centavos: number | null;
    items_count: number;
    uploaded_by: string;
    uploaded_at: string | null;
} & DeliveryProgress;

export type PurchaseOrderItemDetails = {
    row_number: number;
    item_code: string;
    description: string;
    stock_on_hand: number | null;
    quantity_ordered: number;
    quantity_received: number;
    quantity_remaining: number;
    unit_price_centavos: number;
    amount_centavos: number;
};

export type PurchaseOrderDetails = {
    id: number;
    order_number: string | null;
    school: string | null;
    ordered_by: string | null;
    date_ordered: string;
    time_ordered: string | null;
    category: string | null;
    total_amount_centavos: number | null;
    uploaded_by: string;
    uploaded_at: string | null;
    items: PurchaseOrderItemDetails[];
    closed_reason: string | null;
    closed_at: string | null;
    closed_by: string | null;
    deliveries: OrderDeliveryRecord[];
} & DeliveryProgress;

export type PurchaseOrderFilters = {
    search: string | null;
    category: string | null;
    status: DeliveryStatus | null;
    sort: PurchaseOrderSort;
    date_from: string | null;
    date_to: string | null;
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

export type DeliveryStatus =
    | 'awaiting'
    | 'partially_received'
    | 'completed'
    | 'completed_short';

export type PurchaseOrderSort = 'expected' | 'newest' | 'oldest_waiting';

/** Delivery progress shared by the list rows and the details window. */
export type DeliveryProgress = {
    delivery_status: DeliveryStatus;
    delivery_status_label: string;
    quantity_ordered_total: number;
    quantity_received_total: number;
    percent_received: number;
    expected_delivery_date: string | null;
    expected_delivery_note: string | null;
};

export type OrderDeliveryRecord = {
    id: number;
    received_on: string;
    sales_invoice_number: string | null;
    delivery_receipt_number: string | null;
    recorded_by: string;
    items: {
        item_code: string;
        description: string;
        quantity_received: number;
    }[];
};
