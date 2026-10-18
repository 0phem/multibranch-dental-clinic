@extends('emails.layout-text', ['branch' => $appointment->branch, 'reason' => 'You received this because you have an appointment at '.\App\Support\Brand::name().' on a day the branch will be closed.'])

@section('content')
@if ($test)[TEST] Sent from Administration > Automations, only to you; the details may be examples.

@endif
Please choose a new time

Hi {!! $firstName !!},

@foreach ($paragraphs as $paragraph)
{!! $paragraph !!}

@endforeach
Reference: {!! $appointment->appointment_code !!}
Date: {!! $start->format('F j, Y (l)') !!}
Time: {!! $start->format('g:i A') !!}
@if ($reason)Reason: {!! $reason !!}
@endif
@if ($phone)Phone: {!! $phone !!}
@endif

Choose a new time: {!! $rescheduleUrl !!}
@endsection
