<?php

namespace App\Enums;

/**
 * What happened when one push notification was sent to one phone.
 */
enum PushResult
{
    /** Firebase accepted it for delivery. */
    case Sent;

    /** The phone's token is dead (app uninstalled or token expired): forget it. */
    case InvalidToken;

    /** Anything else (network, credentials, Firebase trouble): dropped, the notice is still in the app. */
    case Failed;
}
