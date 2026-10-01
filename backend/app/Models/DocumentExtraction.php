<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentExtraction extends Model
{
    use HasUlids;

    public const METHODS = [
        'native_text',
        'heuristic_parser',
        'ocr_simulation',
        'manual_paste',
    ];

    public const STATUSES = [
        'Draft',
        'Reviewed',
        'Rejected',
    ];

    protected $guarded = ['id', 'public_id'];

    protected function casts(): array
    {
        return [
            'structured_payload' => 'array',
            'confidence_score' => 'decimal:2',
            'extracted_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
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

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }
}
