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
    /** When a Preorder product is expected to arrive, e.g. "Nov 13 – Nov 20, 2026". */
    expected_arrival: string | null;
    /** A lower price per piece for the first pieces preordered, and how many are still free. */
    early_bird: { price_centavos: number; pieces: number; pieces_left: number } | null;
    /** A Preorder product taking preorders, or a product for sale with a sold-out size to preorder. */
    accepts_preorders: boolean;
    /** Its stock arrived in the last 3 days: the NEW tag and "New stock is available. Order now." */
    is_new: boolean;
    /** Sold out, with more on an uploaded eStore order. */
    available_soon: boolean;
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
        /** Its choice for each option, e.g. { Capacity: '14 oz', Color: 'Black' }. */
        choices: Record<string, string>;
        price_centavos: number | null;
        sale_price_centavos: number | null;
        buy_price_centavos: number | null;
        stock_pieces: number;
        availability: StorefrontVariantAvailability;
        pieces_left: number | null;
        /** Sold out, and students can preorder it until it is back in stock. */
        can_preorder: boolean;
        /** Sold out, and the PROWARE office said it will not be restocked. */
        not_restocked: boolean;
        /** Sold out, with more on an uploaded eStore order. */
        available_soon: boolean;
    }[];
    buy_packs: {
        id: number;
        name: string;
        pieces: number;
        price_centavos: number;
    }[];
    /** The most of one item this buyer can get (the Maintenance setting, or more when the Specialist allowed them). */
    most_per_item?: number;
    /** The product's own most pieces per buyer, all sizes together; null: no limit. */
    most_per_buyer?: number | null;
    /** How many more pieces this buyer can still get of it; null: no limit. */
    per_buyer_left?: number | null;
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
    /** What Undo after Remove puts back (the same as Add to Cart sends). */
    product_variant_id: number;
    product_pack_id: number | null;
    product_name: string;
    photo_url: string | null;
    variant_label: string | null;
    unit_name: string;
    pieces_per_unit: number;
    quantity: number;
    /** Ticked for the next Place Order (the same on the website). */
    selected: boolean;
    most_allowed: number;
    /** The buyer's limit stops it before the stock does. */
    stopped_by_limit?: boolean;
    /** The product's own most pieces per buyer (null: none, or a uniform set). */
    most_per_buyer?: number | null;
    /** The product's Most per buyer stops it first. */
    stopped_by_product?: boolean;
    unit_price_centavos: number | null;
    on_sale: boolean;
    line_total_centavos: number;
    /** What to fix before Place Order, or null. */
    problem: string | null;
    /** Part of a uniform set: its two lines share the key and are shown as one. */
    set: {
        key: string;
        name: string;
        for_label: string;
        /** One set today (top and bottom together); null when it cannot be bought now. */
        price_centavos: number | null;
        /** What Undo after Remove puts back (the same as adding the set sends). */
        uniform_set_id: number | null;
        for: string;
        top_variant_id: number | null;
        bottom_variant_id: number | null;
    } | null;
};

/** One piece of a uniform set (the top, or a bottom) with its sizes. */
export type StorefrontSetPiece = {
    product_id: number;
    name: string;
    /** "Polo", "Pants", "Blouse", "Ladies' Pants" or "Skirt". */
    kind: string;
    sizes: {
        variant_id: number;
        label: string;
        price_centavos: number | null;
        stock_pieces: number;
        can_preorder: boolean;
    }[];
};

/** A course's uniform set students can buy whole (the same as the website's). */
export type StorefrontUniformSet = {
    id: number;
    name: string;
    /** The lowest a set comes to: its top's price plus its bottom's. */
    price_centavos: number;
    /** True when sizes or bottoms differ in price ("From ₱1,070"). */
    price_from: boolean;
    photo_url: string | null;
    options: {
        for: 'boys' | 'girls';
        label: string;
        top: StorefrontSetPiece;
        bottoms: StorefrontSetPiece[];
    }[];
};

export type CartView = {
    lines: CartLine[];
    /** How many lines are ticked; only these are ordered and totalled. */
    selected_count: number;
    total_centavos: number;
    can_place_order: boolean;
    /** The course/section the student gave last time, for the slip. */
    section: string | null;
};

