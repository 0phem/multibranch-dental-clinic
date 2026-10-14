<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One white-label setting (see App\Support\ClinicSettings). */
class ClinicSetting extends Model
{
    protected $primaryKey = 'key';

    protected $keyType = 'string';

    public $incrementing = false;

    public const CREATED_AT = null;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['value' => 'array', 'updated_at' => 'datetime'];
    }
}
