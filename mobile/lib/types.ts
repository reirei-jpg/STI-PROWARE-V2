/*
 * What the PROWARE server sends to the app. These match the website's types
 * (resources/js/types/storefront.ts), since both come from the same code.
 */

/** What a product costs students, as shown on its tile. */
export type StorefrontPrice = {
    /** The lowest price per piece; null when not sold by the piece. */
    piece_centavos: number | null;
    /** True when sizes or colors have different prices ("From ₱350"). */
    piece_from: boolean;
    /** The lowest sale price while On Sale. */
    sale_centavos: number | null;
    packs: {
        name: string;
        pieces: number;
        price_centavos: number;
        sale_price_centavos: number | null;
    }[];
};

export type StorefrontTileProduct = {
    id: number;
    name: string;
    status: 'preorder' | 'available' | 'on_sale';
    photo_url: string | null;
    price: StorefrontPrice;
    sold_out: boolean;
    almost_sold_out: boolean;
    /** Only given when few are left ("Only 3 left"). */
    pieces_left: number | null;
    sale_ends_at: string | null;
    preorders_close_on: string | null;
    accepts_preorders: boolean;
};

export type StorefrontVariantAvailability =
    | 'coming_soon'
    | 'in_stock'
    | 'almost_sold_out'
    | 'sold_out';

export type StorefrontProductDetails = StorefrontTileProduct & {
    photos: { url: string; label: string | null }[];
    options: { name: string; choices: string[] }[];
    variants: {
        id: number;
        label: string;
        price_centavos: number | null;
        sale_price_centavos: number | null;
        buy_price_centavos: number | null;
        stock_pieces: number;
        availability: StorefrontVariantAvailability;
        pieces_left: number | null;
    }[];
    buy_packs: {
        id: number;
        name: string;
        pieces: number;
        price_centavos: number;
    }[];
};

/** A page of a long list (Laravel's paginator). */
export type Page<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
};

/** One line of the cart, at today's price. */
export type CartLine = {
    id: number;
    product_id: number;
    product_name: string;
    photo_url: string | null;
    variant_label: string | null;
    unit_name: string;
    pieces_per_unit: number;
    quantity: number;
    /** Ticked for the next Place Order (the same on the website). */
    selected: boolean;
    most_allowed: number;
    unit_price_centavos: number | null;
    on_sale: boolean;
    line_total_centavos: number;
    /** What to fix before Place Order, or null. */
    problem: string | null;
};

export type CartView = {
    lines: CartLine[];
    /** How many lines are ticked; only these are ordered and totalled. */
    selected_count: number;
    total_centavos: number;
    can_place_order: boolean;
    pick_up_by: string;
    /** The course/section the student gave last time, for the slip. */
    section: string | null;
    /** Why Place Order would be refused (too many waiting, or paused). */
    order_refusal: string | null;
};

/** A student's order, with each item at the price it was ordered at. */
export type StudentOrder = {
    id: number;
    number: string | null;
    /** What the slip's QR holds. */
    slip_code: string | null;
    status: 'placed' | 'ready' | 'picked_up' | 'cancelled';
    status_label: string;
    student_name: string;
    student_section: string | null;
    total_centavos: number;
    items: {
        id: number;
        product_name: string;
        variant_label: string | null;
        unit_name: string;
        pieces_per_unit: number;
        quantity: number;
        unit_price_centavos: number;
        line_total_centavos: number;
    }[];
    placed_at: string | null;
    pick_up_by: string;
    ready_at: string | null;
    picked_up_at: string | null;
    cancelled_at: string | null;
    /** Cancelled by itself: not released by its pick-up date. */
    expired: boolean;
    cancel_reason: string | null;
    can_cancel: boolean;
};

/** An order's issuance slip, as on STI College-Ormoc's paper form. */
export type IssuanceSlipData = {
    school: string;
    address_lines: string[];
    order_id: number;
    number: string | null;
    date: string | null;
    student_name: string;
    section: string | null;
    items: {
        quantity: number;
        item: string;
        unit_price_centavos: number;
        amount_centavos: number;
    }[];
    total_centavos: number;
    status: StudentOrder['status'];
    status_label: string;
    pick_up_by: string;
    released_on: string | null;
    issued_by: string | null;
    /** The QR (an SVG picture of the slip code); null for old orders. */
    qr_svg: string | null;
};

/** A student's preorder (a reservation; nothing to pay). */
export type StudentPreorder = {
    id: number;
    product_id: number;
    product_name: string;
    photo_url: string | null;
    variant_label: string | null;
    quantity: number;
    status: 'active' | 'arrived' | 'cancelled';
    status_label: string;
    /** When the student was told it arrived. */
    arrived_at: string | null;
    preorders_close_on: string | null;
    can_cancel: boolean;
    created_at: string | null;
};

