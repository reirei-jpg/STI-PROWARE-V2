<?php

namespace App\Http\Requests;

use App\Enums\PaymentMethod;
use App\Models\Payment;
use App\Services\Shop\PaymentTender;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The cashier records a payment (website and phone app): the method is
 * required; cash needs the amount received (up to 2 decimal places, at most
 * ₱100,000.00), GCash its 13-digit reference number. Whether the cash covers
 * the amount due and whether the GCash reference was used before are
 * checked when it is recorded (PaymentRecorder). The routes allow only the
 * cashier.
 */
class RecordPaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * A GCash reference typed with spaces or dashes ("1234 567 890123") is read as its digits.
     */
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('gcash_reference'))) {
            $this->merge(['gcash_reference' => preg_replace('/[\s-]+/', '', $this->input('gcash_reference'))]);
        }

        if (is_string($this->input('amount_received'))) {
            $this->merge(['amount_received' => str_replace([',', '₱', ' '], '', $this->input('amount_received'))]);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'method' => ['required', Rule::enum(PaymentMethod::class)],
            'amount_received' => ['exclude_unless:method,cash', 'bail', 'required', 'numeric', 'decimal:0,2', 'min:0.01', 'max:'.(Payment::MAX_RECEIVED_CENTAVOS / 100)],
            'gcash_reference' => ['exclude_unless:method,gcash', 'required', 'string', 'regex:/^\d{13}$/'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'method.required' => 'Select the payment method.',
            'method.enum' => 'Select Cash or GCash as the payment method.',
            'amount_received.required' => 'Enter the amount received.',
            'amount_received.numeric' => 'Enter the amount received as a number, e.g. 500 or 500.50.',
            'amount_received.decimal' => 'Enter the amount received with up to 2 decimal places, e.g. 500.50.',
            'amount_received.min' => 'The amount received must be more than ₱0.00.',
            'amount_received.max' => 'The amount received cannot be more than ₱'.number_format(Payment::MAX_RECEIVED_CENTAVOS / 100, 2).'.',
            'gcash_reference.required' => 'Enter the 13-digit GCash reference number.',
            'gcash_reference.string' => 'Enter the 13-digit GCash reference number.',
            'gcash_reference.regex' => 'The GCash reference number must be exactly 13 digits.',
        ];
    }

    /** What the cashier entered, in centavos for cash. */
    public function tender(): PaymentTender
    {
        $method = PaymentMethod::from((string) $this->validated('method'));

        return $method === PaymentMethod::Cash
            ? PaymentTender::cash((int) round((float) $this->validated('amount_received') * 100))
            : PaymentTender::gcash((string) $this->validated('gcash_reference'));
    }
}
