<?php

namespace App\Models;

use App\Enums\Role;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOneThrough;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\SoftDeletes;
use Laravel\Sanctum\HasApiTokens;

// USERS is the sibling of PATIENTS: both attach to the shared PERSONS hub through their own person_id foreign
// key. There is deliberately no stored "name" column — display name is derived from the related Person (see
// name() below) to avoid a duplicate identity source (AGENTS.md). The bigint id stays internal (foreign keys, session
// identifier); public_id (ULID) is the only user identifier the API accepts or returns, so routes bind on it.
#[Fillable(['person_id', 'email', 'password', 'role', 'account_status', 'title'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasUlids, Notifiable, SoftDeletes;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => Role::class,
        ];
    }

    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class);
    }

    public function patient(): HasOneThrough
    {
        return $this->hasOneThrough(Patient::class, Person::class, 'id', 'person_id', 'person_id', 'id');
    }

    /** Authorization branch scopes (M1-administered; read by M6). Never operational work assignment. */
    public function branchScopes(): HasMany
    {
        return $this->hasMany(UserBranchScope::class);
    }

    public function name(): string
    {
        return $this->person?->fullName() ?? '';
    }
}
