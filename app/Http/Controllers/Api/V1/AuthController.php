<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\AppLoginRequest;
use App\Models\User;
use App\Notifications\PhoneSignedIn;
use App\Providers\FortifyServiceProvider;
use App\Services\Auth\SignInLock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Signing in and out of the phone app, for students, STI staff, the
 * PROWARE Specialist, the cashier and the School Admin. Each phone gets its
 * own token, which lasts 30 days.
 */
class AuthController extends Controller
{
    public function login(AppLoginRequest $request): JsonResponse
    {
        $user = User::query()->where('email', $request->string('email')->trim()->lower()->value())->first();

        if ($user === null) {
            throw ValidationException::withMessages(['email' => FortifyServiceProvider::FAILED_LOGIN]);
        }

        // The same lock as the website (SignInLock).
        $refusal = SignInLock::refusal($user);

        if ($refusal !== null) {
            throw ValidationException::withMessages(['email' => $refusal]);
        }

        if (! Hash::check($request->string('password')->value(), $user->password)) {
            throw ValidationException::withMessages(['email' => SignInLock::wrongPassword($user) ?? FortifyServiceProvider::FAILED_LOGIN]);
        }

        SignInLock::clear($user);

        if (! $user->isBuyer() && ! $user->isSpecialist() && ! $user->isCashier() && ! $user->isSchoolAdmin()) {
            throw ValidationException::withMessages(['email' => 'The PROWARE app is for students, STI staff, the PROWARE Specialist, the cashier and the School Admin. Use the website.']);
        }

        if (! $user->hasVerifiedEmail()) {
            throw ValidationException::withMessages(['email' => 'Verify your email on the PROWARE website first, then sign in here.']);
        }

        // The owner's other phones (and the bell) are told, in case it was not them.
        $user->notify(new PhoneSignedIn($request->string('device_name')->value(), now()));

        return response()->json([
            'token' => $user->createToken($request->string('device_name')->value())->plainTextToken,
            'user' => self::user($user),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => self::user($request->user())]);
    }

    /**
     * Sign this phone out; other phones stay signed in.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'You are signed out.']);
    }

    /**
     * Who signed in; the role decides whether the app shows the student's
     * shop or the Specialist's screens.
     *
     * @return array{id: int, name: string, email: string, role: string}
     */
    private static function user(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role->value,
        ];
    }
}
