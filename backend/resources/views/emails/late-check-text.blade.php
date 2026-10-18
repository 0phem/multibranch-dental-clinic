@extends('emails.layout-text', ['branch' => $appointment->branch, 'reason' => 'You received this because you have an appointment today at '.\App\Support\Brand::name().' and have not checked in yet.'])

@section('content')
@if ($test)[TEST] Sent from Administration > Automations, only to you; the details may be examples.

@endif
Are you on your way?

Hi {!! $firstName !!},

@foreach ($paragraphs as $paragraph)
{!! $paragraph !!}

@endforeach
On my way: {!! $onMyWayUrl !!}
Reschedule: {!! $rescheduleUrl !!}
If you haven't checked in by {!! $releaseAt !!}, the time may be given to another patient.
@if ($phone)Branch phone: {!! $phone !!}
@endif
@endsection
