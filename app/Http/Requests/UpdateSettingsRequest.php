<?php

namespace App\Http\Requests;

use App\Services\Settings\SystemSettings;
use Illuminate\Contracts\Validation\Validator as ValidatorContract;
use Illuminate\Foundation\Http\FormRequest;
use Inertia\Inertia;

/**
 * The Maintenance page's form: every setting at once, each one of its
 * choices (or text within its length). Only the Specialist reaches it
 * (route middleware).
 */
class UpdateSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return SystemSettings::rules();
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return SystemSettings::messages();
    }

    protected function failedValidation(ValidatorContract $validator): void
    {
        $problems = count($validator->errors()->keys());

        Inertia::flash('toast', [
            'type' => 'error',
            'message' => 'The settings were not saved. Correct the '.($problems === 1 ? 'highlighted setting' : "{$problems} highlighted settings").'.',
        ]);

        parent::failedValidation($validator);
    }
}
