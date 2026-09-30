<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * An eStore order to scan: the order details email pasted as text, or a
 * saved copy of it uploaded as a file.
 */
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
            'email_text' => ['required_without:document', 'nullable', 'string', 'max:200000'],
            'document' => ['required_without:email_text', 'nullable', 'file', 'max:5120'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'email_text.required_without' => 'Paste the order details email from the eStore.',
            'email_text.max' => 'That is too much text. Paste only the order details email.',
            'document.required_without' => 'Choose the order file to scan.',
            'document.file' => 'The file did not upload properly. Please try again.',
            'document.uploaded' => 'The file did not upload properly. Please try again.',
            'document.max' => 'The file is too large. Order files must be 5 MB or smaller.',
        ];
    }

    public function pastedText(): ?string
    {
        $text = $this->input('email_text');

        return is_string($text) && trim($text) !== '' ? $text : null;
    }
}
