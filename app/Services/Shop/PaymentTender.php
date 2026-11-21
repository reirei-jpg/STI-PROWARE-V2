<?php

namespace App\Services\Shop;

use App\Enums\PaymentMethod;

/**
 * How the buyer paid, as the cashier entered it: cash with the amount
 * received, or GCash with its 13-digit reference number. Checked against
 * the amount due when the payment is recorded (PaymentRecorder).
 */
final readonly class PaymentTender
{
    public function __construct(
        public PaymentMethod $method,
        public ?int $receivedCentavos = null,
        public ?string $gcashReference = null,
    ) {}

    public static function cash(int $receivedCentavos): self
    {
        return new self(PaymentMethod::Cash, receivedCentavos: $receivedCentavos);
    }

    public static function gcash(string $reference): self
    {
        return new self(PaymentMethod::GCash, gcashReference: $reference);
    }
}
