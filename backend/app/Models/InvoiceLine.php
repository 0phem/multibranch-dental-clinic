<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
class InvoiceLine extends Model { use HasUlids; protected $guarded=['id','public_id']; protected function casts():array{return ['quantity'=>'integer','unit_price'=>'decimal:2','line_total'=>'decimal:2'];} public function uniqueIds():array{return ['public_id'];} public function invoice():BelongsTo{return $this->belongsTo(Invoice::class);} public function service():BelongsTo{return $this->belongsTo(Service::class);} public function servicePrice():BelongsTo{return $this->belongsTo(ServicePrice::class);} }
