@extends('emails.layout-text', ['branch' => $branch, 'reason' => 'You received this because you visited '.\App\Support\Brand::name().' and the clinic sends a check-up reminder after a while.'])

@section('content')
@if ($test)[TEST] Sent from Administration > Automations, only to you; the details may be examples.

@endif
Time for your check-up

Hi {!! $firstName !!},

It has been a while since your last visit{!! $branch ? ' at '.$branch->name : '' !!}. Book your next visit at a time that suits you.

Book a visit: {!! $bookUrl !!}
@endsection
