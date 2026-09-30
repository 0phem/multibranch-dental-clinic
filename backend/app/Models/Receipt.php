<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
class Receipt extends Model { use HasUlids; protected $guarded=['id','public_id']; protected function casts():array{return ['amount'=>'decimal:2','issued_at'=>'immutable_datetime'];} public function uniqueIds():array{return ['public_id'];} public function getRouteKeyName():string{return 'public_id';} public function invoice():BelongsTo{return $this->belongsTo(Invoice::class);} public function payment():BelongsTo{return $this->belongsTo(Payment::class);} }
