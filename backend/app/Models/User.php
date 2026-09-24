<?php

namespace App\Models;

use App\Enums\Role;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOneThrough;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

// USERS is the sibling of PATIENTS: both attach to the shared PERSONS hub through their own person_id foreign
// key. There is deliberately no stored "name" column — display name is derived from the related Person (see
// name() below) to avoid a duplicate identity source (AGENTS.md).
#[Fillable(['person_id', 'email', 'password', 'role', 'account_status', 'title'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => Role::class,
        ];
    }

    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class);
    }

    public function patient(): HasOneThrough
    {
        return $this->hasOneThrough(Patient::class, Person::class, 'id', 'person_id', 'person_id', 'id');
    }

    public function name(): string
    {
        return $this->person?->fullName() ?? '';
    }
}
