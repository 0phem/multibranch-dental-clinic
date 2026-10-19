<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmailVerificationOtp extends Model
{
    public const REGISTRATION = 'email_verification';
    public const PASSWORD_RESET = 'password_reset';
    public const EMAIL_CHANGE = 'email_change';
    public const ACCOUNT_CLAIM = 'account_claim';

    protected $fillable = ['user_id', 'purpose', 'new_email', 'digest', 'attempts', 'expires_at', 'sent_at', 'consumed_at'];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'sent_at' => 'datetime',
            'consumed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
