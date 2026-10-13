@extends('emails.layout', ['subject' => $subjectLine, 'preheader' => $preheader, 'reason' => $reason])

@section('content')
    @include('emails.partials.heading', ['eyebrow' => 'Account security', 'text' => $heading])
    <p style="margin:0 0 12px;">Hi {{ $name }},</p>
    @foreach ($paragraphs as $paragraph)
        <p style="margin:0 0 12px;">{{ $paragraph }}</p>
    @endforeach
    @if ($when)
        @include('emails.partials.details', ['rows' => [['When', $when.' (Philippine time)']]])
    @endif
    @if ($action)
        @include('emails.partials.button', ['url' => $action['url'], 'label' => $action['label']])
    @endif
    @if ($warning)
        @include('emails.partials.callout', ['tone' => 'warning', 'text' => $warning])
    @endif
@endsection
