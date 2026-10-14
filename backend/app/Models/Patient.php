<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOneThrough;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

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

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    // Route binding is the ULID public_id only (CONTRACTS.md §1). The internal bigint id and the clinic-facing
    // patient_code are never accepted as a route identity, so a sequential or guessable value cannot enumerate Patients.
    // Any other value resolves to nothing (404).
    public function resolveRouteBinding($value, $field = null)
    {
        return is_string($value) && Str::isUlid($value)
            ? $this->where('public_id', strtolower($value))->first()
            : null;
    }

    /**
     * The next clinic-facing patient_code. Derived from the highest existing PAT-#### suffix rather than a row count, so a
     * removed record can never make a new code collide with an existing one. Callers must hold the patients table lock.
     */
    public static function nextCode(): string
    {
        $highest = (int) DB::table('patients')->whereRaw("patient_code ~ '^PAT-[0-9]+$'")
            ->selectRaw('max(substring(patient_code from 5)::bigint) as highest')->value('highest');

        return 'PAT-'.str_pad((string) ($highest + 1), 4, '0', STR_PAD_LEFT);
    }

    protected $fillable = [
        'person_id',
        'patient_code',
        'consent',
        'emergency_contact',
        'preferred_branch_id',
    ];

    protected function casts(): array
    {
        return [
            'consent' => 'boolean',
            'billing_address' => 'array',
        ];
    }

    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class);
    }

    public function preferredBranch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'preferred_branch_id');
    }

    public function user(): HasOneThrough
    {
        return $this->hasOneThrough(User::class, Person::class, 'id', 'person_id', 'person_id', 'id');
    }
}
