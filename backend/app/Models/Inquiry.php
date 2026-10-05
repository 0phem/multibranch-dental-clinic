<?php

namespace App\Models;

use App\Enums\Role;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

// M16 inquiry (see the create_inquiry_tables migration). Changes only through InquiryService's named commands. The visibility
// boundary — Staff see only inquiries ASSIGNED TO THEM in a branch they are authorized for — is the narrowest existing safe
// technical boundary carried over from the prototype; it is not a clinic-approved routing or ownership policy.
class Inquiry extends Model
{
    use HasUlids;

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id', 'public_id'];

    protected function casts(): array
    {
        return ['received_at' => 'immutable_datetime', 'responded_at' => 'immutable_datetime', 'closed_at' => 'immutable_datetime', 'converted_at' => 'immutable_datetime', 'revision' => 'integer'];
    }

    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }

    public function history(): HasMany
    {
        return $this->hasMany(InquiryHistory::class)->orderBy('id');
    }

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $user->role === Role::Staff
            ? $query->where('assigned_user_id', $user->id)->whereIn('branch_id', UserBranchScope::select('branch_id')->where('user_id', $user->id))
            : $query->whereRaw('false');
    }

    public function visibleToUser(User $user): bool
    {
        return $user->role === Role::Staff && $this->assigned_user_id === $user->id
            && UserBranchScope::where('user_id', $user->id)->where('branch_id', $this->branch_id)->exists();
    }
}
