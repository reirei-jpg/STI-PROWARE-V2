<?php

use App\Http\Controllers\CartController;
use App\Http\Controllers\CashierController;
use App\Http\Controllers\CashierRecordsController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DeliveryController;
use App\Http\Controllers\FreeUniformController;
use App\Http\Controllers\ItemLinkController;
use App\Http\Controllers\LockedAccountController;
use App\Http\Controllers\MaintenanceController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\PreorderController;
use App\Http\Controllers\PreorderRestockController;
use App\Http\Controllers\PreorderSlipController;
use App\Http\Controllers\ProductAnnouncementController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProductSaleController;
use App\Http\Controllers\ProductStockController;
use App\Http\Controllers\PurchaseOrderController;
use App\Http\Controllers\PurchaseOrderDeliveryController;
use App\Http\Controllers\PurchaseOrderReminderController;
use App\Http\Controllers\PurchaseOrderScanController;
use App\Http\Controllers\SalesReportController;
use App\Http\Controllers\StorefrontController;
use App\Http\Controllers\StudentOrderController;
use App\Http\Controllers\StudentPreorderController;
use App\Http\Controllers\UniformSetController;
use App\Http\Controllers\WishlistController;
use Illuminate\Support\Facades\Route;

Route::get('/', [StorefrontController::class, 'home'])->name('home');
Route::get('merchandise/{product}', [StorefrontController::class, 'show'])->name('storefront.product');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');

    Route::post('notifications/read-all', [NotificationController::class, 'readAll'])->name('notifications.read-all');
    Route::post('notifications/{notification}/open', [NotificationController::class, 'open'])->name('notifications.open');

    Route::middleware('role:student,employee')->group(function () {
        Route::get('my-preorders', [StudentPreorderController::class, 'index'])->name('my-preorders.index');
        Route::get('my-preorders/slips/{preorderSlip}', [StudentPreorderController::class, 'slip'])->name('my-preorders.slip');
        Route::post('merchandise/{product}/preorder', [StudentPreorderController::class, 'store'])->name('my-preorders.store');
        Route::patch('my-preorders/{preorder}', [StudentPreorderController::class, 'update'])->name('my-preorders.update');
        Route::delete('my-preorders/{preorder}', [StudentPreorderController::class, 'destroy'])->name('my-preorders.destroy');

        Route::get('cart', [CartController::class, 'index'])->name('cart.index');
        Route::post('merchandise/{product}/cart', [CartController::class, 'store'])->name('cart.store');
        Route::post('uniform-sets/{uniformSet}/cart', [CartController::class, 'storeSet'])->name('cart.store-set');
        Route::patch('cart-selection', [CartController::class, 'select'])->name('cart.select');
        Route::patch('cart/{cartItem}', [CartController::class, 'update'])->name('cart.update');
        Route::delete('cart/{cartItem}', [CartController::class, 'destroy'])->name('cart.destroy');
        Route::get('wishlist', [WishlistController::class, 'index'])->name('wishlist.index');
        Route::post('merchandise/{product}/wishlist', [WishlistController::class, 'store'])->name('wishlist.store');
        Route::delete('wishlist/{wishlistItem}', [WishlistController::class, 'destroy'])->name('wishlist.destroy');
        Route::post('cart/{cartItem}/wishlist', [WishlistController::class, 'moveFromCart'])->name('wishlist.move-from-cart');

        Route::get('my-orders', [StudentOrderController::class, 'index'])->name('my-orders.index');
        Route::post('my-orders', [StudentOrderController::class, 'store'])->name('my-orders.store');
        Route::post('my-orders/{order}/cancel', [StudentOrderController::class, 'cancel'])->name('my-orders.cancel');
        Route::get('my-orders/{order}/slip', [StudentOrderController::class, 'slip'])->name('my-orders.slip');
        Route::get('my-orders/{order}/slip/print', [StudentOrderController::class, 'printSlip'])->name('my-orders.slip.print');
        // The buyer's own Payment Receipts (for orders and preorder slips).
        Route::get('my-receipts/{payment}', [StudentOrderController::class, 'receipt'])->name('my-receipts.show');
        Route::get('my-receipts/{payment}/print', [StudentOrderController::class, 'printReceipt'])->name('my-receipts.print');
    });

    Route::middleware('role:specialist,school_admin')->group(function () {
        Route::get('purchase-orders', [PurchaseOrderController::class, 'index'])->name('purchase-orders.index');
        Route::get('purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'show'])->whereNumber('purchaseOrder')->name('purchase-orders.show');
        Route::get('deliveries', [DeliveryController::class, 'index'])->name('deliveries.index');
        // The Specialist unlocks buyers, the School Admin the Specialist (SignInLock::canUnlock).
        Route::post('locked-accounts/{user}/unlock', [LockedAccountController::class, 'unlock'])->whereNumber('user')->name('locked-accounts.unlock');
    });

    // The cashier takes payments and issues Payment Receipts (panel revision, 20 Nov 2026).
    Route::middleware('role:cashier')->prefix('cashier')->name('cashier.')->group(function () {
        Route::get('/', [CashierController::class, 'index'])->name('index');
        Route::get('record', [CashierController::class, 'record'])->name('record');
        Route::post('orders/{order}/paid', [CashierController::class, 'payOrder'])->name('orders.paid');
        Route::post('preorder-slips/{preorderSlip}/paid', [CashierController::class, 'payPreorderSlip'])->name('preorder-slips.paid');
        // A payment recorded by mistake: undone the same day, before release; its receipt becomes VOID.
        Route::post('orders/{order}/undo-payment', [CashierController::class, 'undoOrderPayment'])->name('orders.undo-payment');
        Route::post('preorder-slips/{preorderSlip}/undo-payment', [CashierController::class, 'undoPreorderPayment'])->name('preorder-slips.undo-payment');
        Route::get('receipts/{payment}/print', [CashierController::class, 'printReceipt'])->name('receipts.print');
        Route::get('awaiting', [CashierRecordsController::class, 'awaiting'])->name('awaiting.index');
        Route::get('payments/export', [CashierRecordsController::class, 'historyCsv'])->name('payments.export');
        Route::get('collections/export', [CashierRecordsController::class, 'collectionsCsv'])->name('collections.export');
        Route::get('collections/daily-report', [CashierRecordsController::class, 'daily'])->name('collections.daily');
    });

    // The cashier's records: the School Admin can view them too (read-only), the Specialist cannot.
    Route::middleware('role:cashier,school_admin')->prefix('cashier')->name('cashier.')->group(function () {
        Route::get('payments', [CashierRecordsController::class, 'history'])->name('payments.index');
        Route::get('collections', [CashierRecordsController::class, 'collections'])->name('collections.index');
        Route::get('receipts/{payment}', [CashierController::class, 'receipt'])->name('receipts.show');
    });

    Route::middleware('role:school_admin')->group(function () {
        Route::post('purchase-orders/{purchaseOrder}/remind-specialist', [PurchaseOrderReminderController::class, 'store'])->name('purchase-orders.remind-specialist');
    });

    Route::middleware('role:specialist')->group(function () {
        Route::post('purchase-orders', [PurchaseOrderController::class, 'store'])->name('purchase-orders.store');
        Route::get('purchase-orders/scan', [PurchaseOrderScanController::class, 'create'])->name('purchase-orders.scan');
        Route::post('purchase-orders/scan', [PurchaseOrderScanController::class, 'store'])->name('purchase-orders.scan.store');
        Route::delete('purchase-orders/scan', [PurchaseOrderScanController::class, 'destroy'])->name('purchase-orders.scan.destroy');
        Route::get('purchase-orders/{purchaseOrder}/waiting-items', [PurchaseOrderDeliveryController::class, 'waiting'])->whereNumber('purchaseOrder')->name('purchase-orders.waiting-items');
        Route::post('purchase-orders/{purchaseOrder}/close', [PurchaseOrderDeliveryController::class, 'close'])->name('purchase-orders.close');

        Route::get('orders', [OrderController::class, 'index'])->name('orders.index');
        Route::get('orders/slip', [OrderController::class, 'slip'])->name('orders.slip');
        Route::get('orders/{order}/slip/print', [OrderController::class, 'printSlip'])->name('orders.slip.print');
        Route::post('orders/{order}/release', [OrderController::class, 'release'])->name('orders.release');

        Route::get('sales-reports', [SalesReportController::class, 'index'])->name('sales-reports.index');
        Route::get('sales-reports/export', [SalesReportController::class, 'export'])->name('sales-reports.export');
        Route::get('maintenance', [MaintenanceController::class, 'index'])->name('maintenance.index');
        Route::patch('maintenance/follow-up-days', [MaintenanceController::class, 'updateFollowUpDays'])->name('maintenance.follow-up-days');
        Route::patch('maintenance/promo-group-size', [MaintenanceController::class, 'updatePromoGroupSize'])->name('maintenance.promo-group-size');
        Route::patch('maintenance/most-per-item', [MaintenanceController::class, 'updateMostPerItem'])->name('maintenance.most-per-item');
        Route::post('maintenance/buyers-allowed-more', [MaintenanceController::class, 'allowBuyerMore'])->name('maintenance.buyers-allowed-more.store');
        Route::delete('maintenance/buyers-allowed-more/{buyer}', [MaintenanceController::class, 'removeBuyerAllowance'])->name('maintenance.buyers-allowed-more.destroy');

        Route::get('free-uniforms', [FreeUniformController::class, 'index'])->name('free-uniforms.index');
        Route::post('free-uniforms', [FreeUniformController::class, 'store'])->name('free-uniforms.store');
        Route::get('free-uniforms/export', [FreeUniformController::class, 'export'])->name('free-uniforms.export');
        Route::post('free-uniforms/students/{student}/give', [FreeUniformController::class, 'giveRest'])->name('free-uniforms.give');
        Route::post('uniform-sets', [UniformSetController::class, 'store'])->name('uniform-sets.store');
        Route::put('uniform-sets/{uniformSet}', [UniformSetController::class, 'update'])->name('uniform-sets.update');

        Route::get('preorders', [PreorderController::class, 'index'])->name('preorders.index');
        Route::get('preorders/export', [PreorderController::class, 'export'])->name('preorders.export');
        Route::get('preorders/{product}', [PreorderController::class, 'show'])->name('preorders.show');
        Route::patch('preorders/{product}/close-date', [PreorderController::class, 'updateCloseDate'])->name('preorders.close-date');
        Route::patch('preorders/{product}/payment-dates', [PreorderController::class, 'updatePaymentDates'])->name('preorders.payment-dates');
        Route::get('preorder-slips', [PreorderSlipController::class, 'index'])->name('preorder-slips.index');
        Route::post('preorder-slips/{preorderSlip}/release', [PreorderSlipController::class, 'release'])->name('preorder-slips.release');
        Route::post('product-announcements', [ProductAnnouncementController::class, 'store'])->name('product-announcements.store');
        Route::post('preorders/variants/{variant}/not-restocked', [PreorderRestockController::class, 'store'])->name('preorders.not-restocked');
        Route::delete('preorders/variants/{variant}/not-restocked', [PreorderRestockController::class, 'destroy'])->name('preorders.allow-restock');

        Route::get('deliveries/create', [DeliveryController::class, 'create'])->name('deliveries.create');
        Route::post('deliveries', [DeliveryController::class, 'store'])->name('deliveries.store');

        Route::get('products/items-to-link', [ItemLinkController::class, 'index'])->name('item-links.index');
        Route::get('products/items-to-link/products', [ItemLinkController::class, 'products'])->name('item-links.products');
        Route::post('products/items-to-link', [ItemLinkController::class, 'store'])->name('item-links.store');
        Route::get('products/{product}/sale', [ProductSaleController::class, 'show'])->name('products.sale.show');
        Route::post('products/{product}/sale', [ProductSaleController::class, 'store'])->name('products.sale.store');
        Route::delete('products/{product}/sale', [ProductSaleController::class, 'destroy'])->name('products.sale.destroy');
        Route::get('products/{product}/stock', [ProductStockController::class, 'index'])->name('products.stock');
        Route::post('products/{product}/stock-corrections', [ProductStockController::class, 'store'])->name('products.stock.correct');
        Route::resource('products', ProductController::class)->only(['index', 'create', 'store', 'edit', 'update']);
    });
});

require __DIR__.'/settings.php';