/** A student's order, with each item at the price it was ordered at. */
export type StudentOrder = {
    id: number;
    number: string | null;
    /** What the slip's QR holds. */
    slip_code: string | null;
    /** Waiting for payment, released, or cancelled. Orders hold no stock: whoever pays first gets it. */
    status: 'placed' | 'paid' | 'picked_up' | 'cancelled';
    status_label: string;
    student_name: string;
    /** The student's 11-digit Student ID, or an STI staff buyer's Employee ID (null for older accounts). */
    student_id: string | null;
    /** The course/section, or an STI staff buyer's office/department. */
    student_section: string | null;
    /** True when the buyer is STI staff (a teacher or employee), not a student. */
    is_staff: boolean;
    total_centavos: number;
    items: {
        id: number;
        product_name: string;
        variant_label: string | null;
        /** "BSIT Uniform Set (For Boys)" when bought as part of a set. */
        set_name: string | null;
        unit_name: string;
        pieces_per_unit: number;
        quantity: number;
        /** How many were not released because buyers who paid first got them. */
        quantity_short: number;
        unit_price_centavos: number;
        line_total_centavos: number;
    }[];
    placed_at: string | null;
    /** When the cashier marked it Paid (null: not paid yet). */
    paid_at?: string | null;
    /** Only on orders from before orders stopped holding stock. */
    pick_up_by: string | null;
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
    /** The Student ID, or an STI staff buyer's Employee ID. */
    student_id: string | null;
    section: string | null;
    /** True when the buyer is STI staff: the slip says Employee instead of Student. */
    is_staff: boolean;
    items: {
        quantity: number;
        item: string;
        unit_price_centavos: number;
        amount_centavos: number;
    }[];
    total_centavos: number;
    status: StudentOrder['status'];
    status_label: string;
    /** Only on orders from before orders stopped holding stock. */
    pick_up_by: string | null;
    released_on: string | null;
    issued_by: string | null;
    /** The QR (an SVG picture of the slip code); null for old orders. */
    qr_svg: string | null;
};

/** A buyer's preorder; its batch is paid at the cashier with a preorder slip. */
export type StudentPreorder = {
    id: number;
    /** Preorders placed with one press of Preorder share it (one card). */
    batch?: string;
    product_id: number;
    product_variant_id: number;
    product_name: string;
    photo_url: string | null;
    variant_label: string | null;
    quantity: number;
    /** Price per piece on the day it was preordered (null for older preorders). */
    preordered_price_centavos: number | null;
    status: 'active' | 'arrived' | 'cancelled' | 'not_restocked' | 'held' | 'ordered' | 'hold_ended' | 'not_paid';
    status_label: string;
    /** When the student was told it arrived. */
    arrived_at: string | null;
    preorders_close_on: string | null;
    /** When the Coming Soon product is expected to arrive (active preorders only). */
    expected_arrival: string | null;
    /** How many of its pieces get the early-bird price, and that price. */
    early_bird_pieces: number;
    early_bird_price_centavos: number | null;
    /** A sold-out size of an item for sale, waiting to be back in stock. */
    waiting_for_restock: boolean;
    can_cancel: boolean;
    /** Its size, color or quantity can still be changed. */
    can_edit?: boolean;
    /** When the buyer last changed it. */
    edited_at?: string | null;
    created_at: string | null;
    /** When the student was told it will not be restocked. */
    not_restocked_at: string | null;
    not_restocked_reason: string | null;
    /** Held pieces: until when, and today's price per piece. */
    /** The order the held pieces went into. */
    order_id: number | null;
    order_number: string | null;
    order_status: 'placed' | 'paid' | 'picked_up' | 'cancelled' | null;
    hold_ended_at: string | null;
    /** The payment dates (null until the Specialist sets them). */
    pay_from?: string | null;
    pay_until?: string | null;
    /** The batch's preorder slip (PR-0001); missing on a server from before slips. */
    slip_id?: number | null;
    slip_number?: string | null;
    slip_paid?: boolean;
    /** What to pay, or what was paid. */
    slip_amount_centavos?: number | null;
    paid_on?: string | null;
};

/** A preorder slip (PR-0001): paid at the cashier, then the buyer's proof of payment. */
export type PreorderSlipData = Omit<IssuanceSlipData, 'order_id' | 'status' | 'pick_up_by' | 'released_on' | 'issued_by' | 'qr_svg'> & {
    kind: 'preorder';
    slip_id: number;
    product_id: number;
    product_name: string;
    /** released: every piece was given to the buyer. */
    /** not_paid: dropped, not paid by the closing date; closed: cancelled or ordered, nothing to pay. */
    status: 'waiting_payment' | 'paid' | 'released' | 'not_paid' | 'closed';
    /** The product's last day to preorder and pay. */
    closed_on: string | null;
    paid_on: string | null;
    /** The Specialist who marked it paid. */
    received_by: string | null;
    qr_svg: string;
};

