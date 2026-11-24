<?php

namespace App\Http\Requests;

use App\Enums\AdminDeliveryTab;
use App\Services\Reports\SchoolCalendar;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The School Admin dashboard's Deliveries tab, Order # search and Top
 * sellers period, read from the page address.
 */
class FilterAdminDashboardRequest extends FormRequest
{
    public const PERIODS = SchoolCalendar::PERIODS;

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

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'tab' => 'Choose Awaiting Delivery, Partially Received or Completed.',
            'search' => 'Type an Order # of up to 40 characters.',
            'period' => 'Choose Today, This week, This month, This semester, This school year or All time.',
        ];
    }

    /** The Sales period: this month by default (panel revision D2), or another of SchoolCalendar's. */
    public function period(): string
    {
        $period = (string) $this->input('period', '');

        return in_array($period, self::PERIODS, true) ? $period : SchoolCalendar::DEFAULT_PERIOD;
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
