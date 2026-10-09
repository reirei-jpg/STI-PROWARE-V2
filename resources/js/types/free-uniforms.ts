/** A size of a uniform product, with how many can be given now. */
export type UniformSizeOption = {
    id: number;
    /** "M", or "One size" for a product without sizes. */
    label: string;
    free_to_sell: number;
};

/** The blouse, polo or pants of a set: its product and sizes. */
export type UniformSetPiece = {
    product_id: number;
    product_name: string;
    sizes: UniformSizeOption[];
};

/** One course's free uniform set, e.g. BSIT. */
export type UniformSetOption = {
    id: number;
    name: string;
    blouse: UniformSetPiece | null;
    polo: UniformSetPiece | null;
    pants: UniformSetPiece | null;
    students_count: number;
};

export type UniformTop = 'blouse' | 'polo';

/** One row of the groups table. */
export type FreeUniformGroupRow = {
    id: number;
    enrolled_on: string;
    note: string | null;
    students_count: number;
    /** The first two students' names. */
    names: string[];
    more_names: number;
    /** e.g. "BSIT × 3 · BSHM × 2". */
    sets: string;
    /** Students with a piece still to give. */
    still_to_give: number;
    recorded_by: string;
    recorded_at: string | null;
};

export type FreeUniformsSummary = {
    this_month: number;
    students: number;
    groups: number;
    still_to_give: number;
    /** The fewest students a group needs (Maintenance). */
    group_size: number;
};

export type FreeUniformsShow = 'all' | 'still_to_give';

export type FreeUniformFilters = {
    show: FreeUniformsShow;
    search: string | null;
};

/** A student's top or pants in the group's details. */
export type FreeUniformPiece = {
    /** "Polo", "Blouse" or "Pants". */
    name: string;
    product_name: string;
    size: string;
    variant_id: number;
    given: boolean;
    /** The sizes to give it in, while still to give. */
    sizes: UniformSizeOption[];
};

export type FreeUniformGroupDetails = {
    id: number;
    enrolled_on: string;
    note: string | null;
    recorded_by: string;
    recorded_at: string | null;
    students: {
        id: number;
        name: string;
        enrollment_form_number: string;
        course_section: string | null;
        set_name: string;
        top: FreeUniformPiece;
        pants: FreeUniformPiece;
    }[];
};
