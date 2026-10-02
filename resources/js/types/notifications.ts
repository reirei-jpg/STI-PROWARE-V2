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

export type StaffNotification = {
    id: string;
    data:
        | PurchaseOrderUploadedData
        | DeliveryReminderData
        | LowStockData
        | SaleEndingData
        | SaleEndedData;
    read: boolean;
    created_at: string | null;
};

export type StaffNotifications = {
    unread_count: number;
    recent: StaffNotification[];
};
