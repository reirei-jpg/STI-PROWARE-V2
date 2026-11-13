<?php

namespace App\Services\Preorders;

use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\Preorder;
use App\Models\PreorderSlip;
use App\Models\Product;
use App\Notifications\PreorderNotPaid;
use App\Notifications\PreorderPayBy;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The payment dates of an item's preorders, set by the Specialist: a start
 * date (buyers can pay from then) and a close date (the last day to pay
 * and to preorder). Until they are set, buyers can pay whenever they like
 * and nothing is dropped; the item shows on the dashboard's "Preorders to
 * set up". Once set, buyers with unpaid preorders are told, and preorders
 * not paid by the close date are dropped (Not paid in time). For a
 * sold-out size waiting for restock the dates then clear, ready for the
 * next round.
 *
 * @phpstan-type SetUpRow array{product_id: int, product_name: string, coming_soon: bool, buyers: int, pieces: int, preorders_close_on: string|null, expected_arrival_from: string|null}
 */
final class PaymentDates
{
    /** Rows shown on the dashboard card; the count says how many in all. */
    public const SHOWN = 8;

    /**
     * Items with unpaid preorders waiting and no payment dates yet, the
     * most preordered first.
     *
     * @return array{count: int, items: list<SetUpRow>, today: string}
     */
    public static function toSetUp(): array
    {
        $unpaid = fn (Builder $preorders) => self::unpaid($preorders->where('status', PreorderStatus::Active));

        $products = Product::query()
            ->whereNull('preorder_pay_from')
            ->whereIn('status', [ProductStatus::Preorder, ProductStatus::Available, ProductStatus::OnSale])
            ->whereHas('preorders', $unpaid)
            ->with(['preorders' => fn ($preorders) => $preorders->where('status', PreorderStatus::Active)->whereNotIn('batch', PreorderSlip::query()->whereNotNull('paid_at')->select('batch'))])
            ->get()
            ->map(fn (Product $product): array => [
                'product_id' => $product->id,
                'product_name' => $product->name,
                'coming_soon' => $product->status === ProductStatus::Preorder,
                'buyers' => $product->preorders->unique('user_id')->count(),
                'pieces' => (int) $product->preorders->sum('quantity'),
                'preorders_close_on' => $product->preorders_close_on?->toDateString(),
                'expected_arrival_from' => $product->expected_arrival_from?->toDateString(),
            ])
            ->sortByDesc('pieces')
            ->values();

        return ['count' => $products->count(), 'items' => array_values($products->take(self::SHOWN)->all()), 'today' => now()->toDateString()];
    }

    /**
     * Set the payment dates and tell the buyers with unpaid preorders.
     *
     * @throws ValidationException when the dates or the item do not allow it
     */
    public static function set(Product $product, string $payFrom, string $closeOn): string
    {
        self::refuseUnlessAllowed($product, $payFrom, $closeOn);

        $product->forceFill(['preorder_pay_from' => $payFrom, 'preorders_close_on' => $closeOn])->save();

        $slips = PreorderSlip::query()
            ->with('student')
            ->whereIn('batch', self::unpaid(Preorder::query()->where('product_id', $product->id)->where('status', PreorderStatus::Active))->select('batch'))
            ->get();

        foreach ($slips as $slip) {
            $slip->student->notify(new PreorderPayBy($product, $slip));
        }

        $buyers = $slips->unique('user_id')->count();
        $from = CarbonImmutable::parse($payFrom);
        $until = CarbonImmutable::parse($closeOn);

        return "Payment dates for {$product->name}: {$from->format('M j')} to {$until->format('M j, Y')}. "
            .($buyers === 0
                ? 'No one has an unpaid preorder now; new buyers see the dates.'
                : "{$buyers} ".($buyers === 1 ? 'buyer with an unpaid preorder was' : 'buyers with unpaid preorders were').' told to pay by then.');
    }

    /**
     * Drop the unpaid preorders of items whose close date has passed, tell
     * their buyers, and clear the dates of a sold-out size's round (run
     * every minute).
     *
     * @return int preorders dropped
     */
    public static function dropUnpaid(): int
    {
        $dropped = 0;

        Product::query()
            ->whereNotNull('preorder_pay_from')
            ->whereNotNull('preorders_close_on')
            ->whereDate('preorders_close_on', '<', now()->toDateString())
            ->each(function (Product $product) use (&$dropped): void {
                $dropped += DB::transaction(function () use ($product): int {
                    $closedOn = (string) $product->preorders_close_on?->toDateString();
                    $preorders = self::unpaid(Preorder::query()->where('product_id', $product->id)->where('status', PreorderStatus::Active))
                        ->lockForUpdate()
                        ->get();

                    foreach ($preorders as $preorder) {
                        $preorder->forceFill(['status' => PreorderStatus::NotPaid, 'cancelled_at' => now()])->save();
                    }

                    // A sold-out size's round is over: the next preorders start a new one.
                    if ($product->status !== ProductStatus::Preorder) {
                        $product->forceFill(['preorder_pay_from' => null, 'preorders_close_on' => null])->save();
                    }

                    if ($preorders->isNotEmpty()) {
                        EarlyBird::reallocate($product);

                        foreach ($preorders->unique('user_id') as $preorder) {
                            DB::afterCommit(fn () => $preorder->student->notify(new PreorderNotPaid($product, $closedOn)));
                        }
                    }

                    return $preorders->count();
                });
            });

        return $dropped;
    }

    /**
     * Preorders whose batch is not paid.
     *
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  Builder<TModel>  $preorders
     * @return Builder<TModel>
     */
    private static function unpaid(Builder $preorders): Builder
    {
        return $preorders->whereNotIn('batch', PreorderSlip::query()->whereNotNull('paid_at')->select('batch'));
    }

    /**
     * @throws ValidationException
     */
    private static function refuseUnlessAllowed(Product $product, string $payFrom, string $closeOn): void
    {
        $today = now()->toDateString();
        $errors = [];

        if (! in_array($product->status, [ProductStatus::Preorder, ProductStatus::Available, ProductStatus::OnSale], true)) {
            $errors['preorder_pay_from'] = "{$product->name} is not in the store, so it has no preorders to pay for.";
        } elseif ($product->status !== ProductStatus::Preorder && ! $product->preorders()->where('status', PreorderStatus::Active)->exists()) {
            $errors['preorder_pay_from'] = "No one is waiting for a sold-out size of {$product->name}, so there is nothing to pay for.";
        }

        if ($payFrom < $today) {
            $errors['preorder_pay_from'] = 'The start date cannot be in the past.';
        }

        if ($closeOn < $payFrom) {
            $errors['preorders_close_on'] = 'The close date cannot be before the start date.';
        } elseif ($product->status === ProductStatus::Preorder && $product->expected_arrival_from !== null && $closeOn >= $product->expected_arrival_from->toDateString()) {
            $errors['preorders_close_on'] = 'The close date must be before the expected arrival ('.($product->expectedArrivalText() ?: $product->expected_arrival_from->format('M j, Y')).'). Change the expected arrival in Edit Product first.';
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }
}
