<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** F1: the Owner-approved wording of one automated email (App\Services\Automations\MessageTemplates). */
class MessageTemplate extends Model
{
    protected $primaryKey = 'key';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['needs_dentist' => 'boolean', 'revision' => 'integer', 'approved_at' => 'immutable_datetime', 'dentist_approved_at' => 'immutable_datetime'];
    }

    /** Approved by the Owner and, when it touches health, by a Dentist too. */
    public function isApproved(): bool
    {
        return $this->approved_at !== null && (! $this->needs_dentist || $this->dentist_approved_at !== null);
    }

    public function approver() { return $this->belongsTo(User::class, 'approved_by_user_id'); }

    public function dentistApprover() { return $this->belongsTo(User::class, 'dentist_approved_by_user_id'); }
}
