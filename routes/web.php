<?php

use App\Http\Controllers\DeliveryController;
use App\Http\Controllers\ItemLinkController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\PurchaseOrderController;
use App\Http\Controllers\PurchaseOrderDeliveryController;
use App\Http\Controllers\PurchaseOrderScanController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'storefront/home')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');

    Route::middleware('role:specialist,school_admin')->group(function () {
        Route::get('purchase-orders', [PurchaseOrderController::class, 'index'])->name('purchase-orders.index');
        Route::get('purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'show'])->whereNumber('purchaseOrder')->name('purchase-orders.show');

        Route::post('notifications/read-all', [NotificationController::class, 'readAll'])->name('notifications.read-all');
        Route::post('notifications/{notification}/open', [NotificationController::class, 'open'])->name('notifications.open');
    });

    Route::middleware('role:specialist')->group(function () {
        Route::post('purchase-orders', [PurchaseOrderController::class, 'store'])->name('purchase-orders.store');
        Route::get('purchase-orders/scan', [PurchaseOrderScanController::class, 'create'])->name('purchase-orders.scan');
        Route::post('purchase-orders/scan', [PurchaseOrderScanController::class, 'store'])->name('purchase-orders.scan.store');
        Route::delete('purchase-orders/scan', [PurchaseOrderScanController::class, 'destroy'])->name('purchase-orders.scan.destroy');
        Route::patch('purchase-orders/{purchaseOrder}/expected-delivery', [PurchaseOrderDeliveryController::class, 'setExpectedDate'])->name('purchase-orders.expected-delivery');
        Route::post('purchase-orders/{purchaseOrder}/close', [PurchaseOrderDeliveryController::class, 'close'])->name('purchase-orders.close');

        Route::get('deliveries', [DeliveryController::class, 'index'])->name('deliveries.index');
        Route::get('deliveries/create', [DeliveryController::class, 'create'])->name('deliveries.create');
        Route::post('deliveries', [DeliveryController::class, 'store'])->name('deliveries.store');

        Route::get('products/items-to-link', [ItemLinkController::class, 'index'])->name('item-links.index');
        Route::get('products/items-to-link/products', [ItemLinkController::class, 'products'])->name('item-links.products');
        Route::post('products/items-to-link', [ItemLinkController::class, 'store'])->name('item-links.store');
        Route::resource('products', ProductController::class)->only(['index', 'create', 'store', 'edit', 'update']);
    });
});

require __DIR__.'/settings.php';
