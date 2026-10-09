<?php

namespace App\Models;

use App\Enums\UniformTop;
use Database\Factories\FreeUniformStudentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One student of a free uniform group: who they are (name and enrollment
 * form #, the proof they enrolled), the set they got and its sizes. Each
 * piece given out has its stock movement ("Free (promo)"); a piece still
 * to give (it was out of stock) has none yet.
 *
 * @property int $id
 * @property int $free_uniform_group_id
 * @property int $uniform_set_id
 * @property string $name
 * @property string $enrollment_form_number
 * @property string|null $course_section
 * @property UniformTop $top_kind
 * @property int $top_variant_id
 * @property int $pants_variant_id
 * @property int|null $top_movement_id
 * @property int|null $pants_movement_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read FreeUniformGroup $group
 * @property-read UniformSet $uniformSet
 * @property-read ProductVariant $topVariant
 * @property-read ProductVariant $pantsVariant
 */
#[Fillable(['free_uniform_group_id', 'uniform_set_id', 'name', 'enrollment_form_number', 'course_section', 'top_kind', 'top_variant_id', 'pants_variant_id', 'top_movement_id', 'pants_movement_id'])]
class FreeUniformStudent extends Model
{
    /** @use HasFactory<FreeUniformStudentFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'top_kind' => UniformTop::class,
        ];
    }

    /**
     * @return BelongsTo<FreeUniformGroup, $this>
     */
    public function group(): BelongsTo
    {
        return $this->belongsTo(FreeUniformGroup::class, 'free_uniform_group_id');
    }

    /**
     * @return BelongsTo<UniformSet, $this>
     */
    public function uniformSet(): BelongsTo
    {
        return $this->belongsTo(UniformSet::class);
    }

    /**
     * @return BelongsTo<ProductVariant, $this>
     */
    public function topVariant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'top_variant_id');
    }

    /**
     * @return BelongsTo<ProductVariant, $this>
     */
    public function pantsVariant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'pants_variant_id');
    }

    /** True while the top or the pants is not given yet (it was out of stock). */
    public function isStillOwed(): bool
    {
        return $this->top_movement_id === null || $this->pants_movement_id === null;
    }

    /**
     * Students with a piece still to give.
     *
     * @param  Builder<self>  $query
     */
    #[Scope]
    protected function stillOwed(Builder $query): void
    {
        $query->where(fn (Builder $inner) => $inner->whereNull('top_movement_id')->orWhereNull('pants_movement_id'));
    }
}
