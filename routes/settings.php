<?php

use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\SecurityController;
use Illuminate\Support\Facades\Route;

// Account settings: the name and the password. Staff, and students while
// they register in PROWARE (until Microsoft 365 sign-in is connected;
// students get one My Account page). The email is not changed here, and
// accounts are not deleted here.
Route::middleware(['auth', 'role:specialist,school_admin,student'])->group(function () {
    Route::redirect('settings', '/settings/profile');
    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('profile.update');
});

Route::middleware(['auth', 'verified', 'role:specialist,school_admin,student'])->group(function () {
    Route::get('settings/security', [SecurityController::class, 'edit'])->name('security.edit');
    Route::put('settings/password', [SecurityController::class, 'update'])
        ->middleware('throttle:password-update')
        ->name('user-password.update');
});
