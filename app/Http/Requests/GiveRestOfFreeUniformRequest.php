<?php

namespace App\Http\Requests;

use App\Models\FreeUniformStudent;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Give the rest of a student's free set: the pieces still to give, each in
 * the size recorded for the student. No other size can be given.
 */
class GiveRestOfFreeUniformRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'top_variant_id' => ['nullable', 'integer'],
            'pants_variant_id' => ['nullable', 'integer'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $only = "Only the size recorded for {$this->student()->name} can be given.";

        return [
            'top_variant_id.integer' => $only,
            'pants_variant_id.integer' => $only,
        ];
    }

    /**
     * Something must still be to give, and a size sent must be the one
     * recorded for the student.
     *
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $student = $this->student();

                if (! $student->isStillOwed()) {
                    $validator->errors()->add('pieces', "{$student->name} already got the whole set.");

                    return;
                }

                foreach (['top' => $student->top_variant_id, 'pants' => $student->pants_variant_id] as $piece => $recorded) {
                    $sent = $this->input("{$piece}_variant_id");

                    if ($sent !== null && $sent !== '' && (int) $sent !== $recorded) {
                        $validator->errors()->add("{$piece}_variant_id", "Only the size recorded for {$student->name} can be given.");
                    }
                }
            },
        ];
    }

    public function student(): FreeUniformStudent
    {
        /** @var FreeUniformStudent $student */
        $student = $this->route('student');

        return $student;
    }
}
