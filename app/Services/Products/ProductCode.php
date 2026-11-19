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

    /**
     * Each variant's own code: the product's code and a short form of each
     * of its choices, e.g. BP-01 with S, Grade 11 (Senior High), Navy Blue →
     * BP-01-S-G11-NAVY. Two choices of one option that would get the same
     * short form (Light Blue, Light Gray) use all their words instead. The
     * same as the form's (resources/js/lib/item-codes.ts).
     *
     * @param  array<int, list<array{option: string, choice: string}>>  $variantChoices  by variant key
     * @return array<int, string> by the same keys
     */
    public static function variantCodes(string $productCode, array $variantChoices): array
    {
        $choicesByOption = [];

        foreach ($variantChoices as $choices) {
            foreach ($choices as $choice) {
                $choicesByOption[$choice['option']][$choice['choice']] = true;
            }
        }

        $shorts = [];

        foreach ($choicesByOption as $option => $choices) {
            $first = [];

            foreach (array_keys($choices) as $choice) {
                $first[$choice] = self::shortChoice((string) $choice);
            }

            $counts = array_count_values($first);

            foreach ($first as $choice => $short) {
                $shorts[$option][$choice] = $counts[$short] > 1 ? implode('', self::words((string) $choice)) : $short;
            }
        }

        return array_map(
            fn (array $choices): string => implode('-', array_filter([
                mb_strtoupper(trim($productCode)),
                ...array_map(fn (array $choice): string => $shorts[$choice['option']][$choice['choice']] ?? '', $choices),
            ], fn (string $part): bool => $part !== '')),
            $variantChoices,
        );
    }

    /**
     * "Grade 11 (Senior High)" → G11, "Navy Blue" → NAVY, "500 ml" → 500ML.
     */
    private static function shortChoice(string $choice): string
    {
        if (preg_match('/grade\s*(\d+)/i', $choice, $grade)) {
            return 'G'.$grade[1];
        }

        $words = self::words($choice);

        if ($words === []) {
            return '';
        }

        return preg_match('/^\d+$/', $words[0]) && isset($words[1]) ? $words[0].$words[1] : $words[0];
    }

    /**
     * @return list<string>
     */
    private static function words(string $text): array
    {
        return preg_split('/[^\p{L}\p{N}]+/u', mb_strtoupper($text), -1, PREG_SPLIT_NO_EMPTY) ?: [];
    }
}
