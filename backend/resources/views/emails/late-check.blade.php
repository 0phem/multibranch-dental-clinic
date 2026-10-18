@extends('emails.v2.layout', [
    'subject' => $subjectLine, 'branch' => $appointment->branch,
    'preheader' => 'Your visit was at '.$start->format('g:i A').'. Tap "On my way" so the front desk knows.',
    'reason' => 'You received this because you have an appointment today at '.\App\Support\Brand::name().' and have not checked in yet.',
])

@section('content')
    @include('emails.partials-test-banner')
    <p style="margin:0 0 14px;">@include('emails.v2.partials.badge', ['tone' => 'due', 'text' => 'Today, '.$start->format('g:i A')])</p>
    @include('emails.v2.partials.heading', ['text' => 'Are you on your way?'])
    <p style="margin:0 0 4px;">Hi {{ $firstName }},</p>
    @include('emails.v2.partials.message', ['paragraphs' => $paragraphs])
    @include('emails.v2.partials.choice-buttons', ['primaryUrl' => $onMyWayUrl, 'primaryLabel' => 'On my way', 'secondaryUrl' => $rescheduleUrl, 'secondaryLabel' => 'Reschedule',
        'note' => 'If you haven’t checked in by '.$releaseAt.', the time may be given to another patient.'])
    @if ($phone)<p class="t-muted" style="margin:0 0 8px; font-size:14px; line-height:21px; color:#5b6b7f;">You can also call the branch: {{ $phone }}.</p>@endif
@endsection
