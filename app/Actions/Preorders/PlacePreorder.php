<?php

namespace App\Actions\Preorders;

use App\Enums\PreorderStatus;
use App\Enums\UserRole;
use App\Models\Preorder;
use App\Models\Product;
use App\Models\User;
use App\Notifications\PreorderPlaced;
use App\Notifications\PreorderReceived;
use App\Services\Preorders\EarlyBird;
use App\Services\Shop\ShopPrice;
use App\Services\Stock\LowStockAlerts;
use App\Services\Stock\Units;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

/**
 * A student preorders sizes or colors (website or phone app): of a Preorder
 * product, or sold-out sizes of a product for sale. Preordering the same
 * size again is a new preorder at the end of the line, so pieces added later
 * never go ahead of buyers who were already waiting. The student is told it
 * was received; a preorder of a sold-out size is sent to the Specialist, so
 * she can order more.
 */
class PlacePreorder
{
    public function handle(User $student, Product $product, int $variantId, int $quantity): Preorder
    {
        return $this->handleMany($student, $product, [['product_variant_id' => $variantId, 'quantity' => $quantity]])[0];
    }

    /**
     * @param  list<array{product_variant_id: int, quantity: int}>  $items
     * @return list<Preorder> in the order given
     */
    public function handleMany(User $student, Product $product, array $items): array
    {
        $preorders = DB::transaction(function () use ($student, $product, $items): array {
            $saved = [];

            foreach ($items as $item) {
                $variant = $product->variants()->findOrFail($item['product_variant_id'])->setRelation('product', $product);

                $saved[] = $student->preorders()->create([
                    'product_variant_id' => $item['product_variant_id'],
                    'status' => PreorderStatus::Active,
                    'product_id' => $product->id,
                    'quantity' => $item['quantity'],
                    // Shown as "Preordered at ₱500 each"; the price paid is the one on the day it is ordered.
                    'price_centavos' => ShopPrice::perUnit($variant, null),
                ]);
            }

            EarlyBird::reallocate($product);

            return array_map(fn (Preorder $preorder): Preorder => $preorder->refresh(), $saved);
        });

        $soldOut = LowStockAlerts::isSold($product);
        $student->notify(new PreorderReceived($product, $preorders, $soldOut));

        if ($soldOut) {
            $specialists = User::query()->where('role', UserRole::Specialist)->get();

            foreach ($preorders as $preorder) {
                Notification::send($specialists, new PreorderPlaced($preorder->setRelations(['product' => $product, 'student' => $student])));
            }
        }

        return $preorders;
    }

    /**
     * "Your preorder of 2 × 42nd Anniversary Shirt (S/M) has been placed. It is listed in My Preorders."
     * For a sold-out size it also says the student will be notified when it is back in stock.
     */
    public static function message(Preorder $preorder, Product $product): string
    {
        return self::messageForMany([$preorder], $product);
    }

    /**
     * One size: "Your preorder of 2 × BSIT Polo (M) has been placed. …", or
     * when the buyer was already waiting for that size: "Your preorder of 2 ×
     * BSIT Polo (M) has been placed behind those already in line, so you now
     * have 4 pcs preordered. …"
     * Several: "Your preorder of BSIT Polo has been placed: 2 × S, 3 × M. …"
     * ("… Pieces added to an earlier preorder wait behind those already in
     * line. …" when one was added to).
     *
     * @param  list<Preorder>  $preorders
     */
    public static function messageForMany(array $preorders, Product $product): string
    {
        $after = (LowStockAlerts::isSold($product) ? ' You will be notified when it is back in stock.' : '')
            .self::earlyBirdNote($preorders, $product)
            .' It is listed in My Preorders.';
        $waiting = fn (Preorder $preorder): int => (int) Preorder::query()
            ->where('user_id', $preorder->user_id)
            ->where('product_variant_id', $preorder->product_variant_id)
            ->where('status', PreorderStatus::Active)
            ->sum('quantity');
        $addedTo = array_filter($preorders, fn (Preorder $preorder): bool => $waiting($preorder) > $preorder->quantity) !== [];

        if (count($preorders) === 1) {
            $preorder = $preorders[0];
            $variant = $preorder->variant;
            $name = $product->name.($variant->choices === [] ? '' : " ({$variant->label()})");

            return ($addedTo
                ? "Your preorder of {$preorder->quantity} × {$name} has been placed behind those already in line, so you now have ".Units::count($waiting($preorder), 'Piece').' preordered.'
                : "Your preorder of {$preorder->quantity} × {$name} has been placed.").$after;
        }

        $sizes = implode(', ', array_map(
            fn (Preorder $preorder): string => "{$preorder->quantity} × {$preorder->variant->label()}",
            $preorders,
        ));

        return "Your preorder of {$product->name} has been placed: {$sizes}."
            .($addedTo ? ' Pieces added to an earlier preorder wait behind those already in line.' : '')
            .$after;
    }

    /**
     * " 2 pcs get the early-bird price of ₱300.00." or, when they are all
     * taken, " The early-bird pieces are all taken."
     *
     * @param  list<Preorder>  $preorders
     */
    private static function earlyBirdNote(array $preorders, Product $product): string
    {
        if ($product->early_bird_price_centavos === null || LowStockAlerts::isSold($product)) {
            return '';
        }

        $pieces = array_sum(array_map(fn (Preorder $preorder): int => $preorder->early_bird_pieces, $preorders));

        return $pieces === 0
            ? ' The early-bird pieces are all taken.'
            : ' '.Units::count($pieces, 'Piece').' '.($pieces === 1 ? 'gets' : 'get').' the early-bird price of ₱'.number_format($product->early_bird_price_centavos / 100, 2).'.';
    }
}
