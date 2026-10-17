<?php

namespace App\Services\Settings;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Validation\Rule;

/**
 * Every setting on the Maintenance page, in one place: its area, name, one
 * line of help, the choices (or the longest text) and its default. A value
 * that was never saved, or is no longer one of the choices, reads as the
 * default, so PROWARE always works with a sensible value.
 *
 * @phpstan-type Definition array{area: string, label: string, help: string, default: int|string, choices?: list<int>, unit?: array{0: string, 1: string}, max_length?: int, optional?: bool}
 */
final class SystemSettings
{
    public const AREAS = ['Orders', 'Deliveries', 'Products & Sales', 'Free Uniforms', 'Issuance Slip'];

    /**
     * @return array<string, Definition>
     */
    public static function definitions(): array
    {
        return [
            Setting::ORDER_HOLD_DAYS => [
                'area' => 'Orders',
                'label' => 'Days an order holds its items',
                'help' => 'Not released by then, an order expires and its items go back on sale. Orders already placed keep their date.',
                'choices' => [1, 2, 3],
                'unit' => ['day', 'days'],
                'default' => 2,
            ],
            Setting::ORDER_PAUSE_AFTER_EXPIRED => [
                'area' => 'Orders',
                'label' => 'Expired orders before ordering is paused',
                'help' => 'A student whose orders expire this many times cannot place orders for a while.',
                'choices' => [2, 3, 4, 5],
                'unit' => ['expired order', 'expired orders'],
                'default' => 3,
            ],
            Setting::ORDER_PAUSE_WINDOW_DAYS => [
                'area' => 'Orders',
                'label' => 'Expired orders counted within',
                'help' => 'Only orders that expired within this many days count toward the pause.',
                'choices' => [14, 30, 60],
                'unit' => ['day', 'days'],
                'default' => 30,
            ],
            Setting::ORDER_PAUSE_DAYS => [
                'area' => 'Orders',
                'label' => 'How long ordering is paused',
                'help' => 'Counted from the last expired order. A pause can still be lifted early on Student Orders.',
                'choices' => [3, 5, 7, 14],
                'unit' => ['day', 'days'],
                'default' => 7,
            ],
            Setting::CART_MAX_PER_ITEM => [
                'area' => 'Orders',
                'label' => 'Most of one item a student can order',
                'help' => 'For each size or color, in the cart and in a preorder. For more, the student asks the PROWARE office.',
                'choices' => [5, 10, 20, 50, 99],
                'unit' => ['pc', 'pcs'],
                'default' => 99,
            ],
            Setting::DELIVERY_FOLLOW_UP_DAYS => [
                'area' => 'Deliveries',
                'label' => 'Days before a purchase order is followed up',
                'help' => 'Orders not fully delivered this many days after their Date Ordered are shown to ask Head Office about.',
                'choices' => [14, 21, 30, 45, 60],
                'unit' => ['day', 'days'],
                'default' => 30,
            ],
            Setting::SLOW_MOVING_DAYS => [
                'area' => 'Products & Sales',
                'label' => 'Days without a sale before an item is slow-moving',
                'help' => 'Slow-moving items are suggested for Put on Sale on the dashboard and on Products.',
                'choices' => [7, 14, 18, 30, 60],
                'unit' => ['day', 'days'],
                'default' => 18,
            ],
            Setting::DEFAULT_LOW_STOCK_ALERT => [
                'area' => 'Products & Sales',
                'label' => 'Low-stock warning for new products',
                'help' => 'The number a new product starts with. Each product can still have its own.',
                'choices' => [1, 3, 5, 10, 20],
                'unit' => ['pc', 'pcs'],
                'default' => 5,
            ],
            Setting::PROMO_GROUP_SIZE => [
                'area' => 'Free Uniforms',
                'label' => 'Students needed for free uniforms',
                'help' => 'Students who enroll together in a group of at least this many each get one set. Groups already recorded stay as they are.',
                'choices' => [2, 3, 4, 5, 6, 7, 8, 9, 10],
                'unit' => ['student', 'students'],
                'default' => 5,
            ],
            Setting::SLIP_SCHOOL_NAME => [
                'area' => 'Issuance Slip',
                'label' => 'School name',
                'help' => 'Printed at the top of every issuance slip.',
                'max_length' => 80,
                'default' => 'STI COLLEGE-ORMOC, INC.',
            ],
            Setting::SLIP_ADDRESS_LINE_1 => [
                'area' => 'Issuance Slip',
                'label' => 'First address line',
                'help' => 'Printed under the school name.',
                'max_length' => 120,
                'default' => 'Ormoc Centrum Bldg., Barangay South 6541',
            ],
            Setting::SLIP_ADDRESS_LINE_2 => [
                'area' => 'Issuance Slip',
                'label' => 'Second address line',
                'help' => 'Can be left empty.',
                'max_length' => 120,
                'optional' => true,
                'default' => 'Ormoc City, Leyte Philippines',
            ],
        ];
    }

