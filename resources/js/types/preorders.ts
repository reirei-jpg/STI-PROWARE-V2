/** Students and pieces preordered for one size or color. */
export type PreorderVariantCount = {
    id: number;
    /** Null for a product without sizes or colors. */
    label: string | null;
    estore_item_code: string | null;
    students: number;
    pieces: number;
};

/**
 * Where a Preorder product is: taking preorders, closed and to order in
 * the eStore, or arrived (for sale; the students were told).
 */
export type PreorderStage = 'open' | 'to_order' | 'arrived';

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
    status: 'active' | 'arrived' | 'cancelled';
    status_label: string;
    created_at: string | null;
    arrived_at: string | null;
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
