<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CartController;
use App\Http\Controllers\Api\V1\DeviceTokenController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\OrderController;
use App\Http\Controllers\Api\V1\PreorderController;
use App\Http\Controllers\Api\V1\StorefrontController;
use App\Http\Middleware\UseRequestHostForPhotos;
use Illuminate\Support\Facades\Route;

/*
| The student phone app's API (/api/v1). Students sign in with a token per
| phone; every rule is the website's own (shared services and actions).
*/

Route::prefix('v1')->name('api.v1.')->middleware(UseRequestHostForPhotos::class)->group(function () {
    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1')->name('auth.login');

    Route::middleware(['auth:sanctum', 'role:student'])->group(function () {
        Route::get('auth/me', [AuthController::class, 'me'])->name('auth.me');
        Route::post('auth/logout', [AuthController::class, 'logout'])->name('auth.logout');

        Route::put('device-token', [DeviceTokenController::class, 'store'])->name('device-token.store');
        Route::delete('device-token', [DeviceTokenController::class, 'destroy'])->name('device-token.destroy');

        Route::get('storefront', [StorefrontController::class, 'home'])->name('storefront.home');
        Route::get('merchandise', [StorefrontController::class, 'merchandise'])->name('storefront.merchandise');
        Route::get('products/{product}', [StorefrontController::class, 'show'])->name('storefront.product');

        Route::get('cart', [CartController::class, 'index'])->name('cart.index');
        Route::post('products/{product}/cart', [CartController::class, 'store'])->name('cart.store');
        Route::patch('cart/{cartItem}', [CartController::class, 'update'])->name('cart.update');
        Route::delete('cart/{cartItem}', [CartController::class, 'destroy'])->name('cart.destroy');

        Route::get('orders', [OrderController::class, 'index'])->name('orders.index');
        Route::post('orders', [OrderController::class, 'store'])->name('orders.store');
        Route::get('orders/{order}', [OrderController::class, 'show'])->name('orders.show');
        Route::post('orders/{order}/cancel', [OrderController::class, 'cancel'])->name('orders.cancel');

        Route::get('preorders', [PreorderController::class, 'index'])->name('preorders.index');
        Route::post('products/{product}/preorder', [PreorderController::class, 'store'])->name('preorders.store');
        Route::delete('preorders/{preorder}', [PreorderController::class, 'destroy'])->name('preorders.destroy');

        Route::get('notifications', [NotificationController::class, 'index'])->name('notifications.index');
        Route::post('notifications/read-all', [NotificationController::class, 'readAll'])->name('notifications.read-all');
        Route::post('notifications/{notification}/read', [NotificationController::class, 'read'])->name('notifications.read');
    });
});
