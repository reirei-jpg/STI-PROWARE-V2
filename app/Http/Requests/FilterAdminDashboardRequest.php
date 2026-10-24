<?php

namespace App\Http\Requests;

use App\Enums\AdminDeliveryTab;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The School Admin dashboard's Deliveries tab, Order # search and Top
 * sellers period, read from the page address.
 */
class FilterAdminDashboardRequest extends FormRequest
{
    public const PERIODS = ['week', 'month', 'year'];

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'tab' => ['nullable', Rule::enum(AdminDeliveryTab::class)],
            'search' => ['nullable', 'string', 'max:40'],
            'period' => ['nullable', Rule::in(self::PERIODS)],
        ];
    }

    /** The Top sellers period: this week, this month (the default) or this year. */
    public function period(): string
    {
        $period = (string) $this->input('period', '');

        return in_array($period, self::PERIODS, true) ? $period : 'month';
    }

    /** Ongoing unless another tab is chosen. */
    public function tab(): AdminDeliveryTab
    {
        return AdminDeliveryTab::tryFrom((string) $this->input('tab')) ?? AdminDeliveryTab::Ongoing;
    }

    /**
     * The Order # being searched for; "#30722" and "30722" both work.
     */
    public function search(): ?string
    {
        $search = trim(ltrim(trim((string) $this->input('search', '')), '#'));

        return $search === '' ? null : $search;
    }
}
