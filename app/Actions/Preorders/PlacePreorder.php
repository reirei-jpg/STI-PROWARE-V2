<?php

namespace App\Actions\Preorders;

use App\Enums\PreorderStatus;
use App\Enums\UserRole;
use App\Models\Preorder;
use App\Models\Product;
use App\Models\User;
use App\Notifications\PreorderPlaced;
use App\Services\Preorders\EarlyBird;
use App\Services\Stock\LowStockAlerts;
use App\Services\Stock\Units;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

/**
 * A student preorders sizes or colors (website or phone app): of a Preorder
 * product, or sold-out sizes of a product for sale. Preordering the same
 * size again changes how many, so a student has one active preorder per
 * size or color. A new preorder of a sold-out size is sent to the
 * Specialist, so she can order more.
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
                $saved[] = $student->preorders()->updateOrCreate(
                    [
                        'product_variant_id' => $item['product_variant_id'],
                        'status' => PreorderStatus::Active,
                    ],
                    [
                        'product_id' => $product->id,
                        'quantity' => $item['quantity'],
                    ],
                );
            }

            EarlyBird::reallocate($product);

            return array_map(fn (Preorder $preorder): Preorder => $preorder->refresh(), $saved);
        });

        if (LowStockAlerts::isSold($product)) {
            $specialists = User::query()->where('role', UserRole::Specialist)->get();

            foreach ($preorders as $preorder) {
                if ($preorder->wasRecentlyCreated) {
                    Notification::send($specialists, new PreorderPlaced($preorder->setRelations(['product' => $product, 'student' => $student])));
                }
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
     * One size: "Your preorder of 2 × BSIT Polo (M) has been placed. …"
     * Several: "Your preorder of BSIT Polo has been placed: 2 × S, 3 × M. …"
     *
     * @param  list<Preorder>  $preorders
     */
    public static function messageForMany(array $preorders, Product $product): string
    {
        $after = (LowStockAlerts::isSold($product) ? ' You will be notified when it is back in stock.' : '')
            .self::earlyBirdNote($preorders, $product)
            .' It is listed in My Preorders.';

        if (count($preorders) === 1) {
            $preorder = $preorders[0];
            $variant = $preorder->variant;

            return "Your preorder of {$preorder->quantity} × {$product->name}".($variant->choices === [] ? '' : " ({$variant->label()})").' has been placed.'.$after;
        }

        $sizes = implode(', ', array_map(
            fn (Preorder $preorder): string => "{$preorder->quantity} × {$preorder->variant->label()}",
            $preorders,
        ));

        return "Your preorder of {$product->name} has been placed: {$sizes}.".$after;
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
