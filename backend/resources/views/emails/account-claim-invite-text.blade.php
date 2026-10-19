@extends('emails.layout-text', ['reason' => 'You received this because '.\App\Support\Brand::name().' has a patient record for you and you can now have your own account.'])

@section('content')
Create your own patient account

Hi {!! $firstName !!},

You can now have your own sign-in for the patient portal. Your visits stay with your record. Open the link (it works once and expires), ask for your code, then enter the 6-digit code we email you together with the password you choose.

Create my account: {!! $claimUrl !!}
Once your account is active, a parent or guardian can no longer manage your record.
@endsection
