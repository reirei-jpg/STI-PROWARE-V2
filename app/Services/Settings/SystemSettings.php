<?php

namespace App\Services\Settings;

use App\Models\Setting;

/**
 * Every setting the Specialist can change on the Maintenance page: the
 * rules of PROWARE that may change over time, so they change without
 * touching the code. Each has its area, name, what it controls, an
 * example, its choices (a number from a list, or a short text) and its
 * default, used until it is changed.
 *
 * @phpstan-type Definition array{area: string, label: string, description: string, example: string, type: 'choice'|'text', choices?: list<int>, unit?: string, format?: 'hour', default: int|string, max_length?: int, saved_note?: string}
 */
final class SystemSettings
{
    public const ORDER_HOLD_DAYS = 'order_hold_days';

    public const ORDER_PAUSE_AFTER_EXPIRED = 'order_pause_after_expired';

    public const ORDER_PAUSE_DAYS = 'order_pause_days';

    public const CART_MAX_PER_ITEM = 'cart_max_per_item';

    public const DELIVERY_FOLLOW_UP_DAYS = 'delivery_follow_up_days';

    public const SLOW_MOVING_DAYS = 'slow_moving_days';

    public const SALE_MAX_DAYS = 'sale_max_days';

    public const DEFAULT_LOW_STOCK_ALERT = 'default_low_stock_alert';

    public const PROMO_GROUP_SIZE = 'promo_group_size';

    public const SLIP_SCHOOL_NAME = 'slip_school_name';

    public const SLIP_ADDRESS_LINE_1 = 'slip_address_line_1';

    public const SLIP_ADDRESS_LINE_2 = 'slip_address_line_2';

    public const REMINDER_HOUR = 'reminder_hour';

    /** The areas, in the order the Maintenance page shows them. */
    public const AREAS = ['Orders', 'Deliveries', 'Products & Sales', 'Free Uniforms', 'Issuance Slip', 'Reminders'];

