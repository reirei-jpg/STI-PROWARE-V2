/** Students and pieces preordered for one size or color. */
export type PreorderVariantCount = {
    id: number;
    /** Null for a product without sizes or colors. */
    label: string | null;
    estore_item_code: string | null;
    students: number;
    pieces: number;
};

export type PreorderProductSummary = {
    id: number;
    name: string;
    photo_url: string | null;
    status: string;
    status_label: string;
    preorders_close_on: string | null;
    accepts_preorders: boolean;
    students_count: number;
    pieces_total: number;
    variants: PreorderVariantCount[];
};

/** One student's preorder, as the Specialist sees it. */
export type PreorderRow = {
    id: number;
    student_name: string;
    student_email: string;
    variant_label: string | null;
    quantity: number;
    created_at: string | null;
};
