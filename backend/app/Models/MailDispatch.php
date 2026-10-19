<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** M18 email send intent (see the create_mail_dispatch_tables migration). */
class MailDispatch extends Model
{
    use HasUlids;

    public const TERMINAL = ['logged_only', 'transport_accepted', 'failed', 'superseded', 'suppressed'];

    // timestamptz columns: always write the offset, so an instant never shifts with the PHP/session time zone.
    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id', 'public_id'];

    protected function casts(): array
    {
        return ['retryable' => 'boolean', 'next_attempt_at' => 'immutable_datetime', 'locked_at' => 'immutable_datetime',
            'completed_at' => 'immutable_datetime', 'delivery_confirmed_at' => 'immutable_datetime'];
    }

    public function uniqueIds(): array { return ['public_id']; }

    public function attemptRecords(): HasMany { return $this->hasMany(MailDispatchAttempt::class)->orderBy('attempt_no'); }

    public function recipient(): BelongsTo { return $this->belongsTo(User::class, 'recipient_user_id'); }

    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by_user_id'); }
}
