export type PurchaseOrderUploadedData = {
    kind?: 'purchase_order_uploaded';
    purchase_order_id: number;
    order_number: string | null;
    uploaded_by: string;
    date_ordered: string;
    total_amount_centavos: number | null;
    items_count: number;
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
    /** The size that is back in stock; missing or null for a Coming Soon product. */
    variant_label?: string | null;
};

/** The sold-out size the student preordered will not be restocked. */
export type PreorderNotRestockedData = {
    kind: 'preorder_not_restocked';
    product_id: number;
    product_name: string;
    variant_label: string | null;
    reason: string | null;
};

/** The expected arrival of a product the student preordered was set or changed. */
export type PreorderArrivalChangedData = {
    kind: 'preorder_arrival_changed';
    product_id: number;
    product_name: string;
    expected_arrival: string | null;
    before: string | null;
};

/** The student's preordered pieces arrived and are held for them (24 hours). */
export type PreorderHeldData = {
    kind: 'preorder_held';
    preorder_id: number;
    product_id: number;
    product_name: string;
    variant_label: string | null;
    held: number;
    preordered: number;
    held_until: string | null;
};

/** The held pieces were not ordered in time and went to the next student. */
export type PreorderHoldEndedData = {
    kind: 'preorder_hold_ended';
    preorder_id: number;
    product_id: number;
    product_name: string;
    variant_label: string | null;
    held: number;
    /** The rest of the preorder that closed with it (older notices: none). */
    rest_closed?: number;
};

/** A student preordered a sold-out size (for the Specialist). */
export type PreorderPlacedData = {
    kind: 'preorder_placed';
    product_id: number;
    product_name: string;
    variant_label: string | null;
    student_name: string;
    quantity: number;
};

/** The Specialist lifted the student's ordering pause. */
export type OrderingResumedData = {
    kind: 'ordering_resumed';
};

/** Too many orders expired: the student cannot order until paused_until. */
export type OrderingPausedData = {
    kind: 'ordering_paused';
    paused_until: string;
    expired_orders: number;
};

/** A student cancelled their own order (to the Specialist). */
export type OrderCancelledByStudentData = {
    kind: 'order_cancelled_by_student';
    order_id: number;
    order_number: string | null;
    student_name: string;
    reason: string | null;
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

/** Everything an eStore order asked for has arrived (to the School Admin). */
export type PurchaseOrderCompletedData = {
    kind: 'purchase_order_completed';
    purchase_order_id: number;
    order_number: string | null;
    date_ordered: string;
    completed_at: string | null;
    completed_after_days: number;
    /** Received, as counted on the eStore. */
    quantity_received: number;
    recorded_by: string;
};

/** An eStore order not complete after the follow-up days (to the School Admin). */
export type PurchaseOrderLateData = {
    kind: 'purchase_order_late';
    purchase_order_id: number;
    order_number: string | null;
    date_ordered: string;
    days_since_ordered: number;
    late_days: number;
    quantity_received: number;
    quantity_ordered: number;
    percent_received: number;
};

/** The School Admin's reminder about a late eStore order (to the Specialist). */
export type PurchaseOrderReminderData = {
    kind: 'purchase_order_reminder';
    purchase_order_id: number;
    order_number: string | null;
    date_ordered: string;
    days_since_ordered: number;
    late_days: number;
    quantity_remaining: number;
    quantity_ordered: number;
    reminded_by: string;
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
        | LowStockData
        | SaleEndingData
        | SaleEndedData
        | OrderPlacedData
        | OrderReadyData
        | OrderLastDayData
        | OrderCancelledData
        | PreorderArrivedData
        | PreorderNotRestockedData
        | PreorderArrivalChangedData
        | PreorderHeldData
        | PreorderHoldEndedData
        | PreorderPlacedData
        | OrderingResumedData
        | OrderingPausedData
        | OrderCancelledByStudentData
        | DeliveryRecordedData
        | PurchaseOrderCompletedData
        | PurchaseOrderLateData
        | PurchaseOrderReminderData
        | PurchaseOrderClosedShortData;
    read: boolean;
    created_at: string | null;
};

export type StaffNotifications = {
    unread_count: number;
    recent: StaffNotification[];
};
