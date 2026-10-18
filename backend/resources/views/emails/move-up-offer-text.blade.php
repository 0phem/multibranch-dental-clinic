@extends('emails.layout-text', ['branch' => $appointment->branch, 'reason' => 'You received this because you have an appointment later that day at '.\App\Support\Brand::name().' and an earlier time opened.'])

@section('content')
@if ($test)[TEST] Sent from Administration > Automations, only to you; the details may be examples.

@endif
An earlier time is available

Hi {!! $firstName !!},

@foreach ($paragraphs as $paragraph)
{!! $paragraph !!}

@endforeach
Earlier time: {!! $newStart->format('l, F j') !!} at {!! $newStart->format('g:i A') !!}
Your current time: {!! $oldStart->format('l, F j') !!} at {!! $oldStart->format('g:i A') !!}
Reference: {!! $appointment->appointment_code !!}

Take the earlier time (asks you to confirm): {!! $acceptUrl !!}
If another patient accepts first, your appointment stays as it is.
@endsection
