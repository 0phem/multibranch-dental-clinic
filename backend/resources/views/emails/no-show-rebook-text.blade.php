@extends('emails.layout-text', ['branch' => $appointment->branch, 'reason' => 'You received this because an appointment booked for your account at '.\App\Support\Brand::name().' was missed.'])

@section('content')
@if ($test)[TEST] Sent from Administration > Automations, only to you; the details may be examples.

@endif
We missed you

Hi {!! $firstName !!},

We didn't see you at your visit on {!! $start->format('F j') !!}{!! $appointment->branch ? ' at '.$appointment->branch->name : '' !!}. When you're ready, choose a new time that suits you.

Book a new time: {!! $bookUrl !!}
If this is a mistake, please call the branch and we'll sort it out.
@endsection
