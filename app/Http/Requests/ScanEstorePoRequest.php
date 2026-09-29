<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ScanEstorePoRequest extends FormRequest
{
    /**
     * Any file type is accepted here; the scanner decides whether it can read
     * it and explains when it cannot.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'document' => ['required', 'file', 'max:5120'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'document.required' => 'Choose the purchase order file to scan.',
            'document.file' => 'The purchase order file did not upload properly. Please try again.',
            'document.uploaded' => 'The purchase order file did not upload properly. Please try again.',
            'document.max' => 'The file is too large. Purchase order files must be 5 MB or smaller.',
        ];
    }
}
