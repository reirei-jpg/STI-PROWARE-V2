<?php

namespace App\Actions\FreeUniforms;

use App\Models\FreeUniformStudent;
use App\Models\User;
use App\Services\FreeUniforms\FreeUniformStock;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Gives a student the pieces of their free set that were out of stock
 * when the group was recorded, now that they arrived. Only the size
 * recorded for the student is given (user's decision, 20 Nov 2026).
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
    public function handle(FreeUniformStudent $student, User $givenBy): array
    {
        return DB::transaction(function () use ($student, $givenBy): array {
            $locked = FreeUniformStudent::query()->lockForUpdate()->findOrFail($student->id);

            $result = $this->stock->giveMissing($locked->load(['uniformSet', 'topVariant', 'pantsVariant']), $givenBy);

            if ($result['given'] === 0 && $result['still_to_give'] !== []) {
                throw ValidationException::withMessages([
                    'pieces' => 'Still out of stock: '.implode(', ', $result['still_to_give']).'. Give it after Stock In.',
                ]);
            }

            return $result;
        });
    }
}
