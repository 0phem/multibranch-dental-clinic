<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// PATIENTS is the sibling of USERS: both attach to the shared PERSONS hub through their own person_id foreign
// key. There is deliberately no patients.user_id / users relationship here — see the create_patients_table
// migration comment.
class Patient extends Model
{
    use HasFactory, HasUlids;

    // public_id is the external API identity (CONTRACTS.md §1); the bigint id stays internal and patient_code stays
    // the clinic-facing reference. HasUlids fills public_id on create; the primary key is unchanged.
    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    protected $fillable = [
        'person_id',
        'patient_code',
        'consent',
    ];

    protected function casts(): array
    {
        return [
            'consent' => 'boolean',
        ];
    }

    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class);
    }
}