/** What a student's notice is about (the same notices as the website's bell). */
export type StudentNotificationData =
    | {
          kind: 'order_ready';
          order_id: number;
          order_number: string;
          items: string;
          total_centavos: number;
          pick_up_by: string | null;
      }
    | {
          kind: 'order_paid';
          order_id: number;
          order_number: string;
          items: string;
          total_centavos: number;
          short?: string | null;
          payment_id?: number | null;
          receipt_number?: string | null;
      }
    | { kind: 'order_released'; order_id: number; order_number: string; items: string; short?: string | null }
    | {
          kind: 'order_last_day';
          order_id: number;
          order_number: string;
          items: string;
          total_centavos: number;
          pick_up_by: string;
      }
    | { kind: 'order_cancelled'; order_id: number; order_number: string; items: string; reason: string | null }
    | { kind: 'preorder_arrived'; product_id: number; product_name: string; variant_label?: string | null }
    | {
          kind: 'preorder_pay_by';
          product_id: number;
          product_name: string;
          slip_id: number;
          number: string | null;
          amount_centavos: number;
          pay_from: string | null;
          pay_until: string | null;
      }
    | { kind: 'preorder_not_paid'; product_id: number; product_name: string; closed_on: string }
    | {
          kind: 'preorder_ready';
          slip_id: number | null;
          number: string | null;
          product_id: number;
          product_name: string;
          variant_label: string | null;
          pieces: number;
      }
    | {
          kind: 'preorder_paid';
          slip_id: number;
          number: string | null;
          product_id: number;
          product_name: string;
          paid_centavos: number | null;
          payment_id?: number | null;
          receipt_number?: string | null;
      }
    | {
          kind: 'product_announced';
          product_id: number;
          product_name: string;
          price_from_centavos: number | null;
          price_to_centavos: number | null;
          note: string | null;
      }
    | {
          kind: 'preorder_received';
          product_id: number;
          product_name: string;
          lines: { variant_label: string | null; quantity: number }[];
          /** A sold-out size (back in stock) rather than a Coming Soon item (here). */
          sold_out: boolean;
      }
    | {
          kind: 'preorder_held';
          preorder_id: number;
          product_id: number;
          product_name: string;
          variant_label: string | null;
          held: number;
          preordered: number;
          held_until: string | null;
          price_centavos?: number | null;
          early_bird_pieces?: number;
          early_bird_price_centavos?: number | null;
      }
    | {
          kind: 'preorder_hold_ended';
          preorder_id: number;
          product_id: number;
          product_name: string;
          variant_label: string | null;
          held: number;
          /** The rest of the preorder that closed with it (older notices: none). */
          rest_closed?: number;
      }
    | {
          kind: 'preorder_arrival_changed';
          product_id: number;
          product_name: string;
          expected_arrival: string | null;
          before: string | null;
      }
    | {
          kind: 'preorder_not_restocked';
          product_id: number;
          product_name: string;
          variant_label: string | null;
          reason: string | null;
      }
    // The Specialist lifted the student's ordering pause.
    | { kind: 'ordering_resumed' }
    // Too many orders expired: ordering is paused until paused_until.
    | { kind: 'ordering_paused'; paused_until: string; expired_orders: number }
    // Sign-in: the owner's account was locked after 5 wrong passwords, or
    // signed in on a phone.
    | { kind: 'account_locked'; locked_until: string }
    | { kind: 'phone_signed_in'; device_name: string; signed_in_at: string }
    // The Specialist's notice that a buyer's account was locked.
    | {
          kind: 'account_locked_staff';
          user_id: number;
          name: string;
          email: string;
          locked_until: string;
          locks_today: number;
      }    // The Specialist's notices.
    | {
          kind: 'order_cancelled_by_student';
          order_id: number;
          order_number: string | null;
          student_name: string;
          reason: string | null;
      }
    | {
          kind: 'order_placed';
          order_id: number;
          order_number: string;
          student_name: string;
          total_centavos: number;
          items_count: number;
      }
    // The cashier recorded a payment: an order to release, or a preorder slip.
    | {
          kind: 'payment_recorded';
          order_id: number | null;
          preorder_slip_id: number | null;
          number: string | null;
          buyer_name: string;
          amount_centavos: number;
      }
    // A paid order or slip is awaiting payment again (to the Specialist; no cashier details).
    | {
          kind: 'payment_undone_staff';
          order_id: number | null;
          preorder_slip_id: number | null;
          number: string | null;
          buyer_name: string;
      }
    // The cashier undid the buyer's payment recorded by mistake (to the buyer).
    | {
          kind: 'payment_undone';
          order_id: number | null;
          slip_id: number | null;
          items: string;
          amount_centavos: number;
          reason: string;
          receipt_number?: string | null;
      }
    | {
          kind: 'low_stock';
          product_id: number;
          product_name: string;
          stock_on_hand: number;
          alert_at: number;
      }
    | {
          kind: 'preorder_placed';
          product_id: number;
          product_name: string;
          variant_label: string | null;
          student_name: string;
          quantity: number;
      }
    | { kind: 'sale_ending'; product_id: number; product_name: string; ends_at: string | null }
    | { kind: 'sale_ended'; product_id: number; product_name: string; normal_price: string }
    | {
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
    /** On an "And N more" line, the N tasks it stands for. */
    hidden: number;
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
    /** The website dashboard's order cards: how many, and the first few. */
    order_cards: Record<OrderCardKey, { count: number; orders: SpecialistOrder[] }>;
    /** Low stock, best sellers and ready to order (missing on an older server). */
    stock_cards?: StockCardsData;
};

