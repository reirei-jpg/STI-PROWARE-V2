export type DeliveryListItem = {
    id: number;
    received_on: string;
    sales_invoice_number: string | null;
    delivery_receipt_number: string | null;
    note: string | null;
    recorded_by: string;
    /** When it was recorded in PROWARE. */
    recorded_at: string | null;
    /** The purchase orders it was for, to open their details. */
    orders: { id: number; order_number: string | null }[];
    /** Pieces this delivery added to stock. */
    pieces_added_to_stock: number;
    /** Items in it that are not linked to a product, so not in stock. */
    items_not_in_stock: number;
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
 * pieces each eStore unit adds (e.g. 1 Pack = 50 pieces). When several
 * variants share the code (e.g. every color), split_into lists them and
 * each delivery is counted per variant.
 */
export type StockTarget = {
    product_name: string;
    variant_label: string;
    has_options: boolean;
    unit_name: string;
    pieces_per_unit: number;
    split_into: SplitVariant[];
};

export type SplitVariant = {
    id: number;
    label: string;
    stock_on_hand: number;
};

/** Every order still waiting for one item code, oldest order first. */
export type WaitingItemGroup = {
    item_code: string;
    description: string;
    /** Null while the item code is not linked to a product. */
    stock_target: StockTarget | null;
    rows: WaitingItemRow[];
};
