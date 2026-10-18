<?php

namespace App\Http\Requests;

use App\Models\ProductVariant;
use App\Services\Stock\LowStockAlerts;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * The Specialist says a sold-out size will not be restocked, with a short
 * reason the students see (optional). Only a sold-out size of a product
 * for sale, not marked already.
 */
class MarkNotRestockedRequest extends FormRequest
{
    public const REASON_MAX = 200;

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'reason' => ['nullable', 'string', 'max:'.self::REASON_MAX],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'reason.string' => 'Write the reason as text.',
            'reason.max' => 'The reason may be at most '.self::REASON_MAX.' characters.',
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $variant = $this->variant()->load('product');

                $problem = match (true) {
                    ! LowStockAlerts::isSold($variant->product) => "{$variant->product->name} is not for sale, so this only applies to its preorders when it is.",
                    $variant->freeToSell() > 0 => "{$variant->displayName()} is in stock again.",
                    $variant->not_restocked_at !== null => "{$variant->displayName()} is already marked as not restocked.",
                    default => null,
                };

                if ($problem !== null) {
                    $validator->errors()->add('reason', $problem);
                }
            },
        ];
    }

    /**
     * The reason with spaces trimmed; null when none was written.
     */
    public function reason(): ?string
    {
        $reason = trim((string) $this->input('reason'));

        return $reason === '' ? null : $reason;
    }

    public function variant(): ProductVariant
    {
        $variant = $this->route('variant');

        return $variant instanceof ProductVariant ? $variant : abort(404);
    }
}
