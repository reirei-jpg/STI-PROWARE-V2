<?php

namespace App\Services\EstorePo;

use RuntimeException;

/**
 * Thrown when an uploaded file cannot be scanned as an eStore purchase order.
 *
 * The message is written for the Specialist, so it can be shown on screen as is.
 */
class UnreadablePurchaseOrderException extends RuntimeException {}
