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

export type StaffNotification = {
    id: string;
    data: PurchaseOrderUploadedData | DeliveryReminderData;
    read: boolean;
    created_at: string | null;
};

export type StaffNotifications = {
    unread_count: number;
    recent: StaffNotification[];
};
