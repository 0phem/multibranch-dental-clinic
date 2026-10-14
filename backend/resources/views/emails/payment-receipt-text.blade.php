@extends('emails.layout-text', ['branch' => $branch, 'reason' => 'You received this because a payment was recorded for your account at '.\App\Support\Brand::name().'.'])

@section('content')
PAYMENT RECEIPT - PAID

Hi {!! $firstName !!},

Thank you. We received your payment for invoice {!! $invoice->invoice_number !!}.

Amount paid: {!! $amount !!}
Receipt number: {!! $receipt->receipt_number !!}
Invoice number: {!! $invoice->invoice_number !!}
@if ($branch)Clinic branch: {!! $branch->name !!}
@endif
Payment date: {!! $paidAt !!}
Payment method: {!! $method !!}
@if ($reference)Reference ID: {!! $reference !!}
@endif
Balance remaining: {!! $balance !!}

@foreach ($invoice->lines as $line)
- {!! $line->service_name !!} ({!! $line->quantity !!} x {!! \App\Support\Brand::money($line->unit_price) !!}): {!! \App\Support\Brand::money($line->line_total) !!}
@endforeach
Subtotal: {!! \App\Support\Brand::money($invoice->gross_amount) !!}
@if ((float) $invoice->hmo_coverage_amount > 0)HMO coverage: -{!! \App\Support\Brand::money($invoice->hmo_coverage_amount) !!}
@endif
Total: {!! \App\Support\Brand::money($invoice->patient_responsibility_amount) !!}

{!! $settled ? 'Fully settled. This invoice has no remaining balance.' : 'Balance remaining: '.$balance.'.' !!}
@if ($bir)

Business registration
@foreach ($bir as $label => $value)
{!! $label !!}: {!! $value !!}
@endforeach
@endif

View in your patient portal: {!! $portalUrl !!}

A PDF copy of this Payment Receipt is attached to this email.
@endsection
