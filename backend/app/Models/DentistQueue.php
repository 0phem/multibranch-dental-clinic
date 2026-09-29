<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

// DENTIST_QUEUES — per-branch / per-Dentist / per-clinic-day queue container and atomic number counter (see the
// create_queue_tables migration). Rows are created and advanced only by QueueService's upsert.
class DentistQueue extends Model
{
    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['clinic_date' => 'date:Y-m-d', 'next_number' => 'integer'];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function dentist(): BelongsTo
    {
        return $this->belongsTo(DentistProfile::class, 'dentist_profile_id');
    }

    public function entries(): HasMany
    {
        return $this->hasMany(QueueEntry::class);
    }
}
