@extends('emails.layout-text', ['branch' => $branch, 'reason' => 'You received this because you asked '.\App\Support\Brand::name().' to tell you when a time opens on that day.'])

@section('content')
@if ($test)[TEST] Sent from Administration > Automations, only to you; the details may be examples.

@endif
A time opened on {!! $day->format('l, F j') !!}

Hi {!! $firstName !!},

You asked us to tell you when a time opens on this day. Times go to whoever books first and we can't hold one for you, so book soon if you still want it.

Date: {!! $day->format('F j, Y (l)') !!}
@if ($branch)Clinic branch: {!! $branch->name !!}
@endif
@if ($entry->service)Service: {!! $entry->service->name !!}
@endif
Dentist: {!! $dentist ?? 'Any available' !!}

Book now: {!! $bookUrl !!}
@endsection
