<?php

namespace App\Http\Controllers\Api\V1\Specialist;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Auth\SignInLock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Unlocking a buyer's account from the Specialist's phone (the locked
 * notice), with the website's rule (SignInLock).
 */
class LockedAccountController extends Controller
{
    public function unlock(Request $request, User $user): JsonResponse
    {
        abort_unless(SignInLock::canUnlock($request->user(), $user), 403, 'Only the PROWARE Specialist unlocks students and STI staff.');

        $result = SignInLock::unlock($request->user(), $user);

        return response()->json($result);
    }
}
