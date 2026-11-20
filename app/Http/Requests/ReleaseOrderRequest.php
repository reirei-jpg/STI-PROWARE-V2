<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Releasing an order (website and phone app). There is no "I checked the
 * receipt" box any more: the cashier marks the order Paid, and only a paid
 * order can be released (HandleOrderBySpecialist; panel revision, 20 Nov
 * 2026).
 */
class ReleaseOrderRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [];
    }
}
