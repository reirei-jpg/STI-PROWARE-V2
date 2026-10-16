<?php

namespace App\Http\Requests;

use App\Enums\CancelReason;
use App\Models\Order;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * A student cancels their own order, picking why from a list like in online
 * shops (website and phone app), so the PROWARE office knows. Other asks
 * them to write why.
 */
class StudentCancelOrderRequest extends FormRequest
{
    /**
     * Only the student's own order; another student's is not found (before
     * the reason is checked).
     */
    public function authorize(): bool
    {
        $order = $this->route('order');

        abort_unless($order instanceof Order && $order->user_id === $this->user()?->id, 404);

        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'reason' => ['required', Rule::in(array_map(fn (CancelReason $reason): string => $reason->value, CancelReason::forStudent()))],
            'note' => [Rule::requiredIf($this->input('reason') === CancelReason::Other->value), 'nullable', 'string', 'min:5', 'max:200'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'reason.required' => 'Choose why you are cancelling.',
            'reason.in' => 'Choose one of the reasons shown.',
            'note.required' => 'Write why you are cancelling.',
            'note.min' => 'Write at least 5 characters.',
            'note.max' => 'The reason may not be longer than 200 characters.',
        ];
    }

    /** The reason as the order keeps it and the office reads it. */
    public function reasonText(): string
    {
        return CancelReason::from((string) $this->input('reason'))->describe($this->input('note'));
    }
}
