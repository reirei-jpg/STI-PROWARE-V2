<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DeviceToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The phone's Firebase token, so the student's notices are also pushed to
 * it. It belongs to the phone's sign-in: signing out deletes it.
 */
class DeviceTokenController extends Controller
{
    /**
     * Register (or refresh) this phone. A token already registered by
     * another account on the same phone moves to this one.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string', 'max:512'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        // Students only sign in to the app with a token (no website cookies).
        $accessToken = $request->user()->currentAccessToken();

        DeviceToken::query()
            ->where('personal_access_token_id', $accessToken->getKey())
            ->where('token', '!=', $validated['token'])
            ->delete();

        DeviceToken::query()->updateOrCreate(
            ['token' => $validated['token']],
            [
                'user_id' => $request->user()->id,
                'personal_access_token_id' => $accessToken->getKey(),
                'device_name' => $validated['device_name'] ?? null,
            ],
        );

        return response()->json(['message' => 'This phone will now receive notifications.']);
    }

    /**
     * Stop pushing to this phone (the app calls it just before signing out).
     */
    public function destroy(Request $request): JsonResponse
    {
        DeviceToken::query()
            ->where('personal_access_token_id', $request->user()->currentAccessToken()->getKey())
            ->delete();

        return response()->json(['message' => 'This phone will no longer receive notifications.']);
    }
}
