<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\AppLoginRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Signing in and out of the phone app, for students and the PROWARE
 * Specialist (the School Admin uses the website). Each phone gets its own
 * token, which lasts 30 days.
 */
class AuthController extends Controller
{
    public function login(AppLoginRequest $request): JsonResponse
    {
        $user = User::query()->where('email', $request->string('email')->lower()->value())->first();

        if ($user === null || ! Hash::check($request->string('password')->value(), $user->password)) {
            throw ValidationException::withMessages(['email' => 'These credentials do not match our records.']);
        }

        if (! $user->isStudent() && ! $user->isSpecialist()) {
            throw ValidationException::withMessages(['email' => 'The PROWARE app is for students and the PROWARE Specialist. Please use the website.']);
        }

        if (! $user->hasVerifiedEmail()) {
            throw ValidationException::withMessages(['email' => 'Verify your email on the PROWARE website first, then sign in here.']);
        }

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
