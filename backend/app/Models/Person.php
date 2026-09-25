<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

// PERSONS is the canonical shared identity hub. USERS and PATIENTS are independent siblings, each holding its
// own person_id foreign key back to this table — see ERD_ALIGNMENT.md and the migration comments in
// database/migrations/0000_01_01_000000_create_persons_table.php. A Person may exist with no User at all.
class Person extends Model
{
    use HasFactory;

    // Eloquent's default pluralization would guess "people"; the migration deliberately named the table
    // "persons" to match ERD_ALIGNMENT.md's PERSONS terminology throughout the rest of this project.
    protected $table = 'persons';

    protected $fillable = [
        'first_name',
        'last_name',
        'email',
        'phone',
        'date_of_birth',
        'sex',
        'address',
    ];

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
        ];
    }

    public function user(): HasOne
    {
        return $this->hasOne(User::class);
    }

    public function patient(): HasOne
    {
        return $this->hasOne(Patient::class);
    }

    // Phase 2A additions (see StaffProfile/DentistProfile migration comments) — a Person may have neither
    // or one, but never both; enforced at the application layer, not a DB constraint spanning two tables.
    public function staffProfile(): HasOne
    {
        return $this->hasOne(StaffProfile::class);
    }

    public function dentistProfile(): HasOne
    {
        return $this->hasOne(DentistProfile::class);
    }

    public function fullName(): string
    {
        return trim(collect([$this->first_name, $this->last_name])->filter()->implode(' '));
    }
}
