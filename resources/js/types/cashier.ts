/** One payment as the cashier's lists show it (a Payment Receipt). */
export type PaymentRow = {
    id: number;
    /** "RCT-2026-000001" */
    receipt_number: string | null;
    kind: 'order' | 'preorder';
    /** The slip it paid: "PW-0042" or "PR-0003". */
    number: string | null;
    buyer_name: string;
    buyer_id: string | null;
    is_staff: boolean;
    amount_centavos: number;
    method: 'cash' | 'gcash';
    method_label: string;
    /** Cash only. */
    amount_received_centavos: number | null;
    change_centavos: number | null;
    /** GCash only, 13 digits. */
    gcash_reference: string | null;
    paid_at: string;
    /** The cashier who received it. */
    cashier: string | null;
    void: boolean;
    voided_at: string | null;
    voided_by: string | null;
    void_reason: string | null;
    /** What was paid for has been handed over. */
    released: boolean;
};

/** A Payment Receipt as printed and shown. */
export type PaymentReceipt = {
    school: string;
    address_lines: string[];
    row: PaymentRow;
    /** "Order PW-0042" or "Preorder slip PR-0003". */
    for_label: string;
    section: string | null;
    lines: {
        quantity: number;
        item: string;
        unit_price_centavos: number;
        amount_centavos: number;
    }[];
    /** How many times the cashier printed it; from the second, REPRINT. */
    prints: number;
    note: string;
};

/** What payments add up to: the standing ones by method, the void ones apart. */
export type PaymentTotals = {
    count: number;
    total_centavos: number;
    cash_centavos: number;
    gcash_centavos: number;
    void_count: number;
    void_centavos: number;
};

export type PaymentPeriod = 'today' | 'week' | 'month' | 'custom';

export type PaymentFilters = {
    period: PaymentPeriod;
    date_from: string;
    date_to: string;
    method: '' | 'cash' | 'gcash';
    type: '' | 'order' | 'preorder';
    status: '' | 'paid' | 'void';
    search: string;
    group: 'day' | 'month';
};

/** A slip awaiting payment. */
export type AwaitingRow = {
    kind: 'order' | 'preorder';
    id: number;
    number: string | null;
    buyer_name: string;
    buyer_id: string | null;
    is_staff: boolean;
    /** The items (an order) or the item preordered. */
    for: string;
    amount_centavos: number;
    since: string | null;
    /** A preorder's last day to pay, when set. */
    pay_until: string | null;
};

/** The link to a slip's Payment Receipt (the standing one, else the latest void one). */
export type ReceiptLink = {
    id: number;
    receipt_number: string | null;
    void?: boolean;
};
