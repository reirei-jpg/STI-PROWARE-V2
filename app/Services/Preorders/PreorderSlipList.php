<?php

namespace App\Services\Preorders;

use App\Enums\PreorderStatus;
use App\Models\Preorder;
use App\Models\PreorderSlip;
use App\Services\Stock\Units;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * The Preorders card on the Specialist's dashboard (website and phone): a
 * shortcut to the preorder slips still waiting for their items, so the
 * Specialist can check which are paid. "To verify" are the unpaid slips
 * (the buyer still has to show the cashier's receipt); "Paid" are the paid
 * slips not yet released. Check payment opens the slip, where the receipt
 * is checked and the slip is marked paid, as when it is scanned.
 *
 * @phpstan-type SlipRow array{slip_id: int, number: string|null, buyer_name: string, buyer_id_number: string|null, is_staff: bool, product_name: string, items: string, pieces: int, amount_centavos: int, paid: bool, paid_on: string|null, pay_from: string|null, pay_until: string|null}
 */
final class PreorderSlipList
{
    public const TABS = ['to_verify', 'paid', 'all'];

    public const PER_PAGE = 20;

    /**
     * The card's numbers.
     *
     * @return array{to_verify: int, paid: int, all: int}
     */
    public static function counts(): array
    {
        $toVerify = self::query('to_verify')->count();
        $paid = self::query('paid')->count();

        return ['to_verify' => $toVerify, 'paid' => $paid, 'all' => $toVerify + $paid];
    }

    /**
     * One page of slips: unpaid first, then the oldest first (first come,
     * first served), found by slip number or buyer name.
     *
     * @return LengthAwarePaginator<int, SlipRow>
     */
    public static function page(string $tab, ?string $search): LengthAwarePaginator
    {
        $page = self::query($tab)
            ->when($search !== null, fn (Builder $slips) => $slips->where(fn (Builder $found) => $found
                ->whereLike('number', "%{$search}%")
                ->orWhereHas('student', fn (Builder $buyer) => $buyer->whereLike('name', "%{$search}%"))))
            ->with(['student', 'product', 'preorders.variant'])
            ->orderByRaw('case when paid_at is null then 0 else 1 end')
            ->orderBy('id')
            ->paginate(self::PER_PAGE)
            ->withQueryString();

        return $page->through(fn (PreorderSlip $slip): array => self::row($slip));
    }

    /**
     * Slips still waiting for their items: unpaid ones with a preorder still
     * waiting, and paid ones not yet released.
     *
     * @return Builder<PreorderSlip>
     */
    private static function query(string $tab): Builder
    {
        $toVerify = fn (Builder $slips) => $slips->whereNull('paid_at')
            ->whereHas('preorders', fn (Builder $preorders) => $preorders->where('status', PreorderStatus::Active));
        $paid = fn (Builder $slips) => $slips->whereNotNull('paid_at')
            ->whereHas('preorders', fn (Builder $preorders) => $preorders->whereIn('status', [PreorderStatus::Active, PreorderStatus::Held]));

        return match ($tab) {
            'to_verify' => $toVerify(PreorderSlip::query()),
            'paid' => $paid(PreorderSlip::query()),
            default => PreorderSlip::query()->where(fn (Builder $either) => $either
                ->where(fn (Builder $slips) => $toVerify($slips))
                ->orWhere(fn (Builder $slips) => $paid($slips))),
        };
    }

    /**
     * @return SlipRow
     */
    private static function row(PreorderSlip $slip): array
    {
        // The preorders the slip is for (PreorderSlip::counted), from what is loaded.
        $preorders = $slip->preorders->filter(fn (Preorder $preorder): bool => $slip->isPaid()
            ? ! in_array($preorder->status, [PreorderStatus::Cancelled, PreorderStatus::NotRestocked, PreorderStatus::HoldEnded], true)
            : $preorder->status === PreorderStatus::Active);
        $product = $slip->product;
        $pieces = (int) $preorders->sum('quantity');

        return [
            'slip_id' => $slip->id,
            'number' => $slip->number,
            'buyer_name' => $slip->student->name,
            'buyer_id_number' => $slip->student->idNumber(),
            'is_staff' => $slip->student->isEmployee(),
            'product_name' => $product->name,
            // One line per size: a paid slip whose pieces partly arrived is one size, not two.
            'items' => $preorders->groupBy('product_variant_id')->map(function ($sameSize): string {
                $variant = $sameSize->first()->variant;
                $quantity = (int) $sameSize->sum('quantity');

                return $variant->choices === [] ? Units::count($quantity, 'Piece') : $variant->label().' × '.$quantity;
            })->implode(', '),
            'pieces' => $pieces,
            'amount_centavos' => $slip->paid_centavos ?? (int) $preorders->sum(fn (Preorder $preorder): int => PreorderSlip::amountOf($preorder->setRelation('product', $product))),
            'paid' => $slip->isPaid(),
            'paid_on' => $slip->paid_at?->toDateString(),
            'pay_from' => $product->preorder_pay_from?->toDateString(),
            'pay_until' => $product->preorder_pay_from === null ? null : $product->preorders_close_on?->toDateString(),
        ];
    }
}
