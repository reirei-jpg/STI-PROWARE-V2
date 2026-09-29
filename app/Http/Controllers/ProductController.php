<?php

namespace App\Http\Controllers;

use App\Actions\Products\SaveProduct;
use App\Enums\ProductStatus;
use App\Http\Requests\FilterProductsRequest;
use App\Http\Requests\SaveProductRequest;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\ProductPhoto;
use App\Models\ProductVariant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The Specialist's products: what students see and buy on the storefront.
 */
class ProductController extends Controller
{
    /**
     * List the products, most recently changed first, with a name search and
     * a status filter.
     */
    public function index(FilterProductsRequest $request): Response
    {
        $search = $request->search();
        $status = $request->status();

        $products = Product::query()
            ->with('mainPhoto')
            ->withCount('variants')
            ->when($search, fn (Builder $query, string $name) => $query->whereLike('name', "%{$name}%"))
            ->when($status, fn (Builder $query, ProductStatus $chosen) => $query->where('status', $chosen))
            ->latest('updated_at')
            ->latest('id')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (Product $product): array => [
                'id' => $product->id,
                'name' => $product->name,
                'status' => $product->status->value,
                'status_label' => $product->status->label(),
                'price_centavos' => $product->price_centavos,
                'sale_price_centavos' => $product->sale_price_centavos,
                'photo_url' => $product->mainPhoto?->url(),
                'variants_count' => $product->variants_count,
                'updated_at' => $product->updated_at?->toIso8601String(),
            ]);

        return Inertia::render('products/index', [
            'products' => $products,
            'filters' => [
                'search' => $search,
                'status' => $status?->value,
            ],
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('products/form', ['product' => null]);
    }

    public function store(SaveProductRequest $request, SaveProduct $saveProduct): RedirectResponse
    {
        $saveProduct->handle(new Product, $request);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Product saved.']);

        return to_route('products.index');
    }

    public function edit(Product $product): Response
    {
        $product->load(['photos', 'options', 'variants']);

        return Inertia::render('products/form', [
            'product' => [
                'id' => $product->id,
                'name' => $product->name,
                'price' => $this->pesos($product->price_centavos),
                'sale_price' => $product->sale_price_centavos === null ? '' : $this->pesos($product->sale_price_centavos),
                'status' => $product->status->value,
                'photos' => $product->photos->map(fn (ProductPhoto $photo): array => [
                    'id' => $photo->id,
                    'url' => $photo->url(),
                    'label' => $photo->label ?? '',
                ])->all(),
                'options' => $product->options->map(fn (ProductOption $option): array => [
                    'name' => $option->name,
                    'choices' => $option->choices,
                ])->all(),
                'variants' => $product->variants->map(fn (ProductVariant $variant): array => [
                    'combination' => $variant->combination,
                    'estore_item_code' => $variant->estore_item_code ?? '',
                    'price' => $variant->price_centavos === null ? '' : $this->pesos($variant->price_centavos),
                ])->all(),
            ],
        ]);
    }

    public function update(SaveProductRequest $request, Product $product, SaveProduct $saveProduct): RedirectResponse
    {
        $saveProduct->handle($product, $request);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Product saved.']);

        return to_route('products.index');
    }

    /**
     * 35050 becomes "350.50"; whole pesos stay whole ("350").
     */
    private function pesos(int $centavos): string
    {
        return $centavos % 100 === 0
            ? (string) intdiv($centavos, 100)
            : number_format($centavos / 100, 2, '.', '');
    }
}
