@extends('emails.v2.layout', [
    'subject' => $subjectLine, 'branch' => $branch,
    'preheader' => 'A time opened on '.$day->format('l, F j').'. First come, first served.',
    'reason' => 'You received this because you asked '.\App\Support\Brand::name().' to tell you when a time opens on that day.',
])

@section('content')
    @include('emails.partials-test-banner')
    <p style="margin:0 0 14px;">@include('emails.v2.partials.badge', ['tone' => 'paid', 'text' => 'Time available'])</p>
    @include('emails.v2.partials.heading', ['text' => 'A time opened on '.$day->format('l, F j')])
    <p style="margin:0 0 4px;">Hi {{ $firstName }},</p>
    <p style="margin:0 0 18px;">You asked us to tell you when a time opens on this day. Times go to whoever books first and we can’t hold one for you, so book soon if you still want it.</p>
    @include('emails.v2.partials.details', ['title' => 'What you asked for', 'rows' => [
        ['Date', $day->format('F j, Y (l)')],
        ['Clinic branch', $branch?->name],
        ['Service', $entry->service?->name],
        ['Dentist', $dentist ?? 'Any available'],
    ]])
    @include('emails.v2.partials.button', ['url' => $bookUrl, 'label' => 'Book now'])
@endsection
