<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use RuntimeException;

/** Append-only record of what a scheduled automation did or skipped (one row per unique dedupe key). */
class AutomationDelivery extends Model
{
    public const UPDATED_AT = null;

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['created_at' => 'immutable_datetime'];
    }

    public function dispatch(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(MailDispatch::class, 'mail_dispatch_id');
    }

    public function update(array $attributes = [], array $options = []): bool
    {
        throw new RuntimeException('Automation deliveries are append-only.');
    }

    public function delete(): ?bool
    {
        throw new RuntimeException('Automation deliveries are append-only.');
    }
}