    /**
     * @return array<string, Definition>
     */
    public static function definitions(): array
    {
        return [
            self::ORDER_HOLD_DAYS => [
                'area' => 'Orders',
                'label' => 'Days an order holds its items',
                'description' => 'A new order sets its items aside for the student. Not shown with its slip and paid within this many days, it expires and the items go back on sale.',
                'example' => 'With 2 days, an order placed on Monday must be picked up by the end of Wednesday.',
                'type' => 'choice',
                'choices' => [1, 2, 3],
                'unit' => 'days',
                'default' => 2,
                'saved_note' => 'Orders already placed keep their pick-up date.',
            ],
            self::ORDER_PAUSE_AFTER_EXPIRED => [
                'area' => 'Orders',
                'label' => 'Expired orders before ordering is paused',
                'description' => 'A student whose orders expire this many times within 30 days cannot place orders for a while.',
                'example' => 'With 3, a student who does not pick up 3 orders in a month is paused.',
                'type' => 'choice',
                'choices' => [2, 3, 4, 5],
                'unit' => 'expired orders',
                'default' => 3,
            ],
            self::ORDER_PAUSE_DAYS => [
                'area' => 'Orders',
                'label' => 'How long ordering is paused',
                'description' => 'How many days a paused student cannot place orders. You can lift a pause early on Student Orders.',
                'example' => 'With 7 days, a student paused on Monday can order again the next Monday.',
                'type' => 'choice',
                'choices' => [3, 5, 7, 14],
                'unit' => 'days',
                'default' => 7,
            ],
            self::CART_MAX_PER_ITEM => [
                'area' => 'Orders',
                'label' => 'Most of one item per student',
                'description' => 'The most pieces (or packs) of one item a student can add to the cart or preorder at once. For more, they talk to the PROWARE office.',
                'example' => 'With 99, a student can order up to 99 of the STI Lanyard, if that many are in stock.',
                'type' => 'choice',
                'choices' => [10, 20, 50, 99],
                'unit' => 'per item',
                'default' => 99,
            ],
            self::DELIVERY_FOLLOW_UP_DAYS => [
                'area' => 'Deliveries',
                'label' => 'Days before a purchase order is followed up',
                'description' => 'Head Office gives no delivery date. A purchase order not fully delivered this many days after its Date Ordered shows as Not complete on Deliveries and the dashboards.',
                'example' => 'With 30 days, an order dated Sep 29 that has not fully arrived shows from Oct 29.',
                'type' => 'choice',
                'choices' => [14, 21, 30, 45, 60],
                'unit' => 'days',
                'default' => 30,
            ],
            self::SLOW_MOVING_DAYS => [
                'area' => 'Products & Sales',
                'label' => 'Days without a sale before an item is slow-moving',
                'description' => 'An item in stock that has not sold for this many days shows as slow-moving on Products and the dashboard, so you can put it on sale.',
                'example' => 'With 18 days, an item last sold on Oct 1 is slow-moving from Oct 19.',
                'type' => 'choice',
                'choices' => [7, 14, 18, 30, 60],
                'unit' => 'days',
                'default' => 18,
            ],
            self::SALE_MAX_DAYS => [
                'area' => 'Products & Sales',
                'label' => 'Longest a sale can run',
                'description' => 'The most days you can put an item on sale at once. You can extend a sale before it ends.',
                'example' => 'With 90 days, a sale started on Oct 1 can run until the end of Dec 29.',
                'type' => 'choice',
                'choices' => [30, 60, 90],
                'unit' => 'days',
                'default' => 90,
                'saved_note' => 'Sales already running keep their end date.',
            ],
            self::DEFAULT_LOW_STOCK_ALERT => [
                'area' => 'Products & Sales',
                'label' => 'Low-stock warning for new products',
                'description' => 'The number of pieces a new product starts with for its low-stock warning. You can change it on each product.',
                'example' => 'With 5 pcs, you are told when a new product is down to 5 pieces.',
                'type' => 'choice',
                'choices' => [1, 3, 5, 10, 20],
                'unit' => 'pcs',
                'default' => 5,
                'saved_note' => 'Products already saved keep their own number.',
            ],
            self::PROMO_GROUP_SIZE => [
                'area' => 'Free Uniforms',
                'label' => 'Students needed for free uniforms',
                'description' => 'Students who enroll together in a group of at least this many each get one uniform set for free. Record them on the Free Uniforms page.',
                'example' => 'With 5, five friends who enroll on the same day each get a set. A group of 4 does not.',
                'type' => 'choice',
                'choices' => range(2, 10),
                'unit' => 'students',
                'default' => 5,
                'saved_note' => 'Groups already recorded stay as they are.',
            ],
            self::SLIP_SCHOOL_NAME => [
                'area' => 'Issuance Slip',
                'label' => 'School name on the slip',
                'description' => 'The school name printed at the top of every issuance slip, on the website and the phone.',
                'example' => 'STI COLLEGE-ORMOC, INC.',
                'type' => 'text',
                'default' => 'STI COLLEGE-ORMOC, INC.',
                'max_length' => 100,
            ],
            self::SLIP_ADDRESS_LINE_1 => [
                'area' => 'Issuance Slip',
                'label' => 'School address on the slip (line 1)',
                'description' => 'The first address line under the school name on every issuance slip.',
                'example' => 'Ormoc Centrum Bldg., Barangay South 6541',
                'type' => 'text',
                'default' => 'Ormoc Centrum Bldg., Barangay South 6541',
                'max_length' => 120,
            ],
            self::SLIP_ADDRESS_LINE_2 => [
                'area' => 'Issuance Slip',
                'label' => 'School address on the slip (line 2)',
                'description' => 'The second address line under the school name on every issuance slip.',
                'example' => 'Ormoc City, Leyte Philippines',
                'type' => 'text',
                'default' => 'Ormoc City, Leyte Philippines',
                'max_length' => 120,
            ],
            self::REMINDER_HOUR => [
                'area' => 'Reminders',
                'label' => 'Time reminders are sent',
                'description' => 'From this time each day, PROWARE sends its reminders: a sale ending tomorrow, and an order on its last day to be picked up.',
                'example' => 'With 7:00 AM, nobody is notified in the middle of the night.',
                'type' => 'choice',
                'choices' => [6, 7, 8, 9, 10],
                'format' => 'hour',
                'default' => 7,
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

    public static function exists(string $key): bool
    {
        return array_key_exists($key, self::definitions());
    }

    /** A number setting: what was chosen, or its default. */
    public static function integer(string $key): int
    {
        $definition = self::definition($key);
        $default = (int) $definition['default'];
        $value = Setting::integer($key, $default);

        return in_array($value, $definition['choices'] ?? [], true) ? $value : $default;
    }

    /** A text setting: what was typed, or its default. */
    public static function text(string $key): string
    {
        $value = trim((string) Setting::query()->find($key)?->value);

        return $value !== '' ? $value : (string) self::definition($key)['default'];
    }

    /** The setting's current value as people read it: "2 days", "7:00 AM". */
    public static function display(string $key): string
    {
        $definition = self::definition($key);

        return $definition['type'] === 'text'
            ? self::text($key)
            : self::format(self::integer($key), $definition);
    }

    /**
     * A choice as people read it.
     *
     * @param  Definition  $definition
     */
    public static function format(int $value, array $definition): string
    {
        if (($definition['format'] ?? null) === 'hour') {
            return ($value % 12 === 0 ? 12 : $value % 12).':00 '.($value < 12 ? 'AM' : 'PM');
        }

        $unit = $definition['unit'] ?? '';

        // "1 day", not "1 days".
        if ($value === 1 && str_ends_with($unit, 's') && ! str_contains($unit, ' ')) {
            $unit = substr($unit, 0, -1);
        }

        return trim("{$value} {$unit}");
    }

    /**
     * Every setting for the Maintenance page, by area, with its current
     * value, its choices and who changed it last.
     *
     * @return list<array{key: string, area: string, label: string, description: string, example: string, type: string, choices: list<array{value: int, label: string}>, max_length: int|null, value: int|string, display: string, is_default: bool, changed_at: string|null, changed_by: string|null}>
     */
    public static function rows(): array
    {
        $rows = [];

        foreach (self::definitions() as $key => $definition) {
            $value = $definition['type'] === 'text' ? self::text($key) : self::integer($key);

            $rows[] = [
                'key' => $key,
                'area' => $definition['area'],
                'label' => $definition['label'],
                'description' => $definition['description'],
                'example' => $definition['example'],
                'type' => $definition['type'],
                'choices' => array_map(fn (int $choice): array => ['value' => $choice, 'label' => self::format($choice, $definition)], $definition['choices'] ?? []),
                'max_length' => $definition['max_length'] ?? null,
                'value' => $value,
                'display' => self::display($key),
                'is_default' => $value === $definition['default'],
                ...Setting::lastChange($key),
            ];
        }

        return $rows;
    }
}
