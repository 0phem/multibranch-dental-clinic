<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** M25: a handover of a patient's care to another dentist or branch. The clinical text is encrypted at rest. */
class PatientHandover extends Model
{
    use HasUlids;

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id', 'public_id'];

    protected function casts(): array
    {
        return ['summary' => 'encrypted', 'pending_treatment' => 'encrypted', 'notes' => 'encrypted', 'document_ids' => 'array',
            'acknowledged_at' => 'immutable_datetime', 'cancelled_at' => 'immutable_datetime'];
    }

    public function uniqueIds(): array { return ['public_id']; }

    public function getRouteKeyName(): string { return 'public_id'; }

    public function patient(): BelongsTo { return $this->belongsTo(Patient::class); }

    public function fromBranch(): BelongsTo { return $this->belongsTo(Branch::class, 'from_branch_id'); }

    public function toBranch(): BelongsTo { return $this->belongsTo(Branch::class, 'to_branch_id'); }

    public function fromDentist(): BelongsTo { return $this->belongsTo(DentistProfile::class, 'from_dentist_profile_id'); }

    public function toDentist(): BelongsTo { return $this->belongsTo(DentistProfile::class, 'to_dentist_profile_id'); }

    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by_user_id'); }

    public function acknowledger(): BelongsTo { return $this->belongsTo(User::class, 'acknowledged_by_user_id'); }

    /**
     * True when an open handover gives this Staff account's branch the patient's full profile: it waits for acknowledgement, or was
     * acknowledged within the Owner's number of days (staffing.handover_access_days, default 60). Used by PatientPolicy only.
     */
    public static function grantsProfileAccess(User $user, Patient $patient): bool
    {
        if ($user->role->value !== 'staff') return false;
        $days = (int) (\App\Services\Automations\AutomationCatalog::setting('staffing')?->settings['handover_access_days'] ?? 60);

        return self::where('patient_id', $patient->id)->whereIn('to_branch_id', \App\Models\UserBranchScope::select('branch_id')->where('user_id', $user->id))
            ->where(fn ($q) => $q->where('status', 'Sent')->orWhere(fn ($a) => $a->where('status', 'Acknowledged')->where('acknowledged_at', '>', now()->subDays($days)->toIso8601String())))
            ->exists();
    }
}
