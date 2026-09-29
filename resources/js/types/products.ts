export type ProductStatus = 'draft' | 'preorder' | 'available' | 'on_sale';

export type ProductListItem = {
    id: number;
    name: string;
    status: ProductStatus;
    status_label: string;
    price_centavos: number;
    sale_price_centavos: number | null;
    photo_url: string | null;
    variants_count: number;
    updated_at: string | null;
};

export type ProductFilters = {
    search: string | null;
    status: ProductStatus | null;
};

export type ProductOptionInput = {
    name: string;
    choices: string[];
};

export type EditableProduct = {
    id: number;
    name: string;
    price: string;
    sale_price: string;
    status: ProductStatus;
    photos: { id: number; url: string; label: string }[];
    options: ProductOptionInput[];
    variants: {
        combination: string;
        estore_item_code: string;
        price: string;
    }[];
};
