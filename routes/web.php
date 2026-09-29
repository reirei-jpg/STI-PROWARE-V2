<?php

use App\Http\Controllers\PurchaseOrderController;
use App\Http\Controllers\PurchaseOrderScanController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');

    Route::middleware('role:specialist')->group(function () {
        Route::get('purchase-orders', [PurchaseOrderController::class, 'index'])->name('purchase-orders.index');
        Route::post('purchase-orders', [PurchaseOrderController::class, 'store'])->name('purchase-orders.store');
        Route::get('purchase-orders/scan', [PurchaseOrderScanController::class, 'create'])->name('purchase-orders.scan');
        Route::post('purchase-orders/scan', [PurchaseOrderScanController::class, 'store'])->name('purchase-orders.scan.store');
        Route::delete('purchase-orders/scan', [PurchaseOrderScanController::class, 'destroy'])->name('purchase-orders.scan.destroy');
        Route::get('purchase-orders/{purchaseOrder}/document', [PurchaseOrderController::class, 'document'])->name('purchase-orders.document');
    });
});

require __DIR__.'/settings.php';
