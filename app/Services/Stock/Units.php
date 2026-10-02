<?php

namespace App\Services\Stock;

/**
 * Quantities written with their unit, so the Specialist can always tell
 * how something was counted: "1 pc", "450 pcs", "2 Packs", and the
 * conversion of a delivery into pieces, "2 Packs × 10 = 20 pcs". The
 * browser writes them the same way (resources/js/lib/units.ts).
 */
final class Units
{
    /**
     * "1 pc", "450 pcs", "1 Pack", "2 Packs", "3 Boxes".
     */
    public static function count(int $quantity, string $unitName): string
    {
        $number = number_format($quantity);

        if ($unitName === 'Piece') {
            return $quantity === 1 ? "{$number} pc" : "{$number} pcs";
        }

        return $quantity === 1 ? "{$number} {$unitName}" : "{$number} ".self::plural($unitName);
    }

    /**
     * What a delivery added to stock: "2 Packs × 10 = 20 pcs", or just
     * "20 pcs" for an item Head Office sends by the piece.
     */
    public static function conversion(int $units, string $unitName, int $piecesPerUnit): string
    {
        $pieces = self::count($units * $piecesPerUnit, 'Piece');

        return $piecesPerUnit === 1
            ? $pieces
            : self::count($units, $unitName).' × '.number_format($piecesPerUnit).' = '.$pieces;
    }

    /**
     * "Pack" → "Packs", "Box" → "Boxes".
     */
    private static function plural(string $name): string
    {
        return preg_match('/(s|x|z|ch|sh)$/i', $name) === 1 ? "{$name}es" : "{$name}s";
    }
}
