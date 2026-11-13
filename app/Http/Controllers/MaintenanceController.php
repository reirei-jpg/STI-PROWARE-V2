<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\Setting;
use App\Models\User;
use App\Services\Dashboard\StockCards;
use App\Services\Deliveries\FollowUp;
use App\Services\FreeUniforms\PromoRules;
use App\Services\Shop\BuyerLimit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The Specialist's Maintenance page: settings that change how PROWARE
 * works without changing its code, each with who changed it last: after how many days
 * a purchase order not complete is to be followed up, how many students
 * must enroll together to get free uniforms, and the most of one item a
 * buyer can get (with the buyers the Specialist allowed more).
 */
class MaintenanceController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('maintenance/index', [
            'followUpDays' => [
                'value' => FollowUp::days(),
                'choices' => FollowUp::CHOICES,
                ...Setting::lastChange(Setting::DELIVERY_FOLLOW_UP_DAYS),
            ],
            'mostPerItem' => [
                'value' => BuyerLimit::everyone(),
                'min' => BuyerLimit::MIN,
                'max' => BuyerLimit::MAX,
                'default' => BuyerLimit::DEFAULT,
                ...Setting::lastChange(Setting::MOST_PER_ITEM),
            ],
            'buyersAllowedMore' => User::query()
                ->whereNotNull('most_per_item')
                ->orderBy('name')
                ->get(['id', 'name', 'email', 'most_per_item'])
                ->map(fn (User $buyer): array => ['id' => $buyer->id, 'name' => $buyer->name, 'email' => $buyer->email, 'most_per_item' => (int) $buyer->most_per_item])
                ->all(),
            'preordersBeforeOrdering' => [
                'value' => StockCards::preordersBeforeOrdering(),
                'min' => StockCards::MIN_PREORDERS_BEFORE_ORDERING,
                'max' => StockCards::MAX_PREORDERS_BEFORE_ORDERING,
                'default' => StockCards::DEFAULT_PREORDERS_BEFORE_ORDERING,
                ...Setting::lastChange(Setting::PREORDERS_BEFORE_ORDERING),
            ],
            'promoGroupSize' => [
                'value' => PromoRules::groupSize(),
                'min' => PromoRules::MIN_GROUP_SIZE,
                'max' => PromoRules::MAX_GROUP_SIZE,
                ...Setting::lastChange(Setting::PROMO_GROUP_SIZE),
            ],
        ]);
    }

    /**
     * After how many days from its Date Ordered a purchase order not
     * complete is shown to follow up with Head Office.
     */
    public function updateFollowUpDays(Request $request): RedirectResponse
    {
        // "14, 21, 30, 45 or 60"
        $choices = implode(', ', array_slice(FollowUp::CHOICES, 0, -1)).' or '.FollowUp::CHOICES[array_key_last(FollowUp::CHOICES)];
        $message = "Choose {$choices} days.";
        $days = (int) $request->validate(
            ['follow_up_days' => ['required', 'integer', 'in:'.implode(',', FollowUp::CHOICES)]],
            ['follow_up_days.in' => $message, 'follow_up_days.required' => $message, 'follow_up_days.integer' => $message],
        )['follow_up_days'];

        Setting::put(Setting::DELIVERY_FOLLOW_UP_DAYS, $days, $request->user());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => "Purchase orders not complete after {$days} days are now shown to follow up with Head Office.",
        ]);

        return back();
    }

    /**
     * How many students must enroll together for each to get a free
     * uniform set. Groups already recorded stay as they are.
     */
    public function updatePromoGroupSize(Request $request): RedirectResponse
    {
        $min = PromoRules::MIN_GROUP_SIZE;
        $max = PromoRules::MAX_GROUP_SIZE;
        $size = (int) $request->validate(
            ['group_size' => ['required', 'integer', "between:{$min},{$max}"]],
            ['group_size.between' => "Choose {$min} to {$max} students.", 'group_size.required' => "Choose {$min} to {$max} students.", 'group_size.integer' => "Choose {$min} to {$max} students."],
        )['group_size'];

        Setting::put(Setting::PROMO_GROUP_SIZE, $size, $request->user());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => "Groups of at least {$size} students who enroll together now get free uniforms. Groups already recorded stay as they are.",
        ]);

        return back();
    }

    /**
     * The most of one item every buyer can get at once (in the cart, per
     * uniform set line, and preordered per size). Buyers allowed more keep
     * their own number.
     */
    public function updateMostPerItem(Request $request): RedirectResponse
    {
        $most = (int) $request->validate(
            ['most_per_item' => ['required', 'integer', 'between:'.BuyerLimit::MIN.','.BuyerLimit::MAX]],
            self::mostMessages('most_per_item'),
        )['most_per_item'];

        Setting::put(Setting::MOST_PER_ITEM, $most, $request->user());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Buyers can now get at most '.number_format($most).' of one item. Buyers allowed more keep their own number.',
        ]);

        return back();
    }

    /**
     * How many pieces must be waiting for a Coming Soon item before it
     * shows on the dashboard as Ready to order.
     */
    public function updatePreordersBeforeOrdering(Request $request): RedirectResponse
    {
        $min = StockCards::MIN_PREORDERS_BEFORE_ORDERING;
        $max = StockCards::MAX_PREORDERS_BEFORE_ORDERING;
        $message = 'Enter a whole number from '.number_format($min).' to '.number_format($max).'.';
        $pieces = (int) $request->validate(
            ['preorders_before_ordering' => ['required', 'integer', "between:{$min},{$max}"]],
            ['preorders_before_ordering.required' => $message, 'preorders_before_ordering.integer' => $message, 'preorders_before_ordering.between' => $message],
        )['preorders_before_ordering'];

        Setting::put(Setting::PREORDERS_BEFORE_ORDERING, $pieces, $request->user());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Coming Soon items now show as Ready to order on the dashboard once '.number_format($pieces).' '.($pieces === 1 ? 'piece is' : 'pieces are').' preordered and paid.',
        ]);

        return back();
    }

    /**
     * Let one buyer get more of one item than everyone else (e.g. 500
     * shirts for an event), found by their email.
     */
    public function allowBuyerMore(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'most_per_item' => ['required', 'integer', 'between:'.BuyerLimit::MIN.','.BuyerLimit::MAX],
        ], [
            'email.required' => 'Enter the buyer\'s email.',
            'email.email' => 'Enter a valid email, e.g. delacruz.123456@sti.edu.ph.',
            ...self::mostMessages('most_per_item'),
        ]);

        $buyer = User::query()
            ->whereRaw('lower(email) = ?', [mb_strtolower(trim((string) $validated['email']))])
            ->whereIn('role', [UserRole::Student, UserRole::Employee])
            ->first();

        if ($buyer === null) {
            throw ValidationException::withMessages(['email' => 'No buyer has this email. Check it, or ask the buyer to register first.']);
        }

        $most = (int) $validated['most_per_item'];
        $buyer->forceFill(['most_per_item' => $most])->save();

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => "{$buyer->name} can now get at most ".number_format($most).' of one item.',
        ]);

        return back();
    }

    /**
     * The buyer goes back to the limit for everyone.
     */
    public function removeBuyerAllowance(User $buyer): RedirectResponse
    {
        abort_if($buyer->most_per_item === null, 404);

        $buyer->forceFill(['most_per_item' => null])->save();

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => "{$buyer->name} is back to the limit for everyone: ".number_format(BuyerLimit::everyone()).' of one item.',
        ]);

        return back();
    }

    /**
     * @return array<string, string>
     */
    private static function mostMessages(string $field): array
    {
        $message = 'Enter a whole number from '.number_format(BuyerLimit::MIN).' to '.number_format(BuyerLimit::MAX).'.';

        return ["{$field}.required" => $message, "{$field}.integer" => $message, "{$field}.between" => $message];
    }
}
