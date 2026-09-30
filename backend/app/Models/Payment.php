<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
class Payment extends Model { use HasUlids; protected $guarded=['id','public_id']; protected function casts():array{return ['amount'=>'decimal:2','recorded_at'=>'immutable_datetime'];} public function uniqueIds():array{return ['public_id'];} public function getRouteKeyName():string{return 'public_id';} public function invoice():BelongsTo{return $this->belongsTo(Invoice::class);} public function receipt():HasOne{return $this->hasOne(Receipt::class);} }
