<?php

namespace App\Actions\Preorders;

use App\Actions\Orders\HandleOrderBySpecialist;
use App\Enums\LowerPriceReason;
use App\Enums\OrderStatus;
use App\Enums\PreorderStatus;
use App\Models\Order;
use App\Models\Preorder;
use App\Models\PreorderSlip;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\Shop\ShopPrice;
use App\Services\Stock\Units;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The Specialist releases a paid preorder's pieces that arrived and were
 * set aside, after scanning its preorder slip (website and phone). They go
 * out as an order of their own at the price that was paid (early-bird
 * pieces at the early-bird price), released at once, so the sale, the
 * stock and its cost are recorded like any order. Pieces still on their way
 * stay waiting on the same slip.
 */
class ReleasePaidPreorder
{
    public function __construct(private HandleOrderBySpecialist $handleOrder) {}

    /**
     * Why the slip cannot be released now; null when it can.
     */
    public static function refusal(PreorderSlip $slip): ?string
    {
        if (! $slip->isPaid()) {
            return "Preorder slip {$slip->number} is not paid yet, so nothing can be released. Mark it as paid once the buyer has paid at the cashier.";
        }

        if ($slip->preorders()->where('status', PreorderStatus::Held)->exists()) {
            return null;
        }

        $waiting = (int) $slip->preorders()->where('status', PreorderStatus::Active)->sum('quantity');

        if ($waiting > 0 && $slip->preorders()->where('status', PreorderStatus::Ordered)->exists()) {
            return 'The other '.Units::count($waiting, 'Piece')." of preorder {$slip->number} ".($waiting === 1 ? 'has' : 'have').' not arrived yet. The buyer is told when '.($waiting === 1 ? 'it arrives.' : 'they arrive.');
        }

        return $waiting > 0
            ? "Nothing of preorder {$slip->number} has arrived yet. The buyer is told when it arrives."
            : "Preorder {$slip->number} has already been released in full.";
    }

    /**
     * @throws ValidationException when it cannot be released now
     */
    public function handle(PreorderSlip $slip, User $specialist): string
    {
        $order = DB::transaction(function () use ($slip): Order {
            $locked = PreorderSlip::query()->with('student')->lockForUpdate()->findOrFail($slip->id);
            $refusal = self::refusal($locked);

            if ($refusal !== null) {
                throw ValidationException::withMessages(['slip' => $refusal]);
            }

            $held = $locked->preorders()->where('status', PreorderStatus::Held)->lockForUpdate()->get();
            $student = $locked->student;
            $order = $student->orders()->create([
                'student_section' => $student->section,
                'status' => OrderStatus::Placed,
                'total_centavos' => 0,
            ]);
            $order->forceFill(['number' => Order::numberFor($order->id)])->save();
            $total = 0;

            foreach ($held as $preorder) {
                $total += $this->addLines($order, $preorder);
            }

            $order->forceFill(['total_centavos' => $total])->save();

            return $order;
        });

        // Released at once, like any order: the sale, the stock and its cost.
        $this->handleOrder->release($order, $specialist);
        $order->refresh();
        $pieces = (int) $order->items()->sum('quantity');

        return "Preorder {$slip->number} has been released to {$order->student->name} as order {$order->number}: ".Units::count($pieces, 'Piece').', already paid ₱'.number_format($order->total_centavos / 100, 2).'.';
    }

    /**
     * The preorder's pieces on the order, at the price that was paid; they
     * move from set aside for the preorder to held for the order.
     *
     * @return int the lines' total
     */
    private function addLines(Order $order, Preorder $preorder): int
    {
        $variant = ProductVariant::query()->with('product')->lockForUpdate()->findOrFail($preorder->product_variant_id);
        $product = $variant->product;
        $price = $preorder->price_centavos ?? (int) ShopPrice::perUnit($variant, null);
        $earlyBird = $product->early_bird_price_centavos === null ? 0 : min($preorder->early_bird_pieces, $preorder->quantity);
        $total = 0;

        $lines = array_filter([
            [$earlyBird, (int) $product->early_bird_price_centavos, LowerPriceReason::EarlyBird],
            [$preorder->quantity - $earlyBird, $price, null],
        ], fn (array $line): bool => $line[0] > 0);

        foreach ($lines as [$pieces, $unitPrice, $reason]) {
            $item = $order->items()->create([
                'product_id' => $product->id,
                'product_variant_id' => $variant->id,
                'product_name' => $product->name,
                'variant_label' => $variant->choices === [] ? null : $variant->label(),
                'unit_name' => 'Piece',
                'pieces_per_unit' => 1,
                'quantity' => $pieces,
                'unit_price_centavos' => $unitPrice,
                'normal_unit_price_centavos' => $price,
                'lower_price_reason' => $unitPrice < $price ? $reason : null,
                'line_total_centavos' => $unitPrice * $pieces,
            ]);
            $total += $item->line_total_centavos;
        }

        $variant->forceFill([
            'held_pieces' => $variant->held_pieces + $preorder->quantity,
            'preorder_held_pieces' => max(0, $variant->preorder_held_pieces - $preorder->quantity),
        ])->save();
        $preorder->forceFill(['status' => PreorderStatus::Ordered, 'order_id' => $order->id])->save();

        return $total;
    }
}
