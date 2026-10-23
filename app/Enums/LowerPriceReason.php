<?php

namespace App\Enums;

/**
 * Why an order line was sold below its normal price, so Sales Reports can
 * say so: the product was On Sale, or the piece was one of the first
 * preordered pieces with the early-bird price.
 */
enum LowerPriceReason: string
{
    case Sale = 'sale';
    case EarlyBird = 'early_bird';

    public function label(): string
    {
        return match ($this) {
            self::Sale => 'On sale',
            self::EarlyBird => 'Early-bird price',
        };
    }
}
