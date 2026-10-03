<?php

namespace App\Http\Controllers;

use App\Http\Requests\FilterItemsToLinkRequest;
use App\Http\Requests\LinkItemRequest;
use App\Http\Requests\SplitDeliveredItemRequest;
use App\Models\DeliveryItem;
use App\Models\Product;
use App\Models\ProductPack;
use App\Models\ProductVariant;
use App\Models\PurchaseOrderItem;
use App\Services\Stock\DeliveredStock;
use App\Services\Stock\LinkedItems;
use App\Services\Stock\Units;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Items to Link: eStore items from uploaded orders whose Item Code is not on
 * any product yet. The Specialist links each one once (or creates a product
 * from it); from then on its deliveries go into stock by themselves.
 */
class ItemLinkController extends Controller
{
    /**
     * One row per eStore Item Code, items already received but not in stock
     * first, then the most recently ordered.
     */
    public function index(FilterItemsToLinkRequest $request): Response
    {
        $search = $request->search();

        $waitingForStock = DeliveryItem::query()
            ->selectRaw('coalesce(sum(delivery_items.quantity_received), 0)')
            ->join('purchase_order_items as delivered', 'delivered.id', '=', 'delivery_items.purchase_order_item_id')
            ->whereColumn('delivered.item_code', 'purchase_order_items.item_code')
            ->whereDoesntHave('stockMovements');

        $items = PurchaseOrderItem::query()
            ->notLinkedToProduct()
            ->select('purchase_order_items.item_code')
            ->selectRaw('sum(purchase_order_items.quantity_ordered) as quantity_ordered_total')
            ->selectRaw('count(distinct purchase_order_items.purchase_order_id) as orders_count')
            ->selectRaw('max(purchase_order_items.id) as latest_item_id')
            ->selectSub($waitingForStock, 'waiting_for_stock')
            ->when($search, fn (Builder $query, string $term) => $query->where(
                fn (Builder $inner) => $inner
                    ->whereLike('purchase_order_items.item_code', "%{$term}%")
                    ->orWhereLike('purchase_order_items.description', "%{$term}%"),
            ))
            ->groupBy('purchase_order_items.item_code')
            ->orderByDesc('waiting_for_stock')
            ->orderByDesc('latest_item_id')
            ->paginate(20)
            ->withQueryString();

        $latestItems = PurchaseOrderItem::query()
            ->with('purchaseOrder')
            ->whereKey($items->getCollection()->map(fn (PurchaseOrderItem $item): int => (int) $item->getAttribute('latest_item_id'))->all())
            ->get()
            ->keyBy('id');

        return Inertia::render('products/items-to-link', [
            'items' => $items->through(function (PurchaseOrderItem $item) use ($latestItems): array {
                /** @var PurchaseOrderItem $latest */
                $latest = $latestItems->get((int) $item->getAttribute('latest_item_id'));

                return [
                    'item_code' => $item->item_code,
                    'description' => $latest->description,
                    'unit_price_centavos' => $latest->unit_price_centavos,
                    'category' => $latest->purchaseOrder->category,
                    'latest_order_number' => $latest->purchaseOrder->order_number,
                    'latest_date_ordered' => $latest->purchaseOrder->date_ordered->toDateString(),
                    'orders_count' => (int) $item->getAttribute('orders_count'),
                    'quantity_ordered' => (int) $item->getAttribute('quantity_ordered_total'),
                    'waiting_for_stock' => (int) $item->getAttribute('waiting_for_stock'),
                ];
            }),
            'filters' => ['search' => $search],
            'toSplit' => $this->waitingToSplit(),
        ]);
    }

    /**
     * Items of a code shared by several variants (e.g. every color) that
     * arrived but are not in stock yet, because nobody said how many of
     * each variant came, e.g. received before the code was linked.
     *
     * @return list<array{item_code: string, description: string, product_name: string, unit_name: string, pieces_per_unit: int, units_waiting: int, pieces_waiting: int, split_into: list<array{id: int, label: string, stock_on_hand: int}>}>
     */
    private function waitingToSplit(): array
    {
        $waiting = LinkedItems::waitingToSplit();
        $variantsByCode = LinkedItems::variantsByCode($waiting->pluck('item_code')->all());

        return array_values($waiting->map(function (DeliveryItem $row) use ($variantsByCode): array {
            $code = (string) $row->getAttribute('item_code');
            $target = LinkedItems::target($variantsByCode->get($code) ?? new EloquentCollection);
            $units = (int) $row->getAttribute('units_waiting');

            return [
                'item_code' => $code,
                'description' => (string) $row->getAttribute('description'),
                'product_name' => $target['product_name'],
                'unit_name' => $target['unit_name'],
                'pieces_per_unit' => $target['pieces_per_unit'],
                'units_waiting' => $units,
                'pieces_waiting' => $units * $target['pieces_per_unit'],
                'split_into' => $target['split_into'],
            ];
        })->all());
    }

