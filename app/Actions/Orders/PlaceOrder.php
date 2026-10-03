<?php

namespace App\Actions\Orders;

use App\Enums\OrderStatus;
use App\Enums\StockMovementType;
use App\Enums\UserRole;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\ProductVariant;
use App\Models\User;
use App\Notifications\OrderPlaced;
use App\Services\Shop\ShopPrice;
use App\Services\Stock\LowStockAlerts;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

/**
 * Turns a student's cart into an order: checks every item can still be
 * bought and is in stock, keeps each line with today's price, takes the
 * pieces out of stock (held until pickup, recorded as "Sale · PW-0001"),
 * empties the cart and tells the Specialist.
 */
class PlaceOrder
{
    public function __construct(private LowStockAlerts $lowStockAlerts) {}

    public function handle(User $student): Order
    {
        $order = DB::transaction(function () use ($student): Order {
            $cart = $student->cartItems()->with(['variant.product', 'pack.product'])->orderBy('id')->get();

            if ($cart->isEmpty()) {
                throw ValidationException::withMessages(['cart' => 'Your cart is empty.']);
            }

            // Lock the variants so two students cannot take the last pieces.
            $variants = ProductVariant::query()
                ->with('product')
                ->whereKey($cart->pluck('product_variant_id')->unique()->all())
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $this->ensureCanBeOrdered($cart->all(), $variants->all());

            $order = $student->orders()->create([
                'status' => OrderStatus::Placed,
                'total_centavos' => 0,
                'pick_up_by' => now()->addDays(Order::PICK_UP_DAYS)->endOfDay(),
            ]);
            $order->forceFill(['number' => Order::numberFor($order->id)])->save();

            $total = 0;

            foreach ($cart as $line) {
                /** @var ProductVariant $variant */
                $variant = $variants->get($line->product_variant_id);
                $unitPrice = (int) ShopPrice::perUnit($variant, $line->pack);
                $piecesPerUnit = $line->pack->pieces ?? 1;

                $item = $order->items()->create([
                    'product_id' => $variant->product_id,
                    'product_variant_id' => $variant->id,
                    'product_name' => $variant->product->name,
                    'variant_label' => $variant->choices === [] ? null : $variant->label(),
                    'unit_name' => $line->pack->name ?? 'Piece',
                    'pieces_per_unit' => $piecesPerUnit,
                    'quantity' => $line->quantity,
                    'unit_price_centavos' => $unitPrice,
                    'line_total_centavos' => $unitPrice * $line->quantity,
                ]);

                $balance = $variant->stock_on_hand - $item->pieces();
                $variant->forceFill(['stock_on_hand' => $balance])->save();

                $variant->stockMovements()->create([
                    'type' => StockMovementType::Sale,
                    'quantity' => -$item->pieces(),
                    'balance_after' => $balance,
                    'order_item_id' => $item->id,
                    'units_received' => $item->quantity,
                    'unit_name' => $item->unit_name,
                    'pieces_per_unit' => $piecesPerUnit,
                    'recorded_by' => $student->id,
                ]);

                $total += $item->line_total_centavos;
            }

            $order->forceFill(['total_centavos' => $total])->save();
            $student->cartItems()->delete();

            foreach ($variants as $variant) {
                $this->lowStockAlerts->check($variant);
            }

            return $order;
        });

        Notification::send(User::query()->where('role', UserRole::Specialist)->get(), new OrderPlaced($order));

        return $order;
    }

    /**
     * Every item must still be for sale at a price, and the pieces asked for
     * each size or color must be in stock.
     *
     * @param  array<int, CartItem>  $cart
     * @param  array<int, ProductVariant>  $variants  locked, by id
     */
    private function ensureCanBeOrdered(array $cart, array $variants): void
    {
        $piecesWanted = [];

        foreach ($cart as $line) {
            $variant = $variants[$line->product_variant_id];
            $name = $variant->displayName();

            if (! ShopPrice::canBuy($variant->product) || ShopPrice::perUnit($variant, $line->pack) === null) {
                throw ValidationException::withMessages(['cart' => "{$name} is no longer for sale. Remove it from your cart."]);
            }

            $piecesWanted[$variant->id] = ($piecesWanted[$variant->id] ?? 0) + $line->pieces();
        }

        foreach ($piecesWanted as $variantId => $pieces) {
            $variant = $variants[$variantId];

            if ($pieces > $variant->stock_on_hand) {
                throw ValidationException::withMessages(['cart' => $variant->stock_on_hand === 0
                    ? "{$variant->displayName()} is out of stock. Remove it from your cart."
                    : "Only {$variant->stock_on_hand} pcs of {$variant->displayName()} are left. Change your cart."]);
            }
        }
    }
}
