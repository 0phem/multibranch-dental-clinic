<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// DENTIST_BRANCHES — see the create_dentist_branches_table migration comment and the Phase 2A plan, section
// C/D. A full model (not an implicit pivot) so Owner assignment/unassignment has its own timestamps.
class DentistBranch extends Model
{
    use HasFactory;

    protected $fillable = [
        'dentist_profile_id',
        'branch_id',
    ];

    public function dentistProfile(): BelongsTo
    {
        return $this->belongsTo(DentistProfile::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}
