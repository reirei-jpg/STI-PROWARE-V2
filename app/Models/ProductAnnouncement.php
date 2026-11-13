<?php

namespace App\Models;

use Database\Factories\ProductAnnouncementFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A product the Specialist told the top buyers about from the dashboard:
 * how many of the top buyers were chosen, how many got it, and the note.
 *
 * @property int $id
 * @property int $product_id
 * @property int|null $sent_by
 * @property int $top
 * @property int $recipients
 * @property string|null $note
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Product $product
 * @property-read User|null $sender
 */
#[Fillable(['product_id', 'sent_by', 'top', 'recipients', 'note'])]
class ProductAnnouncement extends Model
{
    /** @use HasFactory<ProductAnnouncementFactory> */
    use HasFactory;

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }
}
