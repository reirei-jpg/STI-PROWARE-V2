<?php

namespace App\Services\EstorePo;

/**
 * eStore item codes, written the same way everywhere in PROWARE so a code
 * typed on a product matches the code scanned from a purchase order.
 */
final class ItemCode
{
    private const DASH_CHARACTERS = ['–', '—', '‐', '‑', '‒', '−'];

    /**
     * "PRCU01 – 01" and "prcu01-01" both become "PRCU01-01"; a blank code
     * becomes null.
     */
    public static function normalize(?string $value): ?string
    {
        $code = (string) preg_replace('/\s+/u', '', str_replace(self::DASH_CHARACTERS, '-', (string) $value));

        return $code === '' ? null : mb_strtoupper($code);
    }
}
