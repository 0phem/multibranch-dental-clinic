@extends('emails.layout-text', ['branch' => $appointment->branch, 'reason' => 'You received this because an appointment booked for your account at '.\App\Support\Brand::name().' was missed.'])

@section('content')
@if ($test)[TEST] Sent from Administration > Automations, only to you; the details may be examples.

@endif
We missed you

Hi {!! $firstName !!},

@foreach ($paragraphs as $paragraph)
{!! $paragraph !!}

@endforeach
Book a new time: {!! $bookUrl !!}
If this is a mistake, please call the branch and we'll sort it out.
@endsection
