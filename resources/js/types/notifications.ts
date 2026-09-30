export type PurchaseOrderUploadedData = {
    purchase_order_id: number;
    order_number: string | null;
    uploaded_by: string;
    date_ordered: string;
    total_amount_centavos: number | null;
    items_count: number;
};

export type StaffNotification = {
    id: string;
    data: PurchaseOrderUploadedData;
    read: boolean;
    created_at: string | null;
};

export type StaffNotifications = {
    unread_count: number;
    recent: StaffNotification[];
};
