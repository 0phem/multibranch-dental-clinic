<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Crypt;

// Immutable (database trigger): a sent message is never edited or deleted. The sender is the authenticated account, never client input.
// Encrypted at rest (Phase 2 decision 5): `body` reads and writes the text, but only `body_encrypted` (Laravel encrypter, APP_KEY with
// APP_PREVIOUS_KEYS for rotation) is stored. A row written before encryption keeps its plain `body` until messages:encrypt-bodies runs.
class ConversationMessage extends Model
{
    use HasUlids;

    public $timestamps = false;

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id', 'public_id'];

    protected $hidden = ['body_encrypted'];

    protected function casts(): array
    {
        return ['created_at' => 'immutable_datetime'];
    }

    protected function body(): Attribute
    {
        return Attribute::make(
            get: function (?string $value, array $attributes): ?string {
                if (! isset($attributes['body_encrypted'])) {
                    return $value;
                }
                try {
                    return Crypt::decryptString($attributes['body_encrypted']);
                } catch (\Illuminate\Contracts\Encryption\DecryptException) {
                    \Illuminate\Support\Facades\Log::warning('Undecryptable conversation message encountered', [
                        'message_id' => $attributes['public_id'] ?? $attributes['id'] ?? null,
                    ]);

                    return "This message can't be displayed";
                }
            },
            set: fn (string $value) => ['body' => null, 'body_encrypted' => Crypt::encryptString($value)],
        );
    }

    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_user_id');
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }
}
