<?php

namespace App\Http\Requests;

use App\Models\FreeUniformStudent;
use App\Models\ProductVariant;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Give the rest of a student's free set: the pieces still to give, each in
 * the size chosen (the one recorded, or another size of the same product).
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
     * Something must still be to give, and a size must be one of the same
     * top's or pants' sizes.
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

                foreach (['top' => $student->topVariant->product_id, 'pants' => $student->pantsVariant->product_id] as $piece => $productId) {
                    $chosen = $this->input("{$piece}_variant_id");

                    if ($chosen !== null && ! ProductVariant::query()->whereKey((int) $chosen)->where('product_id', $productId)->exists()) {
                        $validator->errors()->add("{$piece}_variant_id", 'Choose one of the sizes shown.');
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

    public function topVariantId(): ?int
    {
        return $this->filled('top_variant_id') ? $this->integer('top_variant_id') : null;
    }

    public function pantsVariantId(): ?int
    {
        return $this->filled('pants_variant_id') ? $this->integer('pants_variant_id') : null;
    }
}
