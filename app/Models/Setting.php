<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A setting the Specialist can change on the Maintenance page, by name,
 * with who changed it last. A missing setting uses the default its reader
 * gives.
 *
 * @property string $key
 * @property string $value
 * @property int|null $updated_by
 * @property CarbonImmutable|null $updated_at
 * @property-read User|null $updater
 */
#[Fillable(['key', 'value', 'updated_by'])]
class Setting extends Model
{
    public const ORDER_HOLD_DAYS = 'order_hold_days';

    public const DELIVERY_FOLLOW_UP_DAYS = 'delivery_follow_up_days';

    protected $primaryKey = 'key';

    protected $keyType = 'string';

    public $incrementing = false;

    /**
     * @return BelongsTo<User, $this>
     */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public static function integer(string $key, int $default): int
    {
        $value = self::query()->find($key)?->value;

        return is_numeric($value) ? (int) $value : $default;
    }

    public static function put(string $key, string|int $value, ?User $by = null): void
    {
        self::query()->updateOrCreate(['key' => $key], ['value' => (string) $value, 'updated_by' => $by?->id]);
    }

    /**
     * When the setting was last changed and by whom; nulls while it still
     * uses its default.
     *
     * @return array{changed_at: string|null, changed_by: string|null}
     */
    public static function lastChange(string $key): array
    {
        $setting = self::query()->with('updater')->find($key);

        return [
            'changed_at' => $setting?->updated_at?->toIso8601String(),
            'changed_by' => $setting?->updater?->name,
        ];
    }
}
