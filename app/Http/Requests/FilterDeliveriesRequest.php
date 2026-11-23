<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * The filters on the Deliveries page, read from the page address: which
 * list (Received, or Waiting to arrive, or one of the cards' lists), the
 * search, the received dates, and which delivery's details to load.
 */
class FilterDeliveriesRequest extends FormRequest
{
    /** Lists of received deliveries. */
    public const RECEIVED = ['received', 'this_month', 'not_in_stock'];

    /**
     * Lists of purchase orders still waiting for their delivery: all, or
     * those not complete after the follow-up days.
     */
    public const WAITING = ['waiting', 'follow_up'];

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'show' => ['nullable', Rule::in([...self::RECEIVED, ...self::WAITING])],
            'search' => ['nullable', 'string', 'max:40'],
            'date_from' => ['bail', 'nullable', 'date_format:Y-m-d', 'before_or_equal:today'],
            'date_to' => ['bail', 'nullable', 'date_format:Y-m-d', 'before_or_equal:today'],
            'details' => ['nullable', 'integer'],
        ];
    }

    /**
     * Received deliveries by default.
     */
    public function show(): string
    {
        return $this->string('show')->toString() ?: 'received';
    }

    public function showsWaiting(): bool
    {
        return in_array($this->show(), self::WAITING, true);
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'date_from.date_format' => 'Choose a valid "From" date.',
            'date_to.date_format' => 'Choose a valid "To" date.',
            'date_from.before_or_equal' => 'The "From" date cannot be after today.',
            'date_to.before_or_equal' => 'The "To" date cannot be after today.',
        ];
    }

    /**
     * "To before From" is checked only once both days are valid, so a wrong
     * day is not also reported as "To before From".
     *
     * @return array<int, \Closure(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->has('date_from') || $validator->errors()->has('date_to') || ! $this->filled('date_from') || ! $this->filled('date_to')) {
                    return;
                }

                if ((string) $this->input('date_to') < (string) $this->input('date_from')) {
                    $validator->errors()->add('date_to', 'The "To" date cannot be before the "From" date.');
                }
            },
        ];
    }

    /**
     * An SI #, DR # or Order # to look for.
     */
    public function search(): ?string
    {
        $search = trim(ltrim(trim((string) $this->input('search', '')), '#'));

        return $search === '' ? null : $search;
    }

    public function dateFrom(): ?string
    {
        return $this->filled('date_from') ? $this->string('date_from')->toString() : null;
    }

    public function dateTo(): ?string
    {
        return $this->filled('date_to') ? $this->string('date_to')->toString() : null;
    }
}
