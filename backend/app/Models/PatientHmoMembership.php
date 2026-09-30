<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// PATIENT_HMO_MEMBERSHIPS — server-authoritative Patient HMO membership (M12). At most one active row per Patient; a
// change ends the active row and adds a new one (history kept; see the create_hmo_tables migration). Provider name and
// member number are Staff-entered text — there is no provider directory.
class PatientHmoMembership extends Model
{
    use HasUlids;

    public const UPDATED_AT = null;

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id', 'public_id'];

    protected function casts(): array
    {
        return ['created_at' => 'immutable_datetime', 'ended_at' => 'immutable_datetime'];
    }

    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function endedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'ended_by_user_id');
    }

    /** Masked member number for Patient-facing reads (last four characters only). */
    public function maskedMemberNumber(): string
    {
        $value = (string) $this->member_number;

        return strlen($value) <= 4 ? $value : str_repeat('•', 4).substr($value, -4);
    }
}
