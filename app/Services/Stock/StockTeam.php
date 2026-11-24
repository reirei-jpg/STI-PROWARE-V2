<?php

namespace App\Services\Stock;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

/**
 * Who is told about eStore orders and deliveries (uploaded, completed,
 * closed short). The Specialist and the School Admin both manage the stock
 * (panel revision, 24 Nov 2026): the School Admin is told what was done, and
 * when she did it herself, the Specialist is told instead. Nobody is told
 * about their own work.
 */
final class StockTeam
{
    /**
     * @return Collection<int, User>
     */
    public static function toTell(User $actor): Collection
    {
        $roles = $actor->isSchoolAdmin()
            ? [UserRole::SchoolAdmin, UserRole::Specialist]
            : [UserRole::SchoolAdmin];

        return User::query()
            ->whereIn('role', $roles)
            ->whereKeyNot($actor->id)
            ->get();
    }
}
