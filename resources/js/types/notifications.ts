export type PurchaseOrderUploadedData = {
    kind?: 'purchase_order_uploaded';
    purchase_order_id: number;
    order_number: string | null;
    uploaded_by: string;
    date_ordered: string;
    total_amount_centavos: number | null;
    items_count: number;
};

export type DeliveryReminderData = {
    kind: 'delivery_reminder';
    purchase_order_id: number;
    order_number: string | null;
    expected_delivery_date: string | null;
    when: 'tomorrow' | 'today';
    percent_received: number;
    quantity_remaining: number;
};

export type LowStockData = {
    kind: 'low_stock';
    product_id: number;
    /** "TM Polo (S/M)", or the product name without options. */
    product_name: string;
    stock_on_hand: number;
    alert_at: number;
};

export type SaleEndingData = {
    kind: 'sale_ending';
    product_id: number;
    product_name: string;
    ends_at: string | null;
};

export type SaleEndedData = {
    kind: 'sale_ended';
    product_id: number;
    product_name: string;
    /** "₱80.00 / pc" */
    normal_price: string;
};

export type OrderPlacedData = {
    kind: 'order_placed';
    order_id: number;
    /** "PW-0042" */
    order_number: string | null;
    student_name: string;
    total_centavos: number;
    items_count: number;
};

export type OrderReadyData = {
    kind: 'order_ready';
    order_id: number;
    order_number: string | null;
    total_centavos: number;
    /** The last day to pick it up, "2026-10-06". */
    pick_up_by: string | null;
};

/** Today is the last day to get the order before it expires. */
export type OrderLastDayData = {
    kind: 'order_last_day';
    order_id: number;
    order_number: string | null;
    total_centavos: number;
    pick_up_by: string;
};

export type OrderCancelledData = {
    kind: 'order_cancelled';
    order_id: number;
    order_number: string | null;
    reason: string | null;
};

export type PreorderArrivedData = {
    kind: 'preorder_arrived';
    product_id: number;
    product_name: string;
};

export type DeliveryRecordedData = {
    kind: 'delivery_recorded';
    delivery_id: number;
    purchase_order_id: number | null;
    order_numbers: string[];
    received_on: string;
    sales_invoice_number: string | null;
    delivery_receipt_number: string | null;
    recorded_by: string;
    items_count: number;
    /** Received, as counted on the eStore. */
    quantity_received: number;
};

export type PurchaseOrderClosedShortData = {
    kind: 'purchase_order_closed_short';
    purchase_order_id: number;
    order_number: string | null;
    reason: string | null;
    closed_by: string | null;
    percent_received: number;
};

/** A notification in the bell: staff ones, and the student's own (orders, preorders). */
export type StaffNotification = {
    id: string;
    data:
        | PurchaseOrderUploadedData
        | DeliveryReminderData
        | LowStockData
        | SaleEndingData
        | SaleEndedData
        | OrderPlacedData
        | OrderReadyData
        | OrderLastDayData
        | OrderCancelledData
        | PreorderArrivedData
        | DeliveryRecordedData
        | PurchaseOrderClosedShortData;
    read: boolean;
    created_at: string | null;
};

export type StaffNotifications = {
    unread_count: number;
    recent: StaffNotification[];
};
