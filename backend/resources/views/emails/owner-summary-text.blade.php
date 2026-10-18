@php($m = fn ($v) => \App\Support\Brand::money($v))
@extends('emails.layout-text', ['reason' => 'You received this because you are an Owner of '.\App\Support\Brand::name().'. Switch it off in Administration > Automations.'])

@section('content')
@if ($test)[TEST] Sent from Administration > Automations, only to you.

@endif
Daily summary for {!! $day->format('l, F j, Y') !!}

Hi {!! $firstName !!},

@foreach ($paragraphs as $paragraph)
{!! $paragraph !!}

@endforeach
@foreach ($branches as $b)
{!! $b['name'] !!}{!! $b['open'] ? '' : ' (closed)' !!}
  Appointments booked: {!! $b['booked'] !!}
  Visits completed: {!! $b['completed'] !!}
  Appointments cancelled: {!! $b['cancelled'] !!}
  Late cancellations: {!! $b['late_cancellations'] !!}
  Late arrivals: {!! $b['late_arrivals'] !!}
  Times released (not checked in): {!! $b['released'] !!}
  Freed times refilled: move-up {!! $b['refilled']['move_up'] !!}, waitlist {!! $b['refilled']['waitlist'] !!}, walk-in {!! $b['refilled']['walk_in'] !!}, booking {!! $b['refilled']['booking'] !!}
  Possible no-shows flagged: {!! $b['possible_no_shows'] !!}
  Payments received: {!! $b['payments_count'] !!} ({!! $m($b['payments_total']) !!})
  Invoices issued today: {!! $b['issued_count'] !!} ({!! $m($b['issued_total']) !!})
  Unpaid invoices (open now): {!! $b['unpaid_count'] !!} ({!! $m($b['unpaid_total']) !!})

@endforeach
Whole clinic
  New patient accounts: {!! $new_patient_accounts !!}

Open Reports: {!! $reportsUrl !!}
Numbers only: this email never contains patient names, messages or clinical details.
@endsection
