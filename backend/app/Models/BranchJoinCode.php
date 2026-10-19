<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** The front-desk code for joining today's queue at one branch (App\Services\Intake\JoinCodes). */
class BranchJoinCode extends Model
{
    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }
}
