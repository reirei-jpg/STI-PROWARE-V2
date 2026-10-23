/** Students and pieces preordered for one size or color. */
export type PreorderVariantCount = {
    id: number;
    /** Null for a product without sizes or colors. */
    label: string | null;
    estore_item_code: string | null;
    students: number;
    pieces: number;
    /** Pieces students can buy now. */
    free_to_sell: number;
    /** The Specialist said this sold-out size will not be restocked. */
    not_restocked: boolean;
};

/**
 * Where a Preorder product is: taking preorders, closed and to order in
 * the eStore, or arrived (for sale; the students were told). A product for
 * sale is waiting for restock while students preordered a sold-out size.
 */
export type PreorderStage = 'sold_out' | 'open' | 'to_order' | 'arrived';

export type PreorderProductSummary = {
    id: number;
    name: string;
    photo_url: string | null;
    status: string;
    status_label: string;
    stage: PreorderStage;
    preorders_close_on: string | null;
    accepts_preorders: boolean;
    /** Waiting preorders; arrived ones once the product arrived. */
    students_count: number;
    pieces_total: number;
    /** When the students were told it arrived. */
    arrived_at: string | null;
    variants: PreorderVariantCount[];
};

/** One student's preorder, as the Specialist sees it. */
export type PreorderRow = {
    id: number;
    student_name: string;
    student_email: string;
    variant_label: string | null;
    quantity: number;
    /** gave_up: the student gave up the pieces held for them. */
    status:
        | 'active'
        | 'arrived'
        | 'cancelled'
        | 'not_restocked'
        | 'held'
        | 'ordered'
        | 'hold_ended'
        | 'gave_up';
    status_label: string;
    created_at: string | null;
    arrived_at: string | null;
    /** While held: until when. */
    held_until: string | null;
    /** Once ordered: the order it went into. */
    order_number: string | null;
};

/** One product in the details popup: what to order and who preordered. */
export type PreorderDetails = PreorderProductSummary & {
    /** The newest students first, up to 100; the rest on its own page. */
    preorders: PreorderRow[];
    preorders_count: number;
};

export type PreorderStageNumbers = {
    products: number;
    students: number;
    pieces: number;
};
