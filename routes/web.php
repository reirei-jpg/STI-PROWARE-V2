<?php

use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PurchaseOrderController;
use App\Http\Controllers\PurchaseOrderScanController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/dashboard')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');

    Route::middleware('role:specialist,school_admin')->group(function () {
        Route::get('purchase-orders', [PurchaseOrderController::class, 'index'])->name('purchase-orders.index');
        Route::get('purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'show'])->whereNumber('purchaseOrder')->name('purchase-orders.show');
    });

    Route::middleware('role:specialist')->group(function () {
        Route::post('purchase-orders', [PurchaseOrderController::class, 'store'])->name('purchase-orders.store');
        Route::get('purchase-orders/scan', [PurchaseOrderScanController::class, 'create'])->name('purchase-orders.scan');
        Route::post('purchase-orders/scan', [PurchaseOrderScanController::class, 'store'])->name('purchase-orders.scan.store');
        Route::delete('purchase-orders/scan', [PurchaseOrderScanController::class, 'destroy'])->name('purchase-orders.scan.destroy');
    });

    Route::middleware('role:school_admin')->group(function () {
        Route::post('notifications/read-all', [NotificationController::class, 'readAll'])->name('notifications.read-all');
        Route::post('notifications/{notification}/open', [NotificationController::class, 'open'])->name('notifications.open');
    });
});

require __DIR__.'/settings.php';
