<?php

namespace App\Services\Shop;

use App\Enums\UniformSetFor;
use App\Models\CartItem;
use App\Models\ProductPack;
use App\Models\ProductVariant;
use App\Models\UniformSet;
use App\Models\User;
use App\Services\Stock\Units;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * A student's cart: adding the same size or color by the same piece or pack
 * again adds to its quantity, and the pieces in the cart for a size or color
 * can never be more than its stock. Stock is only taken when the order is
 * placed.
 *
 * A uniform set is two lines (its top and its bottom) with one set key:
 * they always have the same quantity and tick, and are removed together.
 * Adding the same set with the same sizes again adds to its quantity.
 */
final class Cart
{
    /** The most of one item a student can have in a cart line (as on V1). */
    public const MAX_QUANTITY = 99;

    public function add(User $student, ProductVariant $variant, ?ProductPack $pack, int $quantity): CartItem
    {
        $line = $student->cartItems()
            ->where('product_variant_id', $variant->id)
            ->where('product_pack_id', $pack?->id)
            ->whereNull('set_key')
            ->first();

        $newQuantity = ($line->quantity ?? 0) + $quantity;
        $this->ensureInStock($student, $variant, $pack, $newQuantity, $line);

        if ($line === null) {
            return $student->cartItems()->create([
                'product_variant_id' => $variant->id,
                'product_pack_id' => $pack?->id,
                'quantity' => $newQuantity,
            ]);
        }

        // Adding it again means they want it: tick it for the next order.
        $line->update(['quantity' => $newQuantity, 'selected' => true]);

        return $line;
    }

    /**
     * Add a uniform set: its top and its bottom, each by the piece.
     *
     * @return string the set key of its two lines
     */
    public function addSet(User $student, UniformSet $set, UniformSetFor $for, ProductVariant $top, ProductVariant $bottom, int $quantity): string
    {
        return DB::transaction(function () use ($student, $set, $for, $top, $bottom, $quantity): string {
            $existing = $student->cartItems()
                ->where('uniform_set_id', $set->id)
                ->where('set_for', $for)
                ->where('product_variant_id', $top->id)
                ->whereIn('set_key', $student->cartItems()->where('product_variant_id', $bottom->id)->whereNotNull('set_key')->select('set_key'))
                ->first();
            $lines = $existing === null ? collect() : $student->cartItems()->where('set_key', $existing->set_key)->get();
            $newQuantity = ($existing->quantity ?? 0) + $quantity;

            $this->ensureInStock($student, $top, null, $newQuantity, $lines->firstWhere('product_variant_id', $top->id));
            $this->ensureInStock($student, $bottom, null, $newQuantity, $lines->firstWhere('product_variant_id', $bottom->id));

            if ($existing !== null) {
                $student->cartItems()->where('set_key', $existing->set_key)->update(['quantity' => $newQuantity, 'selected' => true]);

                return (string) $existing->set_key;
            }

            $key = (string) Str::uuid();

            foreach ([$top, $bottom] as $variant) {
                $student->cartItems()->create([
                    'product_variant_id' => $variant->id,
                    'uniform_set_id' => $set->id,
                    'set_key' => $key,
                    'set_for' => $for,
                    'quantity' => $newQuantity,
                ]);
            }

            return $key;
        });
    }

    /**
     * "1 BSIT Uniform Set (For Boys: BSIT Polo M, BSIT Pants L) has been added to your cart."
     */
    public static function addedSetMessage(UniformSet $set, UniformSetFor $for, ProductVariant $top, ProductVariant $bottom, int $quantity): string
    {
        $sets = $quantity === 1 ? '1 '.$set->displayName() : "{$quantity} × {$set->displayName()}";

        return "{$sets} ({$for->label()}: {$top->displayName()}, {$bottom->displayName()}) ".($quantity === 1 ? 'has' : 'have').' been added to your cart.';
    }

    /**
     * Tick or untick some of the student's own lines for the next Place
     * Order (one line, or "Select all"); a set's two lines go together.
     * Other students' lines are never touched.
     *
     * @param  list<int>  $cartItemIds
     */
    public function select(User $student, array $cartItemIds, bool $selected): void
    {
        $setKeys = $student->cartItems()->whereKey($cartItemIds)->whereNotNull('set_key')->pluck('set_key');

        $student->cartItems()
            ->where(fn (Builder $lines) => $lines->whereKey($cartItemIds)->orWhereIn('set_key', $setKeys))
            ->update(['selected' => $selected]);
    }

    /**
     * Take a line out of the cart; for a set, both its lines.
     */
    public function remove(CartItem $line): void
    {
        if ($line->set_key === null) {
            $line->delete();

            return;
        }

        $line->student->cartItems()->where('set_key', $line->set_key)->delete();
    }

    /**
     * "Added 2 Boxes of STI Ballpen to your cart." (website and phone app).
     */
    public static function addedMessage(ProductVariant $variant, ?ProductPack $pack, int $quantity): string
    {
        return Units::count($quantity, $pack->name ?? 'Piece')." of {$variant->displayName()} ".($quantity === 1 ? 'has' : 'have').' been added to your cart.';
    }

