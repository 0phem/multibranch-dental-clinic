<?php

namespace App\Models;

use App\Enums\Role;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

// M17 conversation (see the create_messaging_tables migration). Access = EXPLICIT PARTICIPANT AND a role-specific link, exactly the
// prototype's rule: the Patient's own account for the conversation's Patient; Staff with authorization for the conversation's branch;
// a Dentist assigned to that branch. Owner (and every other role) has none. Roles alone never grant a conversation.
class Conversation extends Model
{
    use HasUlids;

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id', 'public_id'];

    protected function casts(): array
    {
        return ['closed_at' => 'immutable_datetime', 'revision' => 'integer'];
    }

    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function participants(): HasMany
    {
        return $this->hasMany(ConversationParticipant::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(ConversationMessage::class)->orderBy('id');
    }

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        $participant = fn (Builder $q) => $q->whereHas('participants', fn ($p) => $p->where('user_id', $user->id));

        return match ($user->role) {
            Role::Patient => $participant($query->where('patient_id', $user->patient?->id ?? 0)),
            Role::Staff => $participant($query->whereIn('branch_id', UserBranchScope::select('branch_id')->where('user_id', $user->id))),
            Role::Dentist => $participant($query->whereIn('branch_id', DentistProfile::where('person_id', $user->person_id)->join('dentist_branches', 'dentist_branches.dentist_profile_id', '=', 'dentist_profiles.id')->select('dentist_branches.branch_id'))),
            default => $query->whereRaw('false'),
        };
    }

    public function accessibleTo(User $user): bool
    {
        return static::visibleTo($user)->whereKey($this->id)->exists();
    }
}
