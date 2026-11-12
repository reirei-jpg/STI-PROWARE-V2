<?php

namespace App\Models;

use App\Enums\UserRole;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Fortify\Contracts\PasskeyUser;
use Laravel\Fortify\PasskeyAuthenticatable;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Laravel\Sanctum\HasApiTokens;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property string|null $student_id a student's 11-digit Student ID, from registration (null for staff and older accounts)
 * @property string|null $employee_id an STI staff buyer's Employee ID, from registration
 * @property UserRole $role
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property string|null $two_factor_secret
 * @property string|null $two_factor_recovery_codes
 * @property Carbon|null $two_factor_confirmed_at
 * @property string|null $remember_token
 * @property string|null $section a student's course/section, e.g. "BSIT 1-A" (asked at checkout), or an STI staff buyer's office/department, e.g. "Faculty - IT"
 * @property Carbon|null $ordering_resumed_at when the Specialist lifted an ordering pause
 * @property int|null $most_per_item the most of one item this buyer can get, when the Specialist allowed them more (null: the Maintenance setting)
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'email', 'role', 'password'])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'])]
class User extends Authenticatable implements MustVerifyEmail, PasskeyUser
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, PasskeyAuthenticatable, TwoFactorAuthenticatable;

    /**
     * A person's name: starts with a letter, then only letters (ñ and
     * accents too), spaces, periods, hyphens and apostrophes, e.g.
     * "Ma. Cristina O'Neil-Dela Cruz".
     */
    public const string NAME_PATTERN = "/^\pL[\pL\s.'-]*$/u";

    /**
     * A course/section or office/department: starts with a letter or number,
     * then only letters, numbers, spaces and ordinary punctuation, e.g.
     * "BSIT 1-A" or "Registrar's Office".
     */
    public const string SECTION_PATTERN = "/^[\pL\pN][\pL\pN\s.,&'()\/-]*$/u";

    public const string SECTION_MESSAGE = "The course/section may only contain letters, numbers, spaces and . , - / ' & ( ), e.g. BSIT 1-A.";

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'role' => UserRole::class,
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'ordering_resumed_at' => 'datetime',
            'most_per_item' => 'integer',
        ];
    }

    public function isSpecialist(): bool
    {
        return $this->role === UserRole::Specialist;
    }

    public function isSchoolAdmin(): bool
    {
        return $this->role === UserRole::SchoolAdmin;
    }

    public function isStudent(): bool
    {
        return $this->role === UserRole::Student;
    }

    /**
     * An STI teacher or employee who buys from the store ("STI Staff").
     */
    public function isEmployee(): bool
    {
        return $this->role === UserRole::Employee;
    }

    /**
     * A student or an STI staff buyer: who can use the cart, order and
     * preorder.
     */
    public function isBuyer(): bool
    {
        return $this->role->isBuyer();
    }

    /**
     * The buyer's ID number for the slip and the Specialist: the Student ID,
     * or an STI staff buyer's Employee ID.
     */
    public function idNumber(): ?string
    {
        return $this->isEmployee() ? $this->employee_id : $this->student_id;
    }

    /**
     * The student's preorders.
     *
     * @return HasMany<Preorder, $this>
     */
    public function preorders(): HasMany
    {
        return $this->hasMany(Preorder::class);
    }

    /**
     * What the student is about to order.
     *
     * @return HasMany<CartItem, $this>
     */
    public function cartItems(): HasMany
    {
        return $this->hasMany(CartItem::class);
    }

    /**
     * The student's orders.
     *
     * @return HasMany<Order, $this>
     */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }
}
