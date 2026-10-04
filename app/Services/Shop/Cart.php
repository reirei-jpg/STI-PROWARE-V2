<?php

namespace App\Services\Shop;

use App\Models\CartItem;
use App\Models\ProductPack;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\Stock\Units;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;

/**
 * A student's cart: adding the same size or color by the same piece or pack
 * again adds to its quantity, and the pieces in the cart for a size or color
 * can never be more than its stock. Stock is only taken when the order is
 * placed.
 */
final class Cart
{
    public const MAX_QUANTITY = 1000;

    public function add(User $student, ProductVariant $variant, ?ProductPack $pack, int $quantity): CartItem
    {
        $line = $student->cartItems()
            ->where('product_variant_id', $variant->id)
            ->where('product_pack_id', $pack?->id)
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

        $line->update(['quantity' => $newQuantity]);

        return $line;
    }

    /**
     * "Added 2 Boxes of STI Ballpen to your cart." (website and phone app).
     */
    public static function addedMessage(ProductVariant $variant, ?ProductPack $pack, int $quantity): string
    {
        return 'Added '.Units::count($quantity, $pack->name ?? 'Piece')." of {$variant->displayName()} to your cart.";
    }

    public function changeQuantity(CartItem $line, int $quantity): void
    {
        $this->ensureInStock($line->student, $line->variant, $line->pack, $quantity, $line);

        $line->update(['quantity' => $quantity]);
    }

    /**
     * The most of this piece or pack the student can have in the cart: the
     * stock, less the pieces their other cart lines of the same size or
     * color take.
     */
    public function mostAllowed(User $student, ProductVariant $variant, ?ProductPack $pack, ?CartItem $except = null): int
    {
        return self::mostOf($variant->stock_on_hand, $this->piecesInOtherLines($student, $variant, $except), $pack->pieces ?? 1);
    }

    /**
     * How many units fit in the pieces the other cart lines leave free.
     */
    public static function mostOf(int $stockOnHand, int $piecesInOtherLines, int $piecesPerUnit): int
    {
        return min(self::MAX_QUANTITY, intdiv(max(0, $stockOnHand - $piecesInOtherLines), $piecesPerUnit));
    }

    private function ensureInStock(User $student, ProductVariant $variant, ?ProductPack $pack, int $quantity, ?CartItem $line): void
    {
        $most = $this->mostAllowed($student, $variant, $pack, $line);

        if ($quantity <= $most) {
            return;
        }

        if ($quantity > self::MAX_QUANTITY) {
            throw ValidationException::withMessages(['quantity' => 'For more than '.number_format(self::MAX_QUANTITY).', please talk to the PROWARE office.']);
        }

        $unit = $pack->name ?? 'Piece';
        $piecesPerUnit = $pack->pieces ?? 1;
        $inOtherLines = $this->piecesInOtherLines($student, $variant, $line);

        $message = match (true) {
            $variant->stock_on_hand === 0 => "{$variant->displayName()} is out of stock.",
            $most === 0 && $inOtherLines > 0 => "Your cart already has {$this->pieces($inOtherLines)} of {$variant->displayName()}, and only {$this->pieces($variant->stock_on_hand)} are left.",
            $most === 0 => "Only {$this->pieces($variant->stock_on_hand)} of {$variant->displayName()} are left, not enough for 1 {$unit} ({$this->pieces($piecesPerUnit)}).",
            default => "You can have at most {$this->units($most, $unit, $piecesPerUnit)} of {$variant->displayName()} in your cart (only {$this->pieces($variant->stock_on_hand)} left).",
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
