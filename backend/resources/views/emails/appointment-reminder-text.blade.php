@extends('emails.layout-text', ['branch' => $appointment->branch, 'reason' => 'You received this because you have an appointment at '.\App\Support\Brand::name().'. The clinic sends a reminder before each visit.'])

@section('content')
@if ($test)[TEST] Sent from Administration > Automations, only to you; the details may be examples.

@endif
Your visit is {!! $when !!}

Hi {!! $firstName !!},

@foreach ($paragraphs as $paragraph)
{!! $paragraph !!}

@endforeach
Reference: {!! $appointment->appointment_code !!}
@if ($appointment->branch)Clinic branch: {!! $appointment->branch->name !!}
@endif
@if ($appointment->branch?->address)Address: {!! $appointment->branch->address !!}
@endif
@if ($phone)Phone: {!! $phone !!}
@endif
Date: {!! $start->format('F j, Y (l)') !!}
Time: {!! $start->format('g:i A') !!}
@if ($hours)Branch hours that day: {!! $hours !!}
@endif

I'll be there: {!! $attendUrl !!}
I can't make it (asks you to confirm, then frees the time): {!! $cantUrl !!}
Reschedule instead: {!! $manageUrl !!}
Each link works once. A calendar file is attached.
@endsection