/** What a student's notice is about (the same notices as the website's bell). */
export type StudentNotificationData =
    | {
          kind: 'order_ready';
          order_id: number;
          order_number: string;
          total_centavos: number;
          pick_up_by: string | null;
      }
    | {
          kind: 'order_last_day';
          order_id: number;
          order_number: string;
          total_centavos: number;
          pick_up_by: string;
      }
    | { kind: 'order_cancelled'; order_id: number; order_number: string; reason: string | null }
    | { kind: 'preorder_arrived'; product_id: number; product_name: string }
    // The Specialist's notices.
    | {
          kind: 'order_placed';
          order_id: number;
          order_number: string;
          student_name: string;
          total_centavos: number;
          items_count: number;
      }
    | {
          kind: 'low_stock';
          product_id: number;
          product_name: string;
          stock_on_hand: number;
          alert_at: number;
      }
    | {
          kind: 'delivery_reminder';
          purchase_order_id: number;
          order_number: string | null;
          expected_delivery_date: string | null;
          when: string;
          percent_received: number;
          quantity_remaining: number;
      }
    | { kind: 'sale_ending'; product_id: number; product_name: string; ends_at: string | null }
    | { kind: 'sale_ended'; product_id: number; product_name: string; normal_price: string };

export type StudentNotification = {
    id: string;
    data: StudentNotificationData;
    read: boolean;
    created_at: string | null;
};

/* ---------- The PROWARE Specialist ---------- */

/** One to-do item, as on the website dashboard. */
export type SpecialistTask = {
    key: string;
    kind: string;
    title: string;
    detail: string;
    action: { label: string; url: string; method: string };
    /** The phone screen that opens it; null means it is done on the website. */
    target: { screen: 'order' | 'orders' | 'stock' | 'record_delivery'; id?: number } | null;
};

export type SpecialistTasks = {
    now: SpecialistTask[];
    today: SpecialistTask[];
    week: SpecialistTask[];
    cash: {
        waiting_orders: number;
        waiting_centavos: number;
        collected_orders: number;
        collected_centavos: number;
    };
};

/** A student's order on the Specialist's list. */
export type SpecialistOrder = Omit<StudentOrder, 'can_cancel'> & {
    handled_by: string | null;
    can_undo_release: boolean;
};

/** A scanned slip (or typed order number): the order, its slip, and the student's other open orders. */
export type SlipLookup = {
    order: SpecialistOrder;
    slip: IssuanceSlipData;
    other_open_orders: { id: number; number: string | null; status_label: string }[];
};

export type SpecialistOrderCounts = {
    placed: number;
    ready: number;
    picked_up: number;
    cancelled: number;
};

/** An eStore item code still waiting to arrive, with its orders, oldest first. */
export type WaitingDeliveryGroup = {
    item_code: string;
    description: string;
    /** Where it goes into stock; null when not linked to a product yet. */
    stock_target: {
        product_name: string;
        variant_label: string;
        has_options: boolean;
        unit_name: string;
        pieces_per_unit: number;
        /** Several variants share the code: count how many of each arrived. */
        split_into: { id: number; label: string; stock_on_hand: number }[];
    } | null;
    rows: {
        purchase_order_item_id: number;
        order_number: string | null;
        date_ordered: string;
        expected_delivery_date: string | null;
        quantity_ordered: number;
        quantity_received: number;
        quantity_remaining: number;
    }[];
};

/** A delivery already recorded. */
export type RecordedDelivery = {
    id: number;
    received_on: string;
    sales_invoice_number: string | null;
    delivery_receipt_number: string | null;
    note: string | null;
    recorded_by: string;
    recorded_at: string | null;
    order_numbers: string[];
    pieces_added_to_stock: number;
    items_not_in_stock: number;
};

/** A product in the stock lookup. */
export type StockListProduct = {
    id: number;
    name: string;
    photo_url: string | null;
    status_label: string;
    stock_on_hand: number;
    low_stock_alert_at: number;
    is_low: boolean;
};

/** One product's stock, as on the website's Stock History page. */
export type ProductStockView = {
    product: {
        id: number;
        name: string;
        has_options: boolean;
        stock_on_hand: number;
        low_stock_alert_at: number;
        is_sold: boolean;
    };
    variants: {
        id: number;
        label: string;
        stock_on_hand: number;
        estore_item_code: string | null;
        sent_by: string | null;
    }[];
    movements: Page<{
        id: number;
        created_at: string | null;
        variant_label: string;
        type: string;
        type_label: string;
        quantity: number;
        balance_after: number;
        reason_label: string | null;
        note: string | null;
        delivery: { received_on: string; sales_invoice_number: string | null; order_number: string | null } | null;
        order: { number: string | null; student_name: string } | null;
        recorded_by: string | null;
    }>;
};

export type StorefrontHome = {
    coming_soon: StorefrontTileProduct[];
    on_sale: StorefrontTileProduct[];
};
