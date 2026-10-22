<?php
namespace App\Http\Resources;
use Illuminate\Http\Resources\Json\JsonResource;
class ReceiptResource extends JsonResource { public function toArray($request):array { $r=$this->resource; return ['id'=>$r->public_id,'number'=>$r->receipt_number,'invoice_id'=>$r->invoice?->public_id,'discount_type'=>$r->invoice?->discount_type,'discount_id_number'=>$r->invoice?->discount_id_number,'discount_amount'=>(string)($r->invoice?->discount_amount??'0.00'),'amount'=>(string)$r->amount,'method'=>$r->method,'external_reference'=>$r->external_reference,'issued_at'=>$r->issued_at?->toIso8601String()]; } }
