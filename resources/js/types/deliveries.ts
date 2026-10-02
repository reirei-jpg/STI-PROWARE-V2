export type DeliveryListItem = {
    id: number;
    received_on: string;
    sales_invoice_number: string | null;
    delivery_receipt_number: string | null;
    note: string | null;
    recorded_by: string;
    quantity_received: number;
    order_numbers: string[];
};

export type DeliveryFilters = {
    search: string | null;
    date_from: string | null;
    date_to: string | null;
};

/** One ordered item still waiting for delivery, on one order. */
export type WaitingItemRow = {
    purchase_order_item_id: number;
    order_number: string | null;
    date_ordered: string;
    expected_delivery_date: string | null;
    quantity_ordered: number;
    quantity_received: number;
    quantity_remaining: number;
};

/**
 * The product variant an item code's deliveries go into, and how many
 * pieces each eStore unit adds (e.g. 1 Pack = 50 pieces).
 */
export type StockTarget = {
    product_name: string;
    variant_label: string;
    has_options: boolean;
    unit_name: string;
    pieces_per_unit: number;
};

/** Every order still waiting for one item code, oldest order first. */
export type WaitingItemGroup = {
    item_code: string;
    description: string;
    /** Null while the item code is not linked to a product. */
    stock_target: StockTarget | null;
    rows: WaitingItemRow[];
};
