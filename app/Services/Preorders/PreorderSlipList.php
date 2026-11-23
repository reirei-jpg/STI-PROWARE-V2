<?php

namespace App\Services\Preorders;

use App\Enums\PreorderStatus;
use App\Models\Preorder;
use App\Models\PreorderSlip;
use App\Models\User;
use App\Services\Stock\Units;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * The Preorders card on the Specialist's dashboard (website and phone): a
 * shortcut to the preorder slips still waiting for their items, so the
 * Specialist can see which are paid. "Awaiting payment" (to_verify) are the
 * unpaid slips (the cashier records the payment); "Paid" are the paid slips
 * not yet released. View slip opens the slip, as when it is scanned. The list
 * shows one card per buyer with all their slips, since a buyer who
 * preordered two items has two slips (one per press of Preorder).
 *
 * @phpstan-type SlipRow array{slip_id: int, number: string|null, buyer_name: string, buyer_id_number: string|null, is_staff: bool, product_name: string, items: string, pieces: int, amount_centavos: int, paid: bool, paid_on: string|null, pay_from: string|null, pay_until: string|null}
 * @phpstan-type BuyerRow array{buyer_id: int, buyer_name: string, buyer_id_number: string|null, is_staff: bool, unpaid_slips: int, unpaid_centavos: int, slips: list<SlipRow>}
 */
final class PreorderSlipList
{
    public const TABS = ['to_verify', 'paid', 'all'];

    public const BUYERS_PER_PAGE = 15;

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
     * One page of buyers, each with their slips in the tab: buyers with an
     * unpaid slip first, then the earliest to preorder (first come, first
     * served). Found by buyer name or slip number.
     *
     * @return LengthAwarePaginator<int, BuyerRow>
     */
    public static function page(string $tab, ?string $search): LengthAwarePaginator
    {
        $matching = self::query($tab)
            ->when($search !== null, fn (Builder $slips) => $slips->where(fn (Builder $found) => $found
                ->whereLike('number', "%{$search}%")
                ->orWhereHas('student', fn (Builder $buyer) => $buyer->whereLike('name', "%{$search}%"))))
            ->select('user_id');
        $ofBuyer = fn () => self::query($tab)->whereColumn('preorder_slips.user_id', 'users.id');

        $page = User::query()
            ->whereIn('id', $matching)
            ->orderBy($ofBuyer()->selectRaw('min(case when paid_at is null then 0 else 1 end)'))
            ->orderBy($ofBuyer()->selectRaw('min(id)'))
            ->orderBy('id')
            ->paginate(self::BUYERS_PER_PAGE)
            ->withQueryString();

        // Every slip of the buyers on this page, unpaid first, then the oldest.
        $slips = self::query($tab)
            ->whereIn('user_id', $page->getCollection()->modelKeys())
            ->with(['student', 'product', 'preorders.variant'])
            ->orderByRaw('case when paid_at is null then 0 else 1 end')
            ->orderBy('id')
            ->get()
            ->groupBy('user_id');

        return $page->through(function (User $buyer) use ($slips): array {
            $rows = array_values(($slips[$buyer->id] ?? collect())->map(fn (PreorderSlip $slip): array => self::row($slip))->all());
            $unpaid = array_values(array_filter($rows, fn (array $row): bool => ! $row['paid']));

            return [
                'buyer_id' => $buyer->id,
                'buyer_name' => $buyer->name,
                'buyer_id_number' => $buyer->idNumber(),
                'is_staff' => $buyer->isEmployee(),
                'unpaid_slips' => count($unpaid),
                'unpaid_centavos' => array_sum(array_column($unpaid, 'amount_centavos')),
                'slips' => $rows,
            ];
        });
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
