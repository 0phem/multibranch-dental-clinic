@extends('emails.layout-text', ['branch' => $branch, 'reason' => 'You received this because an invoice issued to you by '.\App\Support\Brand::name().' still has a balance.'])

@section('content')
@if ($test)[TEST] Sent from Administration > Automations, only to you; the details may be examples.

@endif
A reminder about your invoice

Hi {!! $firstName !!},

Invoice {!! $invoice->invoice_number !!}{!! $branch ? ' from '.$branch->name : '' !!} still has a balance.

Invoice number: {!! $invoice->invoice_number !!}
@if ($issuedOn)Issued on: {!! $issuedOn !!}
@endif
Balance: {!! $balance !!}

Pay online: {!! $payUrl !!}
You can also pay at the clinic front desk. Already paid? Thank you, you can ignore this email.
@endsection
