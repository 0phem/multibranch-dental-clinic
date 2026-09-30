<?php
namespace App\Services\Billing;
use Symfony\Component\HttpKernel\Exception\HttpException;
class BillingException extends HttpException { public function __construct(int $status,string $code,string $message,array $details=[]) { parent::__construct($status,$message,null,[],0); $this->code=$code; $this->details=$details; } public array $details=[]; public function responseBody():array{return ['message'=>$this->getMessage(),'code'=>$this->code]+($this->details?['details'=>$this->details]:[]);} }
