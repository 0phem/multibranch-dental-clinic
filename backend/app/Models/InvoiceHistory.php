<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
class InvoiceHistory extends Model { public $timestamps=false; protected $guarded=['id']; protected function casts():array{return ['snapshot'=>'array','occurred_at'=>'immutable_datetime'];} public function invoice():BelongsTo{return $this->belongsTo(Invoice::class);} public function actor():BelongsTo{return $this->belongsTo(User::class,'actor_user_id');} }
