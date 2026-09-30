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

/** Every order still waiting for one item code, oldest order first. */
export type WaitingItemGroup = {
    item_code: string;
    description: string;
    rows: WaitingItemRow[];
};
