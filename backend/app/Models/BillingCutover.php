<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class BillingCutover extends Model { protected $table='m11_billing_cutovers'; protected $guarded=['id']; protected function casts():array{return ['established_at'=>'immutable_datetime'];} }
