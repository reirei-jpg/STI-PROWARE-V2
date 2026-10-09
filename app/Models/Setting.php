<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * A setting the Specialist can change, by name. A missing setting uses the
 * default its reader gives.
 *
 * @property string $key
 * @property string $value
 */
#[Fillable(['key', 'value'])]
class Setting extends Model
{
    public const ORDER_HOLD_DAYS = 'order_hold_days';

    protected $primaryKey = 'key';

    protected $keyType = 'string';

    public $incrementing = false;

    public static function integer(string $key, int $default): int
    {
        $value = self::query()->find($key)?->value;

        return is_numeric($value) ? (int) $value : $default;
    }

    public static function put(string $key, string|int $value): void
    {
        self::query()->updateOrCreate(['key' => $key], ['value' => (string) $value]);
    }
}
