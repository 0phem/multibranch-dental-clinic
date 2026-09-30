<?php
namespace App\Http\Resources;
use Illuminate\Http\Resources\Json\JsonResource;
class ReceiptResource extends JsonResource { public function toArray($request):array { $r=$this->resource; return ['id'=>$r->public_id,'number'=>$r->receipt_number,'invoice_id'=>$r->invoice?->public_id,'amount'=>(string)$r->amount,'method'=>$r->method,'external_reference'=>$r->external_reference,'issued_at'=>$r->issued_at?->toIso8601String()]; } }
