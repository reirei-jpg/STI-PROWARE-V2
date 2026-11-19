<?php

namespace App\Services\Products;

use App\Models\Product;

/**
 * A product's own Item Code, made from its name: the first letters of its
 * first two words and the next free number, e.g. "Bagong Product" → BP-01,
 * the next "B… P…" product → BP-02. A one-word name uses its first two
 * letters ("Lanyard" → LA-01). Small joining words are skipped
 * ("Set of Pens" → SP-01).
 *
 * Each variant's code starts with it (BP-01-S-G11-RED); the form makes
 * those (resources/js/lib/item-codes.ts, which also makes this code while
 * the name is typed).
 */
final class ProductCode
{
    public static function prefix(string $name): string
    {
        $words = array_values(array_filter(
            preg_split('/[^\p{L}\p{N}]+/u', mb_strtoupper($name), -1, PREG_SPLIT_NO_EMPTY) ?: [],
            fn (string $word): bool => ! in_array(mb_strtolower($word), ProductName::SMALL_WORDS, true),
        ));

        $prefix = match (true) {
            count($words) >= 2 => mb_substr($words[0], 0, 1).mb_substr($words[1], 0, 1),
            count($words) === 1 => mb_substr($words[0], 0, 2),
            default => 'PR',
        };

        return mb_strlen($prefix) < 2 ? $prefix.'X' : $prefix;
    }

    /**
     * The next free code for a product with this name, e.g. BP-03 when
     * BP-01 and BP-02 are taken.
     */
    public static function next(string $name, ?int $exceptProductId = null): string
    {
        $prefix = self::prefix($name);

        $highest = Product::query()
            ->when($exceptProductId !== null, fn ($query) => $query->whereKeyNot($exceptProductId))
            ->where('item_code', 'like', $prefix.'-%')
            ->pluck('item_code')
            ->map(fn (?string $code): int => preg_match('/^'.preg_quote($prefix, '/').'-(\d+)$/u', (string) $code, $matches) ? (int) $matches[1] : 0)
            ->max() ?? 0;

        return sprintf('%s-%02d', $prefix, $highest + 1);
    }
}
