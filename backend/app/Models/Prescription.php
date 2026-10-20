<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** M19: a prescription written by a Dentist for a visit. Draft → Issued (locked) → Void. The note is encrypted at rest. */
class Prescription extends Model
{
    use HasUlids;

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id', 'public_id'];

    protected function casts(): array
    {
        return ['note' => 'encrypted', 'issued_at' => 'immutable_datetime', 'voided_at' => 'immutable_datetime', 'revision' => 'integer'];
    }

    public function uniqueIds(): array { return ['public_id']; }

    public function getRouteKeyName(): string { return 'public_id'; }

    public function lines(): HasMany { return $this->hasMany(PrescriptionLine::class)->orderBy('line_no'); }

    public function patient(): BelongsTo { return $this->belongsTo(Patient::class); }

    public function branch(): BelongsTo { return $this->belongsTo(Branch::class); }

    public function visit(): BelongsTo { return $this->belongsTo(Visit::class); }

    public function treatment(): BelongsTo { return $this->belongsTo(Treatment::class); }

    public function dentist(): BelongsTo { return $this->belongsTo(DentistProfile::class, 'dentist_profile_id'); }
}
