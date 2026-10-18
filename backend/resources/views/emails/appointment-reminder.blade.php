@extends('emails.v2.layout', [
    'subject' => $subjectLine, 'branch' => $appointment->branch,
    'preheader' => 'Your visit is '.$when.' at '.$start->format('g:i A').($appointment->branch ? ', '.$appointment->branch->name : '').'.',
    'reason' => 'You received this because you have an appointment at '.\App\Support\Brand::name().'. The clinic sends a reminder before each visit.',
])

@section('content')
    @include('emails.partials-test-banner')
    <p style="margin:0 0 14px;">@include('emails.v2.partials.badge', ['tone' => 'info', 'text' => 'Reminder'])</p>
    @include('emails.v2.partials.heading', ['text' => 'Your visit is '.$when])
    <p style="margin:0 0 4px;">Hi {{ $firstName }},</p>
    @include('emails.v2.partials.message', ['paragraphs' => $paragraphs])
    {{-- Clinic-local date and time of the booked slot (Asia/Manila), never the time the email was rendered. --}}
    @include('emails.v2.partials.amount', ['label' => 'Your visit', 'amount' => $start->format('M j, g:i A'), 'note' => $start->format('l, F j, Y')])
    @include('emails.v2.partials.details', ['title' => 'Where and when', 'rows' => [
        ['Reference', $appointment->appointment_code],
        ['Clinic branch', $appointment->branch?->name],
        ['Address', $appointment->branch?->address],
        ['Phone', $phone],
        ['Date', $start->format('F j, Y (l)')],
        ['Time', $start->format('g:i A')],
        ['Branch hours that day', $hours],
    ]])
    @include('emails.v2.partials.choice-buttons', ['primaryUrl' => $attendUrl, 'primaryLabel' => 'I’ll be there', 'secondaryUrl' => $cantUrl, 'secondaryLabel' => 'I can’t make it',
        'note' => '“I can’t make it” asks you to confirm, then cancels the visit so another patient can use the time. Each button works once.'])
    <p class="t-muted" style="margin:0 0 8px; font-size:14px; line-height:21px; color:#5b6b7f;">Want another time instead? <a class="t-link" href="{{ $manageUrl }}" target="_blank">Reschedule in your patient portal</a>, or call the branch. A calendar file is attached so you can add the visit to your calendar.</p>
@endsection
