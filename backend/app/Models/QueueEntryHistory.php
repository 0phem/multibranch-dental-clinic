<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Append-only (a database trigger rejects UPDATE/DELETE) — see the create_queue_tables migration.
class QueueEntryHistory extends Model
{
    protected $table = 'queue_entry_history';

    public $timestamps = false;

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['occurred_at' => 'immutable_datetime', 'revision' => 'integer'];
    }

    public function entry(): BelongsTo
    {
        return $this->belongsTo(QueueEntry::class, 'queue_entry_id');
    }
}
