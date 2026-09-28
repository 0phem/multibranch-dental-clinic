<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Authorization branch scope row — see the create_user_branch_scopes_table migration. Read by M6; maintained later by
// M1's administrative workflow.
class UserBranchScope extends Model
{
    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $fillable = ['user_id', 'branch_id'];

    /** Branch ids the account is authorized for (empty = none). */
    public static function branchIdsFor(User $user): array
    {
        return static::where('user_id', $user->id)->pluck('branch_id')->all();
    }
}
