<?php

namespace App\Enums;

/**
 * Why an order is cancelled, picked from a list like in online shops: the
 * student's reasons when they cancel their own order, the Specialist's when
 * the office cancels one. Other asks them to write why. The same lists are
 * in the website (lib/cancel-reasons.ts) and the phone app
 * (mobile/lib/cancel-reasons.ts).
 */
enum CancelReason: string
{
    // The student's reasons.
    case WrongSizeOrColor = 'wrong_size_or_color';
    case ChangeItems = 'change_items';
    case OrderedByMistake = 'ordered_by_mistake';
    case CannotPickUp = 'cannot_pick_up';
    case NoLongerNeeded = 'no_longer_needed';

    // The Specialist's reasons.
    case ItemDamaged = 'item_damaged';
    case NotEnoughStock = 'not_enough_stock';
    case StudentAsked = 'student_asked';
    case DuplicateOrder = 'duplicate_order';

    // Both.
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::WrongSizeOrColor => 'I ordered the wrong size or color',
            self::ChangeItems => 'I want to change the items or how many',
            self::OrderedByMistake => 'I ordered by mistake',
            self::CannotPickUp => 'I cannot pick it up in time',
            self::NoLongerNeeded => 'I no longer need it',
            self::ItemDamaged => 'The item is damaged',
            self::NotEnoughStock => 'Not enough stock (the count was wrong)',
            self::StudentAsked => 'The student asked to cancel',
            self::DuplicateOrder => 'The student ordered the same thing twice',
            self::Other => 'Other',
        };
    }

    /**
     * The reasons a student can pick.
     *
     * @return list<self>
     */
    public static function forStudent(): array
    {
        return [self::WrongSizeOrColor, self::ChangeItems, self::OrderedByMistake, self::CannotPickUp, self::NoLongerNeeded, self::Other];
    }

    /**
     * The reasons the Specialist can pick.
     *
     * @return list<self>
     */
    public static function forStaff(): array
    {
        return [self::ItemDamaged, self::NotEnoughStock, self::StudentAsked, self::DuplicateOrder, self::Other];
    }

    /**
     * What is kept as the order's cancel reason: the reason, or what they
     * wrote for Other.
     */
    public function describe(?string $note): string
    {
        $note = trim((string) $note);

        return $this === self::Other ? $note : $this->label().($note !== '' ? " ({$note})" : '');
    }
}
