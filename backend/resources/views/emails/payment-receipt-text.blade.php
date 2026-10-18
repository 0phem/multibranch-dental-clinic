@extends('emails.layout-text', ['branch' => $branch, 'reason' => 'You received this because a payment was recorded for your account at '.\App\Support\Brand::name().'.'])

@section('content')
PAYMENT RECEIPT - PAID

Hi {!! $firstName !!},

Thank you for your payment. Here is your receipt for invoice {!! $invoice->invoice_number !!}.

Amount paid: {!! $amount !!}
Receipt number: {!! $receipt->receipt_number !!}
Invoice number: {!! $invoice->invoice_number !!}
@if ($branch)Clinic branch: {!! $branch->name !!}
@endif
Payment date: {!! $paidAt !!}
Payment method: {!! $method !!}
@if ($referenceShort)Reference: {!! $referenceShort !!} (full reference in the attached PDF)
@endif
Balance remaining: {!! $balance !!}

@foreach ($invoice->lines as $line)
- {!! $line->service_name !!} ({!! $line->quantity !!} x {!! \App\Support\Brand::money($line->unit_price) !!}): {!! \App\Support\Brand::money($line->line_total) !!}
@endforeach
Subtotal: {!! \App\Support\Brand::money($invoice->gross_amount) !!}
@if ((float) $invoice->hmo_coverage_amount > 0)Less coverage: -{!! \App\Support\Brand::money($invoice->hmo_coverage_amount) !!}
@endif
Total: {!! \App\Support\Brand::money($invoice->patient_responsibility_amount) !!}

{!! $settled ? 'Fully settled. This invoice has no remaining balance.' : 'Balance remaining: '.$balance.'.' !!}
@if ($bir)

Business registration
@foreach ($bir as $label => $value)
{!! $label !!}: {!! $value !!}
@endforeach
@endif

A PDF copy of this Payment Receipt is attached.

Next steps
Book your next appointment: {!! $bookUrl !!}
View your receipts: {!! $portalUrl !!}
@endsection
