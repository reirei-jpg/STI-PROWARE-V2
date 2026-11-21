<?php

namespace App\Http\Requests;

use App\Enums\PaymentMethod;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * The filters of the cashier's Payment History, Collections and their
 * downloads (also the School Admin's read-only view), read from the page
 * address: the period (today, this week, this month, or From / To days up
 * to today, at most a year), the payment method, Order or Preorder, Paid or
 * Void, a search (receipt, slip number, buyer name or ID, GCash reference),
 * and for Collections, by day or by month. A wrong filter is refused with a
 * plain reason, never dropped quietly.
 */
class FilterPaymentsRequest extends FormRequest
{
    public const PERIODS = ['today', 'week', 'month', 'custom'];

    public const MAX_DAYS = 366;

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'period' => ['nullable', Rule::in(self::PERIODS)],
            'date_from' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today', Rule::requiredIf($this->input('period') === 'custom')],
            'date_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:date_from', 'before_or_equal:today', Rule::requiredIf($this->input('period') === 'custom')],
            'method' => ['nullable', Rule::enum(PaymentMethod::class)],
            'type' => ['nullable', Rule::in(['order', 'preorder'])],
            'status' => ['nullable', Rule::in(['paid', 'void'])],
            'search' => ['nullable', 'string', 'max:100'],
            'group' => ['nullable', Rule::in(['day', 'month'])],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }

    /**
     * @return array<int, \Closure(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty() || $this->input('period') !== 'custom') {
                    return;
                }

                [$from, $to] = $this->range();

                if ((int) round($from->diffInDays($to->startOfDay())) + 1 > self::MAX_DAYS) {
                    $validator->errors()->add('date_to', 'Choose a period of at most one year.');
                }
            },
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'period.in' => 'Choose Today, This week, This month or a custom period.',
            'date_from.required' => 'Choose the "From" date.',
            'date_to.required' => 'Choose the "To" date.',
            'date_from.date_format' => 'Choose a valid "From" date.',
            'date_to.date_format' => 'Choose a valid "To" date.',
            'date_to.after_or_equal' => 'The "To" date cannot be before the "From" date.',
            'date_from.before_or_equal' => 'The "From" date cannot be after today.',
            'date_to.before_or_equal' => 'The "To" date cannot be after today.',
            'method.enum' => 'Choose Cash or GCash as the payment method.',
            'type.in' => 'Choose Orders or Preorders.',
            'status.in' => 'Choose Paid or Void.',
            'search.max' => 'The search may not be longer than 100 characters.',
            'group.in' => 'Choose By day or By month.',
            'page.integer' => 'Choose a valid page.',
            'page.min' => 'Choose a valid page.',
        ];
    }

    /**
     * The period's first and last moment; $default when no period was chosen.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    public function range(string $default = 'today'): array
    {
        $today = CarbonImmutable::now();

        return match ($this->period($default)) {
            'week' => [$today->startOfWeek(), $today->endOfDay()],
            'month' => [$today->startOfMonth(), $today->endOfDay()],
            'custom' => [
                CarbonImmutable::parse($this->string('date_from')->toString())->startOfDay(),
                CarbonImmutable::parse($this->string('date_to')->toString())->endOfDay(),
            ],
            default => [$today->startOfDay(), $today->endOfDay()],
        };
    }

    public function period(string $default = 'today'): string
    {
        return $this->string('period')->toString() ?: $default;
    }

    /**
     * @return array{period: string, date_from: string, date_to: string, method: string, type: string, status: string, search: string, group: string}
     */
    public function filters(string $defaultPeriod = 'today'): array
    {
        [$from, $to] = $this->range($defaultPeriod);

        return [
            'period' => $this->period($defaultPeriod),
            'date_from' => $from->toDateString(),
            'date_to' => $to->toDateString(),
            'method' => $this->string('method')->toString(),
            'type' => $this->string('type')->toString(),
            'status' => $this->string('status')->toString(),
            'search' => trim($this->string('search')->toString()),
            'group' => $this->string('group')->toString() ?: 'day',
        ];
    }
}
