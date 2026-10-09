<?php

namespace App\Models;

use Database\Factories\FreeUniformGroupFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A group of students who enrolled together and so each got one uniform
 * set for free (the enrollment promo), recorded by the Specialist.
 *
 * @property int $id
 * @property Carbon $enrolled_on
 * @property string|null $note
 * @property int $recorded_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $recorder
 */
#[Fillable(['enrolled_on', 'note', 'recorded_by'])]
class FreeUniformGroup extends Model
{
    /** @use HasFactory<FreeUniformGroupFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'enrolled_on' => 'date',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    /**
     * @return HasMany<FreeUniformStudent, $this>
     */
    public function students(): HasMany
    {
        return $this->hasMany(FreeUniformStudent::class)->orderBy('id');
    }
}
