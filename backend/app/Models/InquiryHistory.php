<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Append-only (trigger). Actions and status changes only — never inquiry text.
class InquiryHistory extends Model
{
    protected $table = 'inquiry_history';

    public $timestamps = false;

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['occurred_at' => 'immutable_datetime', 'revision' => 'integer'];
    }
}
