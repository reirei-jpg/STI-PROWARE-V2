<?php

namespace App\Actions\FreeUniforms;

use App\Models\FreeUniformGroup;
use App\Models\User;
use App\Services\FreeUniforms\FreeUniformStock;
use Illuminate\Support\Facades\DB;

/**
 * Records a group of students who enrolled together: each gets one uniform
 * set for free (the enrollment promo). The pieces in stock leave it as
 * "Free (promo)"; the others are still to give until they arrive.
 */
class RecordFreeUniformGroup
{
    public function __construct(private FreeUniformStock $stock) {}

    /**
     * @param  list<array{name: string, enrollment_form_number: string, course_section: string|null, uniform_set_id: int, top_kind: string, top_variant_id: int, pants_variant_id: int}>  $students
     * @return array{group: FreeUniformGroup, given: int, still_to_give: list<string>} pieces given, and what is still to give (e.g. "Juan Dela Cruz: Polo M")
     */
    public function handle(User $recordedBy, string $enrolledOn, ?string $note, array $students): array
    {
        return DB::transaction(function () use ($recordedBy, $enrolledOn, $note, $students): array {
            $group = FreeUniformGroup::query()->create([
                'enrolled_on' => $enrolledOn,
                'note' => $note,
                'recorded_by' => $recordedBy->id,
            ]);

            $given = 0;
            $stillToGive = [];

            foreach ($students as $student) {
                $saved = $group->students()->create($student);
                $result = $this->stock->giveMissing($saved->load(['uniformSet', 'topVariant', 'pantsVariant']), $recordedBy);

                $given += $result['given'];

                foreach ($result['still_to_give'] as $piece) {
                    $stillToGive[] = "{$saved->name}: {$piece}";
                }
            }

            return ['group' => $group, 'given' => $given, 'still_to_give' => $stillToGive];
        });
    }
}
