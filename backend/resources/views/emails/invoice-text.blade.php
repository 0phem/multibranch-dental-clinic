@extends('emails.layout-text', ['branch' => $branch, 'reason' => 'You received this because the clinic issued an invoice for your visit at '.\App\Support\Brand::name().'.'])

@section('content')
INVOICE - {{ $paid ? 'PAID' : 'PAYMENT DUE' }}

Hi {{ $firstName }},

Here is the invoice for your visit{{ $branch ? ' at '.$branch->name : '' }}.

Amount due: {{ $amountDue }}
Invoice number: {{ $invoice->invoice_number }}
@if ($branch)Clinic branch: {{ $branch->name }}
@endif
@if ($issuedOn)Issued on: {{ $issuedOn }}
@endif

@foreach ($invoice->lines as $line)
- {{ $line->service_name }} ({{ $line->quantity }} x {{ \App\Support\Brand::money($line->unit_price) }}): {{ \App\Support\Brand::money($line->line_total) }}
@endforeach
Subtotal: {{ \App\Support\Brand::money($invoice->gross_amount) }}
@if ((float) $invoice->hmo_coverage_amount > 0)HMO coverage: -{{ \App\Support\Brand::money($invoice->hmo_coverage_amount) }}
@endif
Total: {{ \App\Support\Brand::money($invoice->patient_responsibility_amount) }}
@if ($bir)

Business registration
@foreach ($bir as $label => $value)
{{ $label }}: {{ $value }}
@endforeach
@endif

@unless ($paid)
Review and pay: {{ $portalUrl }}
You can pay online from your patient portal, or at the clinic front desk.

@endunless
A PDF copy of this invoice is attached to this email.
@endsection
