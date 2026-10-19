<?php

namespace App\Actions\Preorders;

use App\Enums\OrderStatus;
use App\Enums\PreorderStatus;
use App\Enums\UserRole;
use App\Models\Order;
use App\Models\Preorder;
use App\Models\ProductVariant;
use App\Models\User;
use App\Notifications\OrderPlaced;
use App\Services\Shop\OrderRules;
use App\Services\Shop\ShopPrice;
use App\Services\Stock\LowStockAlerts;
use App\Services\Stock\RestockedPreorders;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

/**
 * Order Now on a held preorder (website and phone app): the student orders
 * some or all of the pieces held for them, as an order of its own like Place
 * Order (pieces held for the order, issuance slip, the Specialist is told).
 * Its early-bird pieces are charged the early-bird price (or today's price
 * if that is lower). Held pieces the student did not order go to the next
 * student waiting at once.
 */
class OrderHeldPreorder
{
    public function __construct(
        private LowStockAlerts $lowStockAlerts,
        private RestockedPreorders $restockedPreorders,
    ) {}

    public function handle(User $student, Preorder $preorder, int $quantity, ?string $section = null): Order
    {
        $refusal = OrderRules::refusal($student);

        if ($refusal !== null) {
            throw ValidationException::withMessages(['quantity' => $refusal]);
        }

        $section = $section === null || trim($section) === '' ? null : trim($section);

        if ($section !== null && $section !== $student->section) {
            $student->forceFill(['section' => $section])->save();
        }

        $order = DB::transaction(function () use ($student, $preorder, $quantity, $section): Order {
            $preorder = Preorder::query()->lockForUpdate()->findOrFail($preorder->id);
            $variant = ProductVariant::query()->with('product')->lockForUpdate()->findOrFail($preorder->product_variant_id);
            $refusal = self::refusal($preorder);

            if ($refusal !== null) {
                throw ValidationException::withMessages(['quantity' => $refusal]);
            }

            $normalPrice = ShopPrice::perUnit($variant, null);

            if ($normalPrice === null) {
                throw ValidationException::withMessages(['quantity' => "{$variant->displayName()} cannot be bought by the piece right now. Ask the PROWARE office."]);
            }

            $earlyBirdPrice = min($normalPrice, $variant->product->early_bird_price_centavos ?? $normalPrice);
            $earlyBirdPieces = $earlyBirdPrice < $normalPrice ? min($preorder->early_bird_pieces, $quantity) : 0;

            $order = $student->orders()->create([
                'student_section' => $section ?? $student->section,
                'status' => OrderStatus::Placed,
                'total_centavos' => 0,
                'pick_up_by' => OrderRules::holdUntil(),
            ]);
            $order->forceFill(['number' => Order::numberFor($order->id)])->save();

            $total = 0;
            $lines = array_filter([
                [$earlyBirdPieces, $earlyBirdPrice],
                [$quantity - $earlyBirdPieces, $normalPrice],
            ], fn (array $line): bool => $line[0] > 0);

            foreach ($lines as [$pieces, $unitPrice]) {
                $item = $order->items()->create([
                    'product_id' => $variant->product_id,
                    'product_variant_id' => $variant->id,
                    'product_name' => $variant->product->name,
                    'variant_label' => $variant->choices === [] ? null : $variant->label(),
                    'unit_name' => 'Piece',
                    'pieces_per_unit' => 1,
                    'quantity' => $pieces,
                    'unit_price_centavos' => $unitPrice,
                    'normal_unit_price_centavos' => ShopPrice::normalPerUnit($variant, null) ?? $unitPrice,
                    'line_total_centavos' => $unitPrice * $pieces,
                ]);

                $total += $item->line_total_centavos;
            }

            $order->forceFill(['total_centavos' => $total])->save();

            // The ordered pieces are now held for the order; the rest of the
            // student's hold is freed for the next student.
            $variant->forceFill([
                'held_pieces' => $variant->held_pieces + $quantity,
                'preorder_held_pieces' => max(0, $variant->preorder_held_pieces - $preorder->quantity),
            ])->save();
            $preorder->forceFill(['status' => PreorderStatus::Ordered, 'order_id' => $order->id])->save();

            $this->restockedPreorders->check($variant);
            $this->lowStockAlerts->check($variant);

            return $order;
        });

        Notification::send(User::query()->where('role', UserRole::Specialist)->get(), new OrderPlaced($order));

        return $order;
    }

    /**
     * Why the held pieces cannot be ordered now; null when they can.
     */
    public static function refusal(Preorder $preorder): ?string
    {
        if ($preorder->status === PreorderStatus::Held && $preorder->held_until !== null && $preorder->held_until->isFuture()) {
            return null;
        }

        return $preorder->status === PreorderStatus::Ordered
            ? 'These pieces have already been ordered. See My Orders.'
            : 'The pieces are no longer held for you. Check the store to buy them.';
    }
}
