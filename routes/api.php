<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CartController;
use App\Http\Controllers\Api\V1\DeviceTokenController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\OrderController;
use App\Http\Controllers\Api\V1\PreorderController;
use App\Http\Controllers\Api\V1\Specialist\DeliveryController;
use App\Http\Controllers\Api\V1\Specialist\OrderController as SpecialistOrderController;
use App\Http\Controllers\Api\V1\Specialist\StockController;
use App\Http\Controllers\Api\V1\Specialist\TaskController;
use App\Http\Controllers\Api\V1\StorefrontController;
use App\Http\Middleware\UseRequestHostForPhotos;
use Illuminate\Support\Facades\Route;

/*
| The phone app's API (/api/v1), for students and the PROWARE Specialist.
| Each phone signs in with its own token; every rule is the website's own
| (shared services and actions).
*/

Route::prefix('v1')->name('api.v1.')->middleware(UseRequestHostForPhotos::class)->group(function () {
    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1')->name('auth.login');

    // Both students and the Specialist.
    Route::middleware(['auth:sanctum', 'role:student,specialist'])->group(function () {
        Route::get('auth/me', [AuthController::class, 'me'])->name('auth.me');
        Route::post('auth/logout', [AuthController::class, 'logout'])->name('auth.logout');

        Route::put('device-token', [DeviceTokenController::class, 'store'])->name('device-token.store');
        Route::delete('device-token', [DeviceTokenController::class, 'destroy'])->name('device-token.destroy');

        Route::get('notifications', [NotificationController::class, 'index'])->name('notifications.index');
        Route::post('notifications/read-all', [NotificationController::class, 'readAll'])->name('notifications.read-all');
        Route::post('notifications/{notification}/read', [NotificationController::class, 'read'])->name('notifications.read');
    });

    // The student's shop.
    Route::middleware(['auth:sanctum', 'role:student'])->group(function () {
        Route::get('storefront', [StorefrontController::class, 'home'])->name('storefront.home');
        Route::get('merchandise', [StorefrontController::class, 'merchandise'])->name('storefront.merchandise');
        Route::get('products/{product}', [StorefrontController::class, 'show'])->name('storefront.product');

        Route::get('cart', [CartController::class, 'index'])->name('cart.index');
        Route::post('products/{product}/cart', [CartController::class, 'store'])->name('cart.store');
        Route::patch('cart-selection', [CartController::class, 'select'])->name('cart.select');
        Route::patch('cart/{cartItem}', [CartController::class, 'update'])->name('cart.update');
        Route::delete('cart/{cartItem}', [CartController::class, 'destroy'])->name('cart.destroy');

        Route::get('orders', [OrderController::class, 'index'])->name('orders.index');
        Route::post('orders', [OrderController::class, 'store'])->name('orders.store');
        Route::get('orders/{order}', [OrderController::class, 'show'])->name('orders.show');
        Route::get('orders/{order}/slip', [OrderController::class, 'slip'])->name('orders.slip');
        Route::post('orders/{order}/cancel', [OrderController::class, 'cancel'])->name('orders.cancel');

        Route::get('preorders', [PreorderController::class, 'index'])->name('preorders.index');
        Route::post('products/{product}/preorder', [PreorderController::class, 'store'])->name('preorders.store');
        Route::delete('preorders/{preorder}', [PreorderController::class, 'destroy'])->name('preorders.destroy');
    });

    // The Specialist's to-do, orders, deliveries and stock.
    Route::middleware(['auth:sanctum', 'role:specialist'])->prefix('specialist')->name('specialist.')->group(function () {
        Route::get('tasks', TaskController::class)->name('tasks');

        Route::get('orders', [SpecialistOrderController::class, 'index'])->name('orders.index');
        Route::get('orders/{order}', [SpecialistOrderController::class, 'show'])->name('orders.show');
        Route::get('slips/{code}', [SpecialistOrderController::class, 'slip'])->name('slips.show');
        Route::post('orders/{order}/ready', [SpecialistOrderController::class, 'ready'])->name('orders.ready');
        Route::post('orders/{order}/release', [SpecialistOrderController::class, 'release'])->name('orders.release');
        Route::post('orders/{order}/undo-release', [SpecialistOrderController::class, 'undoRelease'])->name('orders.undo-release');
        Route::post('orders/{order}/cancel', [SpecialistOrderController::class, 'cancel'])->name('orders.cancel');

        Route::get('deliveries', [DeliveryController::class, 'index'])->name('deliveries.index');
        Route::get('deliveries/waiting', [DeliveryController::class, 'waiting'])->name('deliveries.waiting');
        Route::post('deliveries', [DeliveryController::class, 'store'])->name('deliveries.store');

        Route::get('stock', [StockController::class, 'index'])->name('stock.index');
        Route::get('stock/{product}', [StockController::class, 'show'])->name('stock.show');
    });
});
