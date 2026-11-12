<?php

namespace App\Actions\Preorders;

use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\Preorder;
use App\Models\User;
use App\Services\Preorders\EarlyBird;
use App\Services\Preorders\PreorderHolds;
use App\Services\Shop\ShopPrice;
use App\Services\Stock\LowStockAlerts;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Pagination\LengthAwarePaginator as Paginator;
use Illuminate\Validation\ValidationException;

/**
 * A student cancels their own preorder, from the website or the phone app,
 * while preorders for the product are still open, or while a sold-out size
 * is still waiting for a restock.
 *
 * @phpstan-type PreorderRow array{id: int, batch: string, product_id: int, product_variant_id: int, product_name: string, photo_url: string|null, variant_label: string|null, quantity: int, preordered_price_centavos: int|null, status: string, status_label: string, preorders_close_on: string|null, expected_arrival: string|null, early_bird_pieces: int, early_bird_price_centavos: int|null, waiting_for_restock: bool, can_cancel: bool, can_edit: bool, edited_at: string|null, created_at: string|null, arrived_at: string|null, not_restocked_at: string|null, not_restocked_reason: string|null, held_until: string|null, piece_price_centavos: int|null, order_id: int|null, order_number: string|null, order_status: string|null, hold_ended_at: string|null}
 */
class CancelPreorderByStudent
{
    /**
     * "Your preorder for STI Hoodie has been cancelled." (website and phone app).
     */
    public static function message(Preorder $preorder): string
    {
        return "Your preorder for {$preorder->product->name} has been cancelled. Nothing needs to be paid.";
    }

    /**
     * Why the student cannot cancel the preorder now; null when they can.
     */
    public static function refusal(Preorder $preorder): ?string
    {
        if ($preorder->status === PreorderStatus::Active && ($preorder->product->acceptsPreorders() || LowStockAlerts::isSold($preorder->product))) {
            return null;
        }

        // Pieces held for the student can be given up, for the next student.
        if ($preorder->status === PreorderStatus::Held) {
            return null;
        }

        return match ($preorder->status) {
            PreorderStatus::Cancelled => "Your preorder for {$preorder->product->name} is already cancelled.",
            PreorderStatus::Ordered => "You already ordered this preorder for {$preorder->product->name}. To cancel it, cancel the order.",
            PreorderStatus::HoldEnded => "The hold on your preorder for {$preorder->product->name} already ended, so there is nothing to cancel.",
            PreorderStatus::NotRestocked => "{$preorder->product->name} will not be restocked, so this preorder is already closed.",
            default => "Preorders for {$preorder->product->name} are closed, so this preorder can no longer be cancelled here. Ask the PROWARE office.",
        };
    }

    /**
     * @throws ValidationException when it can no longer be cancelled
     */
    public function handle(Preorder $preorder): void
    {
        $refusal = self::refusal($preorder);

        if ($refusal !== null) {
            throw ValidationException::withMessages(['preorder' => $refusal]);
        }

        if ($preorder->status === PreorderStatus::Held) {
            app(PreorderHolds::class)->end($preorder, PreorderStatus::Cancelled);
            $preorder->refresh();

            return;
        }

        $preorder->update(['status' => PreorderStatus::Cancelled, 'cancelled_at' => now()]);

        // Its early-bird pieces go to the next preorders in line.
        EarlyBird::reallocate($preorder->product);
    }

    /**
     * A page of the student's My Preorders (website and phone app), 20
     * batches at a time (the preorders placed with one press of Preorder):
     * batches with held or waiting preorders first, then arrived, then
     * closed or cancelled, newest first. The rows of each batch come one
     * after another, in the order they were placed.
     *
     * @return LengthAwarePaginator<int, PreorderRow>
     */
    public static function studentPage(User $student): LengthAwarePaginator
    {
        $rank = "case when status = 'held' then 0 when status = 'active' then 1 when status in ('arrived', 'ordered') then 2 else 3 end";

        $batches = $student->preorders()
            ->select('batch')
            ->groupBy('batch')
            ->orderByRaw("min({$rank})")
            ->orderByRaw('max(id) desc')
            ->paginate(20)
            ->withQueryString();

        $keys = collect($batches->items())->map(fn (Preorder $batch): string => $batch->batch)->all();
        $preorders = $student->preorders()
            ->with(['product.mainPhoto', 'variant.product', 'order'])
            ->whereIn('batch', $keys)
            ->orderBy('id')
            ->get()
            ->groupBy('batch');

        $rows = collect($keys)
            ->flatMap(fn (string $key) => $preorders->get($key, collect())->map(fn (Preorder $preorder): array => self::row($preorder)))
            ->values();

        return new Paginator($rows, $batches->total(), $batches->perPage(), $batches->currentPage(), [
            'path' => $batches->path(),
            'query' => request()->query(),
        ]);
    }

    /**
     * The row on the student's My Preorders (website and phone app).
     *
     * @return PreorderRow
     */
    public static function row(Preorder $preorder): array
    {
        return [
            'id' => $preorder->id,
            // Preorders placed with one press of Preorder: one card on My Preorders.
            'batch' => $preorder->batch,
            'product_id' => $preorder->product_id,
            'product_variant_id' => $preorder->product_variant_id,
            'product_name' => $preorder->product->name,
            'photo_url' => $preorder->product->mainPhoto?->url(),
            'variant_label' => $preorder->variant->choices === [] ? null : $preorder->variant->label(),
            'quantity' => $preorder->quantity,
            // One piece's price on the day it was preordered; the price paid is the one on the day it is ordered.
            'preordered_price_centavos' => $preorder->price_centavos,
            'status' => $preorder->status->value,
            'status_label' => $preorder->status->label(),
            'preorders_close_on' => $preorder->product->preorders_close_on?->toDateString(),
            // When a Coming Soon product it waits for is expected.
            'expected_arrival' => $preorder->status === PreorderStatus::Active && $preorder->product->status === ProductStatus::Preorder
                ? $preorder->product->expectedArrivalText()
                : null,
            'early_bird_pieces' => $preorder->early_bird_pieces,
            'early_bird_price_centavos' => $preorder->early_bird_pieces > 0 ? $preorder->product->early_bird_price_centavos : null,
            // A sold-out size of a product for sale, not a Coming Soon product.
            'waiting_for_restock' => $preorder->status === PreorderStatus::Active && LowStockAlerts::isSold($preorder->product),
            'can_cancel' => self::refusal($preorder) === null,
            'can_edit' => EditPreorderByStudent::refusal($preorder) === null,
            'edited_at' => $preorder->edited_at?->toIso8601String(),
            'created_at' => $preorder->created_at?->toIso8601String(),
            'arrived_at' => $preorder->arrived_at?->toIso8601String(),
            'not_restocked_at' => $preorder->not_restocked_at?->toIso8601String(),
            'not_restocked_reason' => $preorder->not_restocked_reason,
            // Pieces held for the student: until when, and today's price per piece.
            'held_until' => $preorder->status === PreorderStatus::Held ? $preorder->held_until?->toIso8601String() : null,
            'piece_price_centavos' => $preorder->status === PreorderStatus::Held ? ShopPrice::perUnit($preorder->variant->setRelation('product', $preorder->product), null) : null,
            'order_id' => $preorder->order_id,
            'order_number' => $preorder->order?->number,
            'order_status' => $preorder->order?->status->value,
            'hold_ended_at' => $preorder->hold_ended_at?->toIso8601String(),
        ];
    }
}
