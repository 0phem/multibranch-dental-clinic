<?php

namespace App\Services\Scheduling;

use Carbon\CarbonImmutable;

final class ScheduleResult
{
    /** @param list<array{key:string,label:string,ok:bool}> $checks */
    public function __construct(
        public readonly bool $valid,
        public readonly array $checks,
        public readonly ?int $duration,
        public readonly ?CarbonImmutable $startsAt,
        public readonly ?CarbonImmutable $endsAt,
    ) {}

    /** @return list<array{key:string,label:string}> */
    public function failures(): array
    {
        return array_values(array_map(
            fn (array $c) => ['key' => $c['key'], 'label' => $c['label']],
            array_filter($this->checks, fn (array $c) => ! $c['ok'])
        ));
    }
}
