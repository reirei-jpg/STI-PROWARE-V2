<?php

namespace App\Actions\Preorders;

use App\Enums\PreorderStatus;
use App\Models\Preorder;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Validation\ValidationException;

/**
 * A student cancels their own preorder, from the website or the phone app,
 * while preorders for the product are still open.
 *
 * @phpstan-type PreorderRow array{id: int, product_id: int, product_name: string, photo_url: string|null, variant_label: string|null, quantity: int, status: string, status_label: string, preorders_close_on: string|null, can_cancel: bool, created_at: string|null}
 */
class CancelPreorderByStudent
{
    /**
     * "Your preorder for STI Hoodie was cancelled." (website and phone app).
     */
    public static function message(Preorder $preorder): string
    {
        return "Your preorder for {$preorder->product->name} was cancelled.";
    }

    /**
     * Why the student cannot cancel the preorder now; null when they can.
     */
    public static function refusal(Preorder $preorder): ?string
    {
        if ($preorder->status === PreorderStatus::Active && $preorder->product->acceptsPreorders()) {
            return null;
        }

        return "Preorders for {$preorder->product->name} are closed, so this preorder can no longer be cancelled here. Please ask the PROWARE office.";
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

        $preorder->update(['status' => PreorderStatus::Cancelled, 'cancelled_at' => now()]);
    }

    /**
     * A page of the student's My Preorders (website and phone app): active
     * ones first, newest first, 20 at a time.
     *
     * @return LengthAwarePaginator<int, PreorderRow>
     */
    public static function studentPage(User $student): LengthAwarePaginator
    {
        return $student->preorders()
            ->with(['product.mainPhoto', 'variant'])
            ->orderByRaw("case when status = 'active' then 0 else 1 end")
            ->latest('id')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (Preorder $preorder): array => self::row($preorder));
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
            'product_id' => $preorder->product_id,
            'product_name' => $preorder->product->name,
            'photo_url' => $preorder->product->mainPhoto?->url(),
            'variant_label' => $preorder->variant->choices === [] ? null : $preorder->variant->label(),
            'quantity' => $preorder->quantity,
            'status' => $preorder->status->value,
            'status_label' => $preorder->status->label(),
            'preorders_close_on' => $preorder->product->preorders_close_on?->toDateString(),
            'can_cancel' => self::refusal($preorder) === null,
            'created_at' => $preorder->created_at?->toIso8601String(),
        ];
    }
}
