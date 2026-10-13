@extends('emails.layout', ['subject' => $subjectLine, 'preheader' => $preheader, 'reason' => $reason])

@section('content')
    @include('emails.partials.heading', ['text' => $heading])
    <p style="margin:0 0 12px;">Hi {{ $name }},</p>
    @foreach ($paragraphs as $paragraph)
        <p style="margin:0 0 12px;">{{ $paragraph }}</p>
    @endforeach
    @if ($when)
        <p style="margin:0 0 12px; font-size:14px; color:#5b6b7f;">When: {{ $when }} (Philippine time)</p>
    @endif
    @if ($action)
        @include('emails.partials.button', ['url' => $action['url'], 'label' => $action['label']])
    @endif
    @if ($warning)
        @include('emails.partials.callout', ['tone' => 'warning', 'text' => $warning])
    @endif
@endsection
