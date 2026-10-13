@extends('emails.layout-text', ['reason' => $reason])

@section('content')
{{ $heading }}

Hi {{ $name }},

@foreach ($paragraphs as $paragraph)
{{ $paragraph }}

@endforeach
@if ($when)
When: {{ $when }} (Philippine time)

@endif
@if ($action)
{{ $action['label'] }}: {{ $action['url'] }}

@endif
@if ($warning)
{{ $warning }}
@endif
@endsection
