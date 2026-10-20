@extends('emails.layout-text', ['reason' => 'You received this because your dentist issued a prescription after your visit. For your privacy, its content is only in the portal.'])

@section('content')
A prescription from your visit is ready

Hi {!! $name !!},

A prescription from your visit is ready in the portal. Sign in to view it or download the PDF.

Sign in to see it: {!! $link !!}

For your privacy, prescriptions are never included in email.
@endsection
