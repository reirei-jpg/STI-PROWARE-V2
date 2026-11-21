<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CartController;
use App\Http\Controllers\Api\V1\CashierController;
use App\Http\Controllers\Api\V1\DeviceTokenController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\OrderController;
use App\Http\Controllers\Api\V1\PreorderController;
use App\Http\Controllers\Api\V1\Specialist\DeliveryController;
use App\Http\Controllers\Api\V1\Specialist\LockedAccountController;
use App\Http\Controllers\Api\V1\Specialist\OrderController as SpecialistOrderController;
use App\Http\Controllers\Api\V1\Specialist\ProductAnnouncementController;
use App\Http\Controllers\Api\V1\Specialist\StockController;
use App\Http\Controllers\Api\V1\Specialist\TaskController;
use App\Http\Controllers\Api\V1\StorefrontController;
use App\Http\Controllers\Api\V1\WishlistController;
use App\Http\Middleware\UseRequestHostForPhotos;
use Illuminate\Support\Facades\Route;

/*
| The phone app's API (/api/v1), for students and the PROWARE Specialist.
| Each phone signs in with its own token; every rule is the website's own
| (shared services and actions).
*/

Route::prefix('v1')->name('api.v1.')->middleware(UseRequestHostForPhotos::class)->group(function () {
    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1')->name('auth.login');

    // Browsing the store needs no sign-in, as on the website.
    Route::get('storefront', [StorefrontController::class, 'home'])->name('storefront.home');
    Route::get('merchandise', [StorefrontController::class, 'merchandise'])->name('storefront.merchandise');
    Route::get('products/{product}', [StorefrontController::class, 'show'])->name('storefront.product');

    // Buyers (students and STI staff) and the Specialist.
    Route::middleware(['auth:sanctum', 'role:student,employee,specialist'])->group(function () {
        Route::get('auth/me', [AuthController::class, 'me'])->name('auth.me');
        Route::post('auth/logout', [AuthController::class, 'logout'])->name('auth.logout');

        Route::put('device-token', [DeviceTokenController::class, 'store'])->name('device-token.store');
        Route::delete('device-token', [DeviceTokenController::class, 'destroy'])->name('device-token.destroy');

        Route::get('notifications', [NotificationController::class, 'index'])->name('notifications.index');
        Route::post('notifications/read-all', [NotificationController::class, 'readAll'])->name('notifications.read-all');
        Route::post('notifications/{notification}/read', [NotificationController::class, 'read'])->name('notifications.read');
    });

    // The buyer's (student or STI staff) cart, orders and preorders.
    Route::middleware(['auth:sanctum', 'role:student,employee'])->group(function () {
        Route::get('cart', [CartController::class, 'index'])->name('cart.index');
        Route::post('products/{product}/cart', [CartController::class, 'store'])->name('cart.store');
        Route::post('uniform-sets/{uniformSet}/cart', [CartController::class, 'storeSet'])->name('cart.store-set');
        Route::patch('cart-selection', [CartController::class, 'select'])->name('cart.select');
        Route::patch('cart/{cartItem}', [CartController::class, 'update'])->name('cart.update');
        Route::delete('cart/{cartItem}', [CartController::class, 'destroy'])->name('cart.destroy');

        Route::get('wishlist', [WishlistController::class, 'index'])->name('wishlist.index');
        Route::post('products/{product}/wishlist', [WishlistController::class, 'store'])->name('wishlist.store');
        Route::delete('wishlist/{wishlistItem}', [WishlistController::class, 'destroy'])->name('wishlist.destroy');
        Route::post('cart/{cartItem}/wishlist', [WishlistController::class, 'moveFromCart'])->name('wishlist.move-from-cart');

        Route::get('orders', [OrderController::class, 'index'])->name('orders.index');
        Route::post('orders', [OrderController::class, 'store'])->name('orders.store');
        Route::get('orders/{order}', [OrderController::class, 'show'])->name('orders.show');
        Route::get('orders/{order}/slip', [OrderController::class, 'slip'])->name('orders.slip');
        Route::post('orders/{order}/cancel', [OrderController::class, 'cancel'])->name('orders.cancel');
        Route::get('my-receipts/{payment}', [OrderController::class, 'receipt'])->name('my-receipts.show');

        Route::get('preorders', [PreorderController::class, 'index'])->name('preorders.index');
        Route::get('preorders/slips/{preorderSlip}', [PreorderController::class, 'slip'])->name('preorders.slip');
        Route::post('products/{product}/preorder', [PreorderController::class, 'store'])->name('preorders.store');
        Route::patch('preorders/{preorder}', [PreorderController::class, 'update'])->name('preorders.update');
        Route::delete('preorders/{preorder}', [PreorderController::class, 'destroy'])->name('preorders.destroy');
    });

    // The Specialist's to-do, orders, deliveries and stock.
    // The cashier takes payments and issues Payment Receipts (panel revision, 20 Nov 2026).
    Route::middleware(['auth:sanctum', 'role:cashier'])->prefix('cashier')->name('cashier.')->group(function () {
        Route::get('dashboard', [CashierController::class, 'dashboard'])->name('dashboard');
        Route::get('slip', [CashierController::class, 'lookup'])->name('slip');
        Route::get('paid-today', [CashierController::class, 'paidToday'])->name('paid-today');
        Route::get('awaiting', [CashierController::class, 'awaiting'])->name('awaiting');
        Route::get('payments', [CashierController::class, 'history'])->name('payments');
        Route::get('collections', [CashierController::class, 'collections'])->name('collections');
        Route::get('receipts/{payment}', [CashierController::class, 'receipt'])->name('receipts.show');
        Route::post('orders/{order}/paid', [CashierController::class, 'payOrder'])->name('orders.paid');
        Route::post('preorder-slips/{preorderSlip}/paid', [CashierController::class, 'payPreorderSlip'])->name('preorder-slips.paid');
        Route::post('orders/{order}/undo-payment', [CashierController::class, 'undoOrderPayment'])->name('orders.undo-payment');
        Route::post('preorder-slips/{preorderSlip}/undo-payment', [CashierController::class, 'undoPreorderPayment'])->name('preorder-slips.undo-payment');
    });

    Route::middleware(['auth:sanctum', 'role:specialist'])->prefix('specialist')->name('specialist.')->group(function () {
        Route::get('tasks', TaskController::class)->name('tasks');

        Route::get('orders', [SpecialistOrderController::class, 'index'])->name('orders.index');
        Route::get('orders/{order}', [SpecialistOrderController::class, 'show'])->name('orders.show');
        Route::get('slips/{code}', [SpecialistOrderController::class, 'slip'])->name('slips.show');
        Route::get('preorder-slips', [SpecialistOrderController::class, 'preorderSlips'])->name('preorder-slips.index');
        Route::post('locked-accounts/{user}/unlock', [LockedAccountController::class, 'unlock'])->whereNumber('user')->name('locked-accounts.unlock');
        Route::post('preorder-slips/{preorderSlip}/release', [SpecialistOrderController::class, 'preorderRelease'])->name('preorder-slips.release');
        Route::post('orders/{order}/release', [SpecialistOrderController::class, 'release'])->name('orders.release');
        Route::post('product-announcements', [ProductAnnouncementController::class, 'store'])->name('product-announcements.store');

        Route::get('deliveries', [DeliveryController::class, 'index'])->name('deliveries.index');
        Route::get('deliveries/waiting', [DeliveryController::class, 'waiting'])->name('deliveries.waiting');
        Route::post('deliveries', [DeliveryController::class, 'store'])->name('deliveries.store');

        Route::get('stock', [StockController::class, 'index'])->name('stock.index');
        Route::get('stock/{product}', [StockController::class, 'show'])->name('stock.show');
    });
});