/** The dashboard's stock cards (StockCards on the server). */
export type StockCardsData = {
    low_stock: {
        count: number;
        items: { product_id: number; product_name: string; pieces_left: number; out_of_stock: boolean; warn_at: number; low_sizes?: string | null }[];
    };
    best_sellers: { from: string; items: { product_id: number; product_name: string; pieces: number }[] };
    /** Preorder slips waiting for their items; missing on an older server. */
    preorder_slips?: { to_verify: number; paid: number; all: number };
    /** Missing on a server from before this card. */
    top_buyers?: {
        from: string;
        buyers_count: number;
        items: {
            user_id: number;
            name: string;
            email: string;
            orders: number;
            pieces: number;
            spent_centavos: number;
            last_bought_at: string | null;
        }[];
        sizes: number[];
        products: {
            product_id: number;
            product_name: string;
            arrived_on: string | null;
            price_from_centavos: number | null;
            price_to_centavos: number | null;
            announced_at: string | null;
        }[];
        last: {
            product_name: string;
            top: number;
            recipients: number;
            note: string | null;
            sent_at: string | null;
            sent_by: string | null;
        } | null;
    };
};

export type OrderCardKey = 'waiting' | 'paid' | 'released_today';

/** A student's order on the Specialist's list. */
export type SpecialistOrder = Omit<StudentOrder, 'can_cancel'> & {
    handled_by: string | null;
};

/** A scanned slip (or typed order number): the order, its slip, and the student's other open orders. */
export type SlipLookup = {
    order: SpecialistOrder;
    slip: IssuanceSlipData;
    other_open_orders: { id: number; number: string | null; status_label: string }[];
};

