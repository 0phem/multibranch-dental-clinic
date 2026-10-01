<?php

namespace App\Services\Document;

use Symfony\Component\HttpKernel\Exception\HttpException;

class DocumentException extends HttpException
{
    public array $details = [];

    public function __construct(int $status, string $code, string $message, array $details = [])
    {
        parent::__construct($status, $message, null, [], 0);
        $this->code = $code;
        $this->details = $details;
    }

    public function responseBody(): array
    {
        return ['message' => $this->getMessage(), 'code' => $this->code] + ($this->details ? ['details' => $this->details] : []);
    }
}
