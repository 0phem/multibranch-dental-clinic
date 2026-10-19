@extends('emails.v2.layout', ['subject' => $subjectLine, 'preheader' => 'A leave request needs your attention in the clinic system.', 'reason' => 'You received this because you request or approve leave at '.\App\Support\Brand::name().'. The private note is never included in email.'])

@section('content')
    @if ($test) @include('emails.partials-test-banner') @endif
    @include('emails.v2.partials.heading', ['eyebrow' => 'Leave', 'text' => $subjectLine])
    <p style="margin:0 0 12px;">Hi {{ $name }},</p>
    @foreach ($paragraphs as $paragraph)
        <p style="margin:0 0 12px;">{{ $paragraph }}</p>
    @endforeach
    @include('emails.v2.partials.button', ['url' => $link, 'label' => 'Sign in to the clinic system'])
@endsection