export type SpecialistOrderCounts = {
    paid: number;
    placed: number;
    ready?: number;
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
    } | null;
    rows: {
        purchase_order_item_id: number;
        order_number: string | null;
        date_ordered: string;
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
    /** Available or On Sale; Draft and Preorder items are not out or low. */
    is_sold: boolean;
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
        /** Hidden from buyers (not sold yet). */
        is_draft: boolean;
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

/** One product in the store pop-up: a size that came back in stock, or a sale. */
export type StorefrontSpotlightItem = {
    reason: 'back_in_stock' | 'on_sale';
    /** The sizes or colors that came back; empty for a product without options. */
    back_in_stock: string[];
    product: StorefrontTileProduct;
};

export type StorefrontHome = {
    coming_soon: StorefrontTileProduct[];
    on_sale: StorefrontTileProduct[];
    uniform_sets: StorefrontUniformSet[];
    /** The most uniform sets this buyer can add at once (BuyerLimit on the server). */
    most_per_item?: number;
    /** The store pop-up, never narrowed by the search. */
    spotlight: StorefrontSpotlightItem[];
};

/** One item in a buyer's wishlist (the website's Wishlist::view). */
export type WishlistRow = {
    id: number;
    product_id: number;
    /** Null: no size or color chosen yet. */
    product_variant_id: number | null;
    product_name: string;
    variant_label: string | null;
    photo_url: string | null;
    /** Today's price (the chosen size's, when one was chosen). */
    price: StorefrontPrice;
    on_sale: boolean;
    /** In stock now: Add to Cart. */
    can_buy: boolean;
    /** Sold out or Coming Soon, and it can be preordered. */
    can_preorder: boolean;
    /** "6 pcs left", "Only 2 pcs left", "Out of stock · preorder it"… */
    status_text: string;
    status_tone: 'green' | 'amber' | 'red' | 'blue' | 'slate';
    added_on: string | null;
    product: StorefrontTileProduct;
};
/** A slip the cashier scanned or typed (the website's CashierDesk::lookup). */
export type CashierLookup = {
    kind: 'order' | 'preorder';
    /** The order, for an issuance slip. */
    order?: SpecialistOrder;
    /** The issuance slip (order) or the preorder slip. */
    slip: Omit<IssuanceSlipData, 'status'> & { slip_id?: number; status: string; product_name?: string };
    can_mark_paid: boolean;
    refusal: string | null;
    /** What to collect now: only what is still left. */
    to_collect_centavos: number | null;
    /** What is no longer left, so not charged. */
    short: string[];
    /** Paid today and not released (or its items not arrived): Undo payment. */
    can_undo: boolean;
    /** Its Payment Receipt, once paid. */
    receipt: ReceiptLink | null;
};

/** Today's payments (every receipt issued today); a void one is listed but not in the total. */
export type CashierPaidToday = {
    rows: PaymentRow[];
    total_centavos: number;
};

/** One payment as the cashier's lists show it (a Payment Receipt). */
export type PaymentRow = {
    id: number;
    /** "RCT-2026-000001" */
    receipt_number: string | null;
    kind: 'order' | 'preorder';
    number: string | null;
    buyer_name: string;
    buyer_id: string | null;
    is_staff: boolean;
    amount_centavos: number;
    method: 'cash' | 'gcash';
    method_label: string;
    amount_received_centavos: number | null;
    change_centavos: number | null;
    gcash_reference: string | null;
    paid_at: string;
    cashier: string | null;
    void: boolean;
    voided_at: string | null;
    voided_by: string | null;
    void_reason: string | null;
    released: boolean;
};

/** A Payment Receipt as issued. */
export type PaymentReceipt = {
    school: string;
    address_lines: string[];
    row: PaymentRow;
    for_label: string;
    section: string | null;
    lines: { quantity: number; item: string; unit_price_centavos: number; amount_centavos: number }[];
    prints: number;
    note: string;
};

/** The link to a slip's Payment Receipt (the standing one, else the latest void one). */
export type ReceiptLink = { id: number; receipt_number: string | null; void?: boolean };

/** What payments add up to: the standing ones by method, the void ones apart. */
export type PaymentTotals = {
    count: number;
    total_centavos: number;
    cash_count: number;
    cash_centavos: number;
    gcash_count: number;
    gcash_centavos: number;
    void_count: number;
    void_centavos: number;
};

/** A slip awaiting payment. */
export type AwaitingRow = {
    kind: 'order' | 'preorder';
    id: number;
    number: string | null;
    buyer_name: string;
    buyer_id: string | null;
    is_staff: boolean;
    for: string;
    amount_centavos: number;
    since: string | null;
    pay_until: string | null;
};

/** What the cashier sees on opening the app. */
export type CashierDashboard = {
    today: PaymentTotals;
    awaiting: { orders: number; slips: number; total_centavos: number };
    latest: PaymentRow[];
    oldest_awaiting: AwaitingRow[];
};

export type PaymentFilters = {
    period: 'today' | 'week' | 'month' | 'custom';
    date_from: string;
    date_to: string;
    method: '' | 'cash' | 'gcash';
    type: '' | 'order' | 'preorder';
    status: '' | 'paid' | 'void';
    search: string;
    group: 'day' | 'month';
};

export type CollectionRow = {
    period: string;
    label: string;
    count: number;
    total_centavos: number;
    cash_centavos: number;
    gcash_centavos: number;
    void_count: number;
};