    /**
     * Put what arrived of a shared code into stock, as counted per variant.
     */
    public function split(SplitDeliveredItemRequest $request, DeliveredStock $deliveredStock): RedirectResponse
    {
        $code = $request->itemCode();
        $pieces = $deliveredStock->splitWaiting($code, $request->piecesByVariant(), $request->user());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Added '.Units::count($pieces, 'Piece')." of {$code} to stock: ".$request->summary().'.',
        ]);

        return back();
    }

    /**
     * Products to choose from in the Link pop-up, found by name, with their
     * variants and packs.
     */
    public function products(Request $request): JsonResponse
    {
        $validated = $request->validate(['search' => ['nullable', 'string', 'max:120']]);
        $search = trim((string) ($validated['search'] ?? ''));

        $products = Product::query()
            ->with(['variants', 'packs'])
            ->when($search !== '', fn (Builder $query) => $query->whereLike('name', "%{$search}%"))
            ->orderBy('name')
            ->limit(10)
            ->get();

        return response()->json([
            'products' => $products->map(fn (Product $product): array => [
                'id' => $product->id,
                'name' => $product->name,
                'variants' => $product->variants->map(fn (ProductVariant $variant): array => [
                    'id' => $variant->id,
                    'label' => $variant->label(),
                    'estore_item_code' => $variant->estore_item_code,
                ])->all(),
                'packs' => $product->packs->map(fn (ProductPack $pack): array => [
                    'id' => $pack->id,
                    'name' => $pack->name,
                    'pieces' => $pack->pieces,
                ])->all(),
            ])->all(),
        ]);
    }

    /**
     * Put the eStore Item Code on the variant chosen (or on the variants
     * ticked, which then share it), with how Head Office sends it, then add
     * its earlier deliveries to stock. A shared code's earlier deliveries
     * wait to be split by variant.
     */
    public function store(LinkItemRequest $request, DeliveredStock $deliveredStock): RedirectResponse
    {
        $variants = $request->variants();
        $variant = $variants->firstOrFail();
        $code = $request->itemCode();
        $shared = $variants->count() > 1;

        $piecesAdded = DB::transaction(function () use ($request, $variants, $variant, $code, $shared, $deliveredStock): int {
            $packId = match ($request->input('sent_by')) {
                'pack' => (int) $request->input('pack_id'),
                'new_pack' => $variant->product->packs()->create([
                    'name' => $request->newPackName(),
                    'pieces' => (int) $request->input('new_pack_pieces'),
                    'sold_to_students' => false,
                    'price_centavos' => null,
                    'position' => (int) $variant->product->packs()->max('position') + 1,
                ])->id,
                default => null,
            };

            ProductVariant::query()->whereKey($variants->modelKeys())->update(['estore_item_code' => $code, 'estore_pack_id' => $packId]);

            return $shared ? 0 : $deliveredStock->addWaitingFor($variant->refresh(), $request->user());
        });

        if ($shared) {
            $waiting = collect($this->waitingToSplit())->firstWhere('item_code', $code);
            $labels = $variants->map(fn (ProductVariant $chosen): string => $chosen->label())->implode(', ');

            Inertia::flash('toast', [
                'type' => 'success',
                'message' => "{$code} is now linked to {$variant->product->name} ({$labels}). When it arrives, enter how many of each you received."
                    .($waiting !== null ? ' What already arrived is under "Received, split it into stock" above: enter how many of each it was.' : ''),
            ]);

            return back();
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => "{$code} is now linked to {$variant->displayName()}."
                .($piecesAdded > 0
                    ? ' '.number_format($piecesAdded).($piecesAdded === 1 ? ' piece was' : ' pieces were').' added to stock.'
                    : ' Its deliveries will be added to stock.'),
        ]);

        return back();
    }
}
