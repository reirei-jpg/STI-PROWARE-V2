/** What a product costs students, as shown on its tile. */
export type StorefrontPrice = {
    /** The lowest price per piece; null when not sold by the piece. */
    piece_centavos: number | null;
    /** True when sizes or colors have different prices ("From ₱350"). */
    piece_from: boolean;
    /** The sale price when On Sale. */
    sale_centavos: number | null;
    packs: {
        name: string;
        pieces: number;
        price_centavos: number;
        /** The pack's sale price while the product is On Sale. */
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
    /** When the sale ends, for an On Sale product. */
    sale_ends_at: string | null;
    /** The last day students can preorder, for a Preorder product. */
    preorders_close_on: string | null;
    /** When a Preorder product is expected to arrive, e.g. "Nov 13 – Nov 20, 2026". */
    expected_arrival: string | null;
    /** A lower price per piece for the first pieces preordered, and how many are still free. */
    early_bird: {
        price_centavos: number;
        pieces: number;
        pieces_left: number;
    } | null;
    /** A Preorder product taking preorders, or a product for sale with a sold-out size to preorder. */
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
        /** Its choice for each option, e.g. { Capacity: '14 oz', Color: 'Black' }. */
        choices: Record<string, string>;
        /** Its normal price per piece. */
        price_centavos: number | null;
        /** Its sale price per piece while On Sale; null when not on sale. */
        sale_price_centavos: number | null;
        /** Today's price per piece (the sale price while On Sale); null when it cannot be bought by the piece now. */
        buy_price_centavos: number | null;
        /** Pieces in stock, to cap how many can be added; 0 when it cannot be bought now. */
        stock_pieces: number;
        availability: StorefrontVariantAvailability;
        pieces_left: number | null;
        /** Sold out, and students can preorder it until it is back in stock. */
        can_preorder: boolean;
        /** Sold out, and the PROWARE office said it will not be restocked. */
        not_restocked: boolean;
    }[];
    /** Packs students can buy now, at today's price. */
    buy_packs: StorefrontBuyPack[];
};

export type StorefrontBuyPack = {
    id: number;
    name: string;
    pieces: number;
    price_centavos: number;
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
        /** Today's price of one piece bought on its own. */
        price_centavos: number | null;
        /** Pieces students can still buy. */
        stock_pieces: number;
        can_preorder: boolean;
    }[];
};

/** A course's uniform set students can buy whole, on the storefront. */
export type StorefrontUniformSet = {
    id: number;
    /** "BSIT Uniform Set" */
    name: string;
    /** The lowest a set comes to: its top's price plus its bottom's. */
    price_centavos: number;
    /** True when sizes or bottoms differ in price ("From ₱1,070"). */
    price_from: boolean;
    photo_url: string | null;
    options: {
        for: 'boys' | 'girls';
        /** "For Boys" */
        label: string;
        top: StorefrontSetPiece;
        /** For girls: the ladies' pants and / or the skirt. */
        bottoms: StorefrontSetPiece[];
    }[];
};

/** One line of the student's cart, at today's price. */
export type CartLine = {
    id: number;
    product_id: number;
    product_name: string;
    photo_url: string | null;
    variant_label: string | null;
    /** "Piece", or the pack's name. */
    unit_name: string;
    pieces_per_unit: number;
    quantity: number;
    /** Ticked for the next Place Order (the same on the website and the app). */
    selected: boolean;
    /** The most of this piece or pack that can be ordered now. */
    most_allowed: number;
    unit_price_centavos: number | null;
    on_sale: boolean;
    line_total_centavos: number;
    /** What to fix before the order can be placed. */
    problem: string | null;
    /** Part of a uniform set: its two lines share the key and are shown as one. */
    set: {
        key: string;
        /** "BSIT Uniform Set" */
        name: string;
        /** "For Boys" */
        for_label: string;
        /** One set today (top and bottom together); null when it cannot be bought now. */
        price_centavos: number | null;
    } | null;
};

export type OrderStatus = 'placed' | 'ready' | 'picked_up' | 'cancelled';

export type OrderRow = {
    id: number;
    /** "PW-0042" */
    number: string | null;
    status: OrderStatus;
    status_label: string;
    student_name: string;
    /** The student's 11-digit Student ID (null for older accounts). */
    student_id: string | null;
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
        unit_price_centavos: number;
        line_total_centavos: number;
    }[];
    placed_at: string | null;
    /** The last day to pick it up, "2026-10-06". */
    pick_up_by: string;
    ready_at: string | null;
    picked_up_at: string | null;
    cancelled_at: string | null;
    /** True when it was not released by its pick-up date. */
    expired: boolean;
    cancel_reason: string | null;
    /** The random code in the issuance slip's QR. */
    slip_code: string | null;
    /** The course/section the student gave at checkout ("BSIT 1-A"). */
    student_section: string | null;
};

/** An order on the Specialist's Orders page and slip screen. */
export type SpecialistOrderRow = OrderRow & {
    handled_by: string | null;
    /** Released today by mistake: it can be put back to Ready for pickup. */
    can_undo_release: boolean;
};

/** An order's issuance slip, as on STI College-Ormoc's paper form. */
export type IssuanceSlipData = {
    school: string;
    address_lines: string[];
    order_id: number;
    /** The order number ("PW-0042"), the slip's No. */
    number: string | null;
    /** The day the order was placed, "2026-10-09". */
    date: string | null;
    student_name: string;
    student_id: string | null;
    section: string | null;
    items: {
        quantity: number;
        /** "STI Hoodie (M)", "STI Ballpen · Box of 12" */
        item: string;
        unit_price_centavos: number;
        amount_centavos: number;
    }[];
    total_centavos: number;
    status: OrderStatus;
    status_label: string;
    pick_up_by: string;
    /** The day the items were handed over; null until released. */
    released_on: string | null;
    /** The Specialist who released the items. */
    issued_by: string | null;
    /** The QR as an SVG picture of the slip code. */
    qr_svg: string | null;
};

export type StorefrontFilters = {
    search: string | null;
    show: 'in_stock' | 'sold_out' | null;
};
