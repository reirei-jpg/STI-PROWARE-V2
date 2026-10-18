<?php

namespace App\Actions\Preorders;

use App\Enums\PreorderStatus;
use App\Models\Preorder;
use App\Models\ProductVariant;
use App\Models\User;
use App\Notifications\PreorderNotRestocked;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

/**
 * The Specialist says a sold-out size will not be restocked: every preorder
 * waiting for it is closed, each student is notified (with her reason, if
 * she gave one), and students can no longer preorder it. She can allow
 * preorders again; stock coming in clears it too (RestockedPreorders).
 */
class MarkNotRestocked
{
    /**
     * @return int students notified
     */
    public function handle(ProductVariant $variant, ?string $reason): int
    {
        return DB::transaction(function () use ($variant, $reason): int {
            $variant = ProductVariant::query()->with('product')->lockForUpdate()->findOrFail($variant->id);
            $variant->forceFill(['not_restocked_at' => now()])->save();

            $preorders = Preorder::query()
                ->where('product_variant_id', $variant->id)
                ->where('status', PreorderStatus::Active);
            $students = User::query()->whereIn('id', (clone $preorders)->select('user_id'))->get();

            $preorders->update([
                'status' => PreorderStatus::NotRestocked,
                'not_restocked_at' => now(),
                'not_restocked_reason' => $reason,
            ]);

            DB::afterCommit(fn () => Notification::send($students, new PreorderNotRestocked($variant, $reason)));

            return $students->count();
        });
    }

    /**
     * Students can preorder the size again while it is sold out.
     */
    public function undo(ProductVariant $variant): void
    {
        $variant->forceFill(['not_restocked_at' => null])->save();
    }

    /**
     * "BSIT Polo (XS) will not be restocked. 3 students were notified and their preorders were closed."
     */
    public static function message(ProductVariant $variant, int $students): string
    {
        return "{$variant->displayName()} has been marked as not restocked. ".match ($students) {
            0 => 'No student was waiting for it.',
            1 => '1 student has been notified and their preorder has been closed.',
            default => "{$students} students have been notified and their preorders have been closed.",
        };
    }
}
