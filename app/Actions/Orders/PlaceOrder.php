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
use App\Services\Shop\UniformSetPrice;
use App\Services\Stock\LowStockAlerts;
use App\Services\Stock\Units;
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
 * issuance slip. A uniform set's two pieces are ordered at their own
 * prices and keep the set's name.
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
            $cart = $student->cartItems()->where('selected', true)->with(['variant.product', 'pack.product', 'uniformSet'])->orderBy('id')->get();

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

            // The locked variants (fresh stock) for the set lines' prices too.
            $cart->each(fn (CartItem $line) => $line->setRelation('variant', $variants->get($line->product_variant_id)));
            $setPrices = UniformSetPrice::forCart($cart);

            $this->ensureCanBeOrdered($cart->all(), $variants->all(), $setPrices);

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
                $unitPrice = (int) ($line->set_key === null ? ShopPrice::perUnit($variant, $line->pack) : $setPrices[$line->id]);
                $piecesPerUnit = $line->pack->pieces ?? 1;

                $item = $order->items()->create([
                    'product_id' => $variant->product_id,
                    'product_variant_id' => $variant->id,
                    'product_name' => $variant->product->name,
                    'variant_label' => $variant->choices === [] ? null : $variant->label(),
                    'set_name' => $line->set_key === null || $line->uniformSet === null || $line->set_for === null
                        ? null
                        : "{$line->uniformSet->displayName()} ({$line->set_for->label()})",
                    'set_key' => $line->set_key,
                    'unit_name' => $line->pack->name ?? 'Piece',
                    'pieces_per_unit' => $piecesPerUnit,
                    'quantity' => $line->quantity,
                    'unit_price_centavos' => $unitPrice,
                    // The regular price too, so a sale price shows as a discount.
                    'normal_unit_price_centavos' => ShopPrice::normalPerUnit($variant, $line->pack) ?? $unitPrice,
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
     * "Order PW-0001 has been placed. Show its issuance slip at the PROWARE office by
     * Oct 7, 2026 to pay and collect your items." (website and phone app).
     */
    public static function message(Order $order): string
    {
        return "Order {$order->number} has been placed. Show its issuance slip at the PROWARE office by {$order->pick_up_by->format('M j, Y')} to pay and collect your items.";
    }

    /**
     * Every item must still be for sale at a price (a set as a whole, with
     * both its pieces ticked), and the pieces asked for each size or color
     * must be free to sell (not held for other orders).
     *
     * @param  array<int, CartItem>  $cart
     * @param  array<int, ProductVariant>  $variants  locked, by id
     * @param  array<int, int|null>  $setPrices  today's price per piece of set lines, by line id
     */
    private function ensureCanBeOrdered(array $cart, array $variants, array $setPrices): void
    {
        $piecesWanted = [];
        $linesPerSet = collect($cart)->whereNotNull('set_key')->countBy('set_key');

        foreach ($cart as $line) {
            $variant = $variants[$line->product_variant_id];
            $name = $variant->displayName();

            if ($line->set_key !== null && (($setPrices[$line->id] ?? null) === null || $linesPerSet->get($line->set_key) !== 2)) {
                throw ValidationException::withMessages(['cart' => ($line->uniformSet?->displayName() ?? 'A uniform set').' is no longer for sale as it is. Remove it from your cart.']);
            }

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
                    : 'Only '.Units::count($free, 'Piece')." of {$variant->displayName()} ".($free === 1 ? 'is' : 'are').' left. Change your cart.']);
            }
        }
    }
}
