<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One scheduled automation's on/off switch and Owner-editable settings (see the create_automation_settings_and_deliveries migration). */
class AutomationSetting extends Model
{
    protected $primaryKey = 'key';

    protected $keyType = 'string';

    public $incrementing = false;

    // timestamptz columns: always write an explicit offset so the database session time zone never matters.
    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['enabled' => 'boolean', 'settings' => 'array', 'revision' => 'integer', 'last_run_at' => 'immutable_datetime'];
    }
}
