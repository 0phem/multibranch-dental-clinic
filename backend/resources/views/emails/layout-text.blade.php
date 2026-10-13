@php($clinic = config('mail.from.name') ?: config('app.name'))
{{ $clinic }}
{{ str_repeat('=', mb_strlen($clinic)) }}

@yield('content')

{{ $clinic }}

--
@if (! empty($reason)){{ $reason }}
@endif
This is an automated message from {{ $clinic }}. Clinic staff will never ask you for your password or a one-time code.
@if (config('clinic.support_email'))Questions? Contact {{ config('clinic.support_email') }}.
@endif
