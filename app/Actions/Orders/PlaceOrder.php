<?php

namespace App\Actions\Orders;

use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\ProductVariant;
use App\Models\User;
use App\Notifications\OrderPlaced;
use App\Services\Shop\OrderRules;
use App\Services\Shop\ShopPrice;
use App\Services\Stock\LowStockAlerts;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

/**
 * Turns the ticked items in a student's cart into an order: checks the
 * student may order (OrderRules), that each item can still be bought and
 * enough is free to sell, keeps each line with today's price, HOLDS the
 * pieces for the order (they stay on the shelf until the Specialist
 * releases them), removes them from the cart (unticked items stay) and
 * tells the Specialist. The student's course/section is kept for the
 * issuance slip.
 */
class PlaceOrder
{
    public function __construct(private LowStockAlerts $lowStockAlerts) {}

    public function handle(User $student, ?string $section = null): Order
    {
        $refusal = OrderRules::refusal($student);

        if ($refusal !== null) {
            throw ValidationException::withMessages(['cart' => $refusal]);
        }

        $section = $section === null || trim($section) === '' ? null : trim($section);

        if ($section !== null && $section !== $student->section) {
            $student->forceFill(['section' => $section])->save();
        }

        $order = DB::transaction(function () use ($student, $section): Order {
            $cart = $student->cartItems()->where('selected', true)->with(['variant.product', 'pack.product'])->orderBy('id')->get();

            if ($cart->isEmpty()) {
                throw ValidationException::withMessages(['cart' => $student->cartItems()->exists()
                    ? 'Tick the items you want to order.'
                    : 'Your cart is empty.']);
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
                'student_section' => $section ?? $student->section,
                'status' => OrderStatus::Placed,
                'total_centavos' => 0,
                'pick_up_by' => OrderRules::holdUntil(),
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

                // Held, not sold: the pieces stay on the shelf until released.
                $variant->forceFill(['held_pieces' => $variant->held_pieces + $item->pieces()])->save();

                $total += $item->line_total_centavos;
            }

            $order->forceFill(['total_centavos' => $total])->save();
            // Only what was ordered leaves the cart; unticked items stay for later.
            $student->cartItems()->whereKey($cart->modelKeys())->delete();

            foreach ($variants as $variant) {
                $this->lowStockAlerts->check($variant);
            }

            return $order;
        });

        Notification::send(User::query()->where('role', UserRole::Specialist)->get(), new OrderPlaced($order));

        return $order;
    }

    /**
     * "Order PW-0001 placed. Show its issuance slip at the PROWARE office by
     * Oct 7, 2026, to pay and get your items." (website and phone app).
     */
    public static function message(Order $order): string
    {
        return "Order {$order->number} placed. Show its issuance slip at the PROWARE office by {$order->pick_up_by->format('M j, Y')}, to pay and get your items.";
    }

    /**
     * Every item must still be for sale at a price, and the pieces asked for
     * each size or color must be free to sell (not held for other orders).
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
            $free = $variant->freeToSell();

            if ($pieces > $free) {
                throw ValidationException::withMessages(['cart' => $free === 0
                    ? "{$variant->displayName()} is out of stock. Remove it from your cart."
                    : "Only {$free} pcs of {$variant->displayName()} are left. Change your cart."]);
            }
        }
    }
}
