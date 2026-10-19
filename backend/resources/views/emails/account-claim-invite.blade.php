@extends('emails.v2.layout', [
    'subject' => $subjectLine,
    'preheader' => 'Your visits and records are already at the clinic. Create your own sign-in.',
    'reason' => 'You received this because '.\App\Support\Brand::name().' has a patient record for you and you can now have your own account.',
])

@section('content')
    @include('emails.v2.partials.heading', ['text' => 'Create your own patient account'])
    <p style="margin:0 0 4px;">Hi {{ $firstName }},</p>
    <p style="margin:0 0 18px;">You can now have your own sign-in for the patient portal. Your visits stay with your record. Open the link (it works once and expires), ask for your code, then enter the 6-digit code we email you together with the password you choose.</p>
    @include('emails.v2.partials.button', ['url' => $claimUrl, 'label' => 'Create my account'])
    <p class="t-muted" style="margin:0 0 8px; font-size:14px; line-height:21px; color:#5b6b7f;">Once your account is active, a parent or guardian can no longer manage your record. Didn’t expect this email? You can ignore it.</p>
@endsection
