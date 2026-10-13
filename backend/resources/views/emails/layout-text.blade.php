@php($b = \App\Support\Brand::forEmail($branch ?? null))
{{ $b['name'] }}
{{ str_repeat('=', mb_strlen($b['name'])) }}

@yield('content')

Warm regards,
The {{ $b['name'] }} team

--
{{ $b['name'] }}
@if ($b['branch_name']){{ $b['branch_name'] }}{{ $b['branch_address'] ? ' - '.$b['branch_address'] : '' }}
@elseif ($b['address']){{ $b['address'] }}
@endif
@php($phone = $b['branch_phone'] ?: $b['phone'])
@if ($phone)Phone: {{ $phone }}
@endif
@if ($b['email'])Email: {{ $b['email'] }}
@endif

@if (! empty($reason)){{ $reason }}
@endif
This is an automated message. Clinic staff will never ask you for your password or a one-time code.
