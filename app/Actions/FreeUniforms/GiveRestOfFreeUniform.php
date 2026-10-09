<?php

namespace App\Actions\FreeUniforms;

use App\Models\FreeUniformStudent;
use App\Models\User;
use App\Services\FreeUniforms\FreeUniformStock;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Gives a student the pieces of their free set that were out of stock
 * when the group was recorded, now that they arrived. The size may be
 * changed (another size of the same top or pants), e.g. when theirs is
 * still out of stock and the student agrees to another.
 */
class GiveRestOfFreeUniform
{
    public function __construct(private FreeUniformStock $stock) {}

    /**
     * Gives what is in stock now; the rest stays still to give.
     *
     * @return array{given: int, still_to_give: list<string>}
     *
     * @throws ValidationException when nothing could be given (all still out of stock)
     */
    public function handle(FreeUniformStudent $student, User $givenBy, ?int $topVariantId, ?int $pantsVariantId): array
    {
        return DB::transaction(function () use ($student, $givenBy, $topVariantId, $pantsVariantId): array {
            $locked = FreeUniformStudent::query()->lockForUpdate()->findOrFail($student->id);

            if ($locked->top_movement_id === null && $topVariantId !== null) {
                $locked->top_variant_id = $topVariantId;
            }

            if ($locked->pants_movement_id === null && $pantsVariantId !== null) {
                $locked->pants_variant_id = $pantsVariantId;
            }

            $result = $this->stock->giveMissing($locked->load(['uniformSet', 'topVariant', 'pantsVariant']), $givenBy);

            if ($result['given'] === 0 && $result['still_to_give'] !== []) {
                throw ValidationException::withMessages([
                    'pieces' => 'Still out of stock: '.implode(', ', $result['still_to_give']).'. Choose another size, or give it when it arrives.',
                ]);
            }

            return $result;
        });
    }
}
