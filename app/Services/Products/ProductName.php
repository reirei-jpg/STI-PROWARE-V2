<?php

namespace App\Services\Products;

/**
 * One way of writing every product name, so the store never shows "STI MUG"
 * beside "STI Mug" or "Student Information form":
 *
 * - each word starts with a capital letter ("form" → "Form", "MUG" → "Mug");
 * - school abbreviations stay in capitals (STI, IT, ID, PE, the strands, and
 *   program codes like BSIT or BSHM);
 * - small joining words stay lowercase unless they come first ("Set of Pens");
 * - words with digits ("42nd", "14oz") or mixed capitals ("AquaFlask") are
 *   kept as typed.
 *
 * The same rule runs on the product form to show how the name will be saved
 * (resources/js/lib/product-name.ts).
 */
final class ProductName
{
    /** @var list<string> */
    public const ABBREVIATIONS = ['STI', 'IT', 'ID', 'PE', 'NSTP', 'SHS', 'ABM', 'HUMSS', 'STEM', 'GAS', 'TVL', 'ICT'];

    /** @var list<string> */
    public const SMALL_WORDS = ['a', 'an', 'and', 'of', 'for', 'the', 'in', 'on', 'with', 'to', 'or'];

    public static function tidy(string $name): string
    {
        $words = preg_split('/\s+/', trim($name), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        return implode(' ', array_map(
            fn (string $word, int $position): string => implode('-', array_map(
                fn (string $part): string => self::word($part, $position === 0),
                explode('-', $word),
            )),
            $words,
            array_keys($words),
        ));
    }

    private static function word(string $word, bool $isFirst): string
    {
        // Leading and trailing punctuation, e.g. "(female)" or "set,".
        if (! preg_match('/^(\W*)(.*?)(\W*)$/u', $word, $parts) || $parts[2] === '') {
            return $word;
        }

        [, $before, $core, $after] = $parts;
        $upper = mb_strtoupper($core);
        $lower = mb_strtolower($core);

        $tidy = match (true) {
            in_array($upper, self::ABBREVIATIONS, true), (bool) preg_match('/^BS[A-Z]{1,4}$/', $upper) => $upper,
            (bool) preg_match('/\d/', $core) => $core,
            ! $isFirst && in_array($lower, self::SMALL_WORDS, true) => $lower,
            $core === $lower, $core === $upper => mb_strtoupper(mb_substr($lower, 0, 1)).mb_substr($lower, 1),
            default => $core,
        };

        return $before.$tidy.$after;
    }
}
