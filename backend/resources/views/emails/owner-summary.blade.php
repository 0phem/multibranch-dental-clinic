@php($m = fn ($v) => \App\Support\Brand::money($v))
@extends('emails.v2.layout', [
    'subject' => $subjectLine,
    'preheader' => 'Numbers per branch for '.$day->format('l, F j').'.',
    'reason' => 'You received this because you are an Owner of '.\App\Support\Brand::name().'. Switch it off in Administration → Automations.',
])

@section('content')
    @include('emails.partials-test-banner')
    @include('emails.v2.partials.heading', ['text' => 'Daily summary'])
    <p style="margin:0 0 4px;">Hi {{ $firstName }},</p>
    @include('emails.v2.partials.message', ['paragraphs' => $paragraphs])
    @foreach ($branches as $b)
        @include('emails.v2.partials.details', ['title' => $b['name'].($b['open'] ? '' : ' (closed)'), 'rows' => [
            ['Appointments booked', (string) $b['booked']],
            ['Visits completed', (string) $b['completed']],
            ['Appointments cancelled', (string) $b['cancelled']],
            ['Late cancellations', (string) $b['late_cancellations']],
            ['Late arrivals', (string) $b['late_arrivals']],
            ['Times released (not checked in)', (string) $b['released']],
            ['Freed times refilled', 'move-up '.$b['refilled']['move_up'].' · waitlist '.$b['refilled']['waitlist'].' · walk-in '.$b['refilled']['walk_in'].' · booking '.$b['refilled']['booking']],
            ['Possible no-shows flagged', (string) $b['possible_no_shows']],
            ['Follow-ups open (overdue)', $b['followups_open'].' ('.$b['followups_overdue'].')'],
            ['Payments received', $b['payments_count'].' · '.$m($b['payments_total'])],
            ['Invoices issued today', $b['issued_count'].' · '.$m($b['issued_total'])],
            ['Unpaid invoices (open now)', $b['unpaid_count'].' · '.$m($b['unpaid_total'])],
        ]])
    @endforeach
    @include('emails.v2.partials.details', ['title' => 'Whole clinic', 'rows' => [['New patient accounts', (string) $new_patient_accounts]]])
    @include('emails.v2.partials.button', ['url' => $reportsUrl, 'label' => 'Open Reports'])
    <p class="t-muted" style="margin:0 0 8px; font-size:14px; line-height:21px; color:#5b6b7f;">Numbers only: this email never contains patient names, messages or clinical details.</p>
@endsection