    /**
     * Add several lines at once (Add to Cart with more than one size): all
     * of them, or none when one cannot be added. The problem is reported on
     * that line's field, given by $fieldFor(index, 'quantity').
     *
     * @param  list<array{variant: ProductVariant, pack: ProductPack|null, quantity: int}>  $lines
     * @param  callable(int, string): string  $fieldFor
     */
    public function addMany(User $student, array $lines, callable $fieldFor): void
    {
        DB::transaction(function () use ($student, $lines, $fieldFor): void {
            foreach ($lines as $index => $line) {
                try {
                    $this->add($student, $line['variant'], $line['pack'], $line['quantity']);
                } catch (ValidationException $exception) {
                    throw ValidationException::withMessages([
                        $fieldFor($index, 'quantity') => $exception->validator->errors()->first(),
                    ]);
                }
            }
        });
    }

    /**
     * One line: "2 pcs of BSIT Polo (M) have been added to your cart."
     * Several: "2 pcs of BSIT Polo (S) and 1 pc of BSIT Polo (M) have been added to your cart."
     *
     * @param  list<array{variant: ProductVariant, pack: ProductPack|null, quantity: int}>  $lines
     */
    public static function addedManyMessage(array $lines): string
    {
        if (count($lines) === 1) {
            return self::addedMessage($lines[0]['variant'], $lines[0]['pack'], $lines[0]['quantity']);
        }

        $parts = array_map(
            fn (array $line): string => Units::count($line['quantity'], $line['pack']->name ?? 'Piece')." of {$line['variant']->displayName()}",
            $lines,
        );
        $last = array_pop($parts);

        return implode(', ', $parts)." and {$last} have been added to your cart.";
    }

    /**
     * Change how many; for a set, both its lines (each must have the stock).
     */
    public function changeQuantity(CartItem $line, int $quantity): void
    {
        if ($line->set_key === null) {
            $this->ensureInStock($line->student, $line->variant, $line->pack, $quantity, $line);

            $line->update(['quantity' => $quantity]);

            return;
        }

        $lines = $line->student->cartItems()->with(['variant.product', 'pack'])->where('set_key', $line->set_key)->get();

        foreach ($lines as $setLine) {
            $this->ensureInStock($line->student, $setLine->variant, null, $quantity, $setLine);
        }

        $line->student->cartItems()->where('set_key', $line->set_key)->update(['quantity' => $quantity]);
    }

    /**
     * The most of this piece or pack the student can have in the cart: what
     * is free to sell (not held for orders), less the pieces their other cart
     * lines of the same size or color take.
     */
    public function mostAllowed(User $student, ProductVariant $variant, ?ProductPack $pack, ?CartItem $except = null): int
    {
        return self::mostOf($variant->freeToSell(), $this->piecesInOtherLines($student, $variant, $except), $pack->pieces ?? 1);
    }

    /**
     * How many units fit in the pieces the other cart lines leave free.
     */
    public static function mostOf(int $freeToSell, int $piecesInOtherLines, int $piecesPerUnit): int
    {
        return min(self::MAX_QUANTITY, intdiv(max(0, $freeToSell - $piecesInOtherLines), $piecesPerUnit));
    }

    private function ensureInStock(User $student, ProductVariant $variant, ?ProductPack $pack, int $quantity, ?CartItem $line): void
    {
        $most = $this->mostAllowed($student, $variant, $pack, $line);

        if ($quantity <= $most) {
            return;
        }

        $unit = $pack->name ?? 'Piece';
        $piecesPerUnit = $pack->pieces ?? 1;
        $inOtherLines = $this->piecesInOtherLines($student, $variant, $line);

        // Only when the stock itself has more than the most one student may
        // order; otherwise the student is told how many are left.
        if ($quantity > self::MAX_QUANTITY && intdiv(max(0, $variant->freeToSell() - $inOtherLines), $piecesPerUnit) >= self::MAX_QUANTITY) {
            throw ValidationException::withMessages(['quantity' => 'For more than '.number_format(self::MAX_QUANTITY).', contact the PROWARE office.']);
        }

        $message = match (true) {
            $variant->freeToSell() === 0 => "{$variant->displayName()} is out of stock.",
            $most === 0 && $inOtherLines > 0 => "Your cart already has {$this->pieces($inOtherLines)} of {$variant->displayName()}, and only {$this->pieces($variant->freeToSell())} are left.",
            $most === 0 => "Only {$this->pieces($variant->freeToSell())} of {$variant->displayName()} are left, not enough for 1 {$unit} ({$this->pieces($piecesPerUnit)}).",
            default => "You can have at most {$this->units($most, $unit, $piecesPerUnit)} of {$variant->displayName()} in your cart (only {$this->pieces($variant->freeToSell())} left).",
        };

        throw ValidationException::withMessages(['quantity' => $message]);
    }

    private function piecesInOtherLines(User $student, ProductVariant $variant, ?CartItem $except): int
    {
        return (int) $student->cartItems()
            ->with('pack')
            ->where('product_variant_id', $variant->id)
            ->when($except, fn (Builder $lines, CartItem $line) => $lines->whereKeyNot($line->id))
            ->get()
            ->sum(fn (CartItem $other): int => $other->pieces());
    }

    private function pieces(int $pieces): string
    {
        return Units::count($pieces, 'Piece');
    }

    private function units(int $quantity, string $unit, int $piecesPerUnit): string
    {
        return $piecesPerUnit === 1 ? Units::count($quantity, 'Piece') : Units::count($quantity, $unit)." ({$this->pieces($quantity * $piecesPerUnit)})";
    }
}
