<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Authorization branch scope row — see the create_user_branch_scopes_table migration. Read by M6; maintained later by
// M1's administrative workflow.
class UserBranchScope extends Model
{
    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $fillable = ['user_id', 'branch_id'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}
