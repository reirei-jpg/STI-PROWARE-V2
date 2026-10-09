<?php

namespace App\Http\Requests;

use App\Enums\UniformTop;
use App\Models\ProductVariant;
use App\Models\UniformSet;
use App\Services\FreeUniforms\PromoRules;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * The Record a group pop-up: the date the students enrolled together, and
 * each student (at least the promo's group size) with the set they get:
 * name, Enrollment Form # (one free set per form #), course / section, the
 * course's set, Blouse or Polo and its size, and the pants' size.
 */
class RecordFreeUniformGroupRequest extends FormRequest
{
    /** The most students in one group; a bigger group is recorded as two. */
    public const MAX_STUDENTS = 30;

    /**
     * Tidy what was typed: names without extra spaces, and the Enrollment
     * Form # in capitals, so "ef-123 " and "EF-123" are the same form.
     */
    protected function prepareForValidation(): void
    {
        $students = $this->input('students');

        if (! is_array($students)) {
            return;
        }

        $this->merge(['students' => array_map(function (mixed $student): mixed {
            if (! is_array($student)) {
                return $student;
            }

            foreach (['name', 'enrollment_form_number', 'course_section'] as $field) {
                if (is_string($student[$field] ?? null)) {
                    $student[$field] = preg_replace('/\s+/', ' ', trim($student[$field]));
                }
            }

            if (is_string($student['enrollment_form_number'] ?? null)) {
                $student['enrollment_form_number'] = mb_strtoupper($student['enrollment_form_number']);
            }

            return $student;
        }, $students)]);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'enrolled_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'note' => ['nullable', 'string', 'max:200'],
            'students' => ['required', 'array', 'min:'.PromoRules::groupSize(), 'max:'.self::MAX_STUDENTS],
            'students.*.name' => ['required', 'string', 'max:120'],
            'students.*.enrollment_form_number' => ['required', 'string', 'max:40', 'distinct', Rule::unique('free_uniform_students', 'enrollment_form_number')],
            'students.*.course_section' => ['nullable', 'string', 'max:60'],
            'students.*.uniform_set_id' => ['required', 'integer', Rule::exists('uniform_sets', 'id')],
            'students.*.top_kind' => ['required', Rule::enum(UniformTop::class)],
            'students.*.top_variant_id' => ['required', 'integer'],
            'students.*.pants_variant_id' => ['required', 'integer'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $size = PromoRules::groupSize();
        $fewest = "Add at least {$size} students. The promo is for groups of at least {$size} who enroll together.";

        return [
            'enrolled_on.required' => 'Enter the date they enrolled.',
            'enrolled_on.date_format' => 'Choose a valid date.',
            'enrolled_on.before_or_equal' => 'The enrollment date cannot be in the future.',
            'note.max' => 'Keep the note to 200 characters or less.',
            'students.required' => $fewest,
            'students.min' => $fewest,
            'students.max' => 'A group can have at most '.self::MAX_STUDENTS.' students. Record a bigger group as two groups.',
            'students.*.name.required' => 'Enter the student\'s name.',
            'students.*.name.max' => 'Keep the name to 120 characters or less.',
            'students.*.enrollment_form_number.required' => 'Enter the student\'s Enrollment Form #.',
            'students.*.enrollment_form_number.max' => 'Keep the Enrollment Form # to 40 characters or less.',
            'students.*.enrollment_form_number.distinct' => 'This Enrollment Form # is typed twice in this group.',
            'students.*.enrollment_form_number.unique' => 'Enrollment Form # :input already got a free set.',
            'students.*.course_section.max' => 'Keep the course / section to 60 characters or less.',
            'students.*.uniform_set_id.required' => 'Choose the uniform set, e.g. BSIT.',
            'students.*.uniform_set_id.exists' => 'Choose one of the uniform sets.',
            'students.*.top_kind.required' => 'Choose Blouse or Polo.',
            'students.*.top_kind.enum' => 'Choose Blouse or Polo.',
            'students.*.top_variant_id.required' => 'Choose the size of the top.',
            'students.*.pants_variant_id.required' => 'Choose the size of the pants.',
        ];
    }

    /**
     * Each student's top and pants must be sizes of their set's products.
     *
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                /** @var array<int, array<string, mixed>> $students */
                $students = (array) $this->input('students', []);
                $sets = UniformSet::query()->whereKey(array_column($students, 'uniform_set_id'))->get()->keyBy('id');

                foreach ($students as $index => $student) {
                    if ($validator->errors()->hasAny(["students.{$index}.uniform_set_id", "students.{$index}.top_kind"])) {
                        continue;
                    }

                    /** @var UniformSet $set */
                    $set = $sets->get((int) $student['uniform_set_id']);
                    $top = UniformTop::from((string) $student['top_kind']);
                    $topProductId = $set->topProductId($top);

                    if ($topProductId === null) {
                        $validator->errors()->add("students.{$index}.top_kind", "The {$set->name} set has no ".mb_strtolower($top->label()).'. Choose the other top, or add it to the set.');
                    } elseif (! self::isSizeOf($student['top_variant_id'] ?? null, $topProductId)) {
                        $validator->errors()->add("students.{$index}.top_variant_id", 'Choose the size of the '.mb_strtolower($top->label()).'.');
                    }

                    if ($set->pants_product_id === null) {
                        $validator->errors()->add("students.{$index}.pants_variant_id", "The {$set->name} set has no pants yet. Add them in Uniform sets.");
                    } elseif (! self::isSizeOf($student['pants_variant_id'] ?? null, $set->pants_product_id)) {
                        $validator->errors()->add("students.{$index}.pants_variant_id", 'Choose the size of the pants.');
                    }
                }
            },
        ];
    }

    /**
     * The students as the action takes them.
     *
     * @return list<array{name: string, enrollment_form_number: string, course_section: string|null, uniform_set_id: int, top_kind: string, top_variant_id: int, pants_variant_id: int}>
     */
    public function students(): array
    {
        /** @var array<int, array<string, mixed>> $students */
        $students = (array) $this->validated('students');

        return array_values(array_map(fn (array $student): array => [
            'name' => (string) $student['name'],
            'enrollment_form_number' => (string) $student['enrollment_form_number'],
            'course_section' => is_string($student['course_section'] ?? null) && $student['course_section'] !== '' ? $student['course_section'] : null,
            'uniform_set_id' => (int) $student['uniform_set_id'],
            'top_kind' => (string) $student['top_kind'],
            'top_variant_id' => (int) $student['top_variant_id'],
            'pants_variant_id' => (int) $student['pants_variant_id'],
        ], $students));
    }

    /**
     * The note, trimmed; null when left empty.
     */
    public function note(): ?string
    {
        $note = trim((string) $this->input('note'));

        return $note === '' ? null : $note;
    }

    private static function isSizeOf(mixed $variantId, int $productId): bool
    {
        return is_numeric($variantId) && ProductVariant::query()->whereKey((int) $variantId)->where('product_id', $productId)->exists();
    }
}