    /**
     * @return Definition
     */
    public static function definition(string $key): array
    {
        return self::definitions()[$key] ?? throw new \InvalidArgumentException("Unknown setting {$key}.");
    }

    /** A number setting: the saved choice, or its default. */
    public static function integer(string $key): int
    {
        $definition = self::definition($key);
        $value = Setting::integer($key, (int) $definition['default']);

        return in_array($value, $definition['choices'] ?? [], true) ? $value : (int) $definition['default'];
    }

    /** A text setting: the saved text (it may be empty when optional), or its default. */
    public static function text(string $key): string
    {
        $saved = Setting::query()->find($key)?->value;

        return $saved !== null ? $saved : (string) self::definition($key)['default'];
    }

    /**
     * "3 days", "1 expired order", "99 pcs".
     *
     * @param  Definition  $definition
     */
    public static function format(int $value, array $definition): string
    {
        [$one, $many] = $definition['unit'] ?? ['', ''];

        return trim($value.' '.($value === 1 ? $one : $many));
    }

    /**
     * The Maintenance page: each area with its settings, their value, the
     * choices and who changed them last.
     *
     * @return list<array{area: string, settings: list<array<string, mixed>>}>
     */
    public static function forPage(): array
    {
        $saved = Setting::query()->with('updater')->get()->keyBy('key');

        return array_map(fn (string $area): array => [
            'area' => $area,
            'settings' => array_map(
                function (string $key) use ($saved): array {
                    $definition = self::definition($key);
                    $isText = isset($definition['max_length']);
                    $value = $isText ? self::text($key) : self::integer($key);
                    $setting = $saved->get($key);

                    return [
                        'key' => $key,
                        'label' => $definition['label'],
                        'help' => $definition['help'],
                        'type' => $isText ? 'text' : 'choice',
                        'value' => $value,
                        'default' => $definition['default'],
                        'choices' => array_map(
                            fn (int $choice): array => ['value' => $choice, 'label' => self::format($choice, $definition)],
                            $definition['choices'] ?? [],
                        ),
                        'max_length' => $definition['max_length'] ?? null,
                        'changed_at' => $setting?->updated_at?->toIso8601String(),
                        'changed_by' => $setting?->updater?->name,
                    ];
                },
                array_keys(array_filter(self::definitions(), fn (array $definition): bool => $definition['area'] === $area)),
            ),
        ], self::AREAS);
    }

    /**
     * Validation for the page's form: one field per setting; a setting left
     * out of the request is not changed.
     *
     * @return array<string, list<mixed>>
     */
    public static function rules(): array
    {
        $rules = [];

        foreach (self::definitions() as $key => $definition) {
            $rules[$key] = isset($definition['max_length'])
                ? ['sometimes', ($definition['optional'] ?? false) ? 'nullable' : 'required', 'string', 'max:'.$definition['max_length']]
                : ['sometimes', 'required', 'integer', Rule::in($definition['choices'] ?? [])];
        }

        return $rules;
    }

    /**
     * "Choose 1, 2 or 3 days.", "Enter the school name.", "The school name
     * may not be longer than 80 characters."
     *
     * @return array<string, string>
     */
    public static function messages(): array
    {
        $messages = [];

        foreach (self::definitions() as $key => $definition) {
            if (isset($definition['max_length'])) {
                $messages["{$key}.required"] = 'Enter the '.strtolower($definition['label']).'.';
                $messages["{$key}.max"] = 'The '.strtolower($definition['label']).' may not be longer than '.$definition['max_length'].' characters.';

                continue;
            }

            $choices = $definition['choices'] ?? [];
            $isRun = count($choices) > 3 && $choices === range($choices[0], $choices[0] + count($choices) - 1);
            $listed = match (true) {
                $isRun => $choices[0].' to '.end($choices),
                count($choices) > 2 => implode(', ', array_slice($choices, 0, -1)).' or '.end($choices),
                default => implode(' or ', $choices),
            };
            $choose = 'Choose '.$listed.' '.($definition['unit'][1] ?? '').'.';

            foreach (['required', 'integer', 'in'] as $rule) {
                $messages["{$key}.{$rule}"] = str_replace(' .', '.', $choose);
            }
        }

        return $messages;
    }

    /**
     * Save the values that changed; returns the names of the settings saved.
     *
     * @param  array<string, mixed>  $values
     * @return list<string>
     */
    public static function save(array $values, User $by): array
    {
        $saved = [];

        foreach (self::definitions() as $key => $definition) {
            if (! array_key_exists($key, $values)) {
                continue;
            }

            $isText = isset($definition['max_length']);
            $new = $isText ? trim((string) ($values[$key] ?? '')) : (int) $values[$key];
            $current = $isText ? self::text($key) : self::integer($key);

            if ($new === $current) {
                continue;
            }

            Setting::put($key, $new, $by);
            $saved[] = $definition['label'];
        }

        return $saved;
    }
}
