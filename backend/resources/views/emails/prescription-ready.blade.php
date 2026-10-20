@extends('emails.v2.layout', ['subject' => $subjectLine, 'preheader' => 'A prescription from your visit is ready in your patient portal.', 'reason' => 'You received this because your dentist issued a prescription after your visit. For your privacy, its content is only in the portal.'])

@section('content')
    @include('emails.v2.partials.heading', ['eyebrow' => 'Prescription', 'text' => 'A prescription from your visit is ready'])
    <p style="margin:0 0 12px;">Hi {{ $name }},</p>
    <p style="margin:0 0 12px;">A prescription from your visit is ready in the portal. Sign in to view it or download the PDF.</p>
    @include('emails.v2.partials.button', ['url' => $link, 'label' => 'Sign in to see it'])
    @include('emails.v2.partials.callout', ['tone' => 'info', 'text' => 'For your privacy, prescriptions are never included in email.'])
@endsection
