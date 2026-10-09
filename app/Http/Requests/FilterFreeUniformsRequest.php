<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The filters on the Free Uniforms page, read from the page address: all
 * groups or only those with a piece still to give, a student's name or
 * Enrollment Form # to look for, and which group's details to load.
 */
class FilterFreeUniformsRequest extends FormRequest
{
    public const SHOWS = ['all', 'still_to_give'];

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'show' => ['nullable', Rule::in(self::SHOWS)],
            'search' => ['nullable', 'string', 'max:120'],
            'details' => ['nullable', 'integer'],
        ];
    }

    public function show(): string
    {
        return $this->string('show')->toString() ?: 'all';
    }

    public function search(): ?string
    {
        $search = trim((string) $this->input('search', ''));

        return $search === '' ? null : $search;
    }
}
