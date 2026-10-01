@extends('emails.layout', ['subject' => 'Official Payment Receipt - Dr. Dana E. Roxas Dental Clinic'])

@section('content')
    <h2>Official Payment Receipt</h2>
    <p>Dear {{ $invoice->patient?->person?->first_name ?? 'Valued Patient' }},</p>
    <p>Thank you for your payment. Your dental invoice has been fully settled. Below is your official digital payment receipt:</p>

    <div class="card">
        <div class="detail-row">
            <span class="detail-label">Receipt Number</span>
            <span class="detail-value"><strong>{{ $receipt->receipt_number }}</strong></span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Invoice Number</span>
            <span class="detail-value">{{ $invoice->invoice_number }}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Clinic Branch</span>
            <span class="detail-value">{{ $invoice->branch?->name ?? 'Dental Clinic Branch' }}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Payment Date</span>
            <span class="detail-value">{{ \Carbon\Carbon::parse($receipt->issued_at ?? now())->format('F d, Y h:i A') }}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Payment Method</span>
            <span class="detail-value">{{ $receipt->method }}</span>
        </div>
        @if($receipt->external_reference)
        <div class="detail-row">
            <span class="detail-label">Reference ID</span>
            <span class="detail-value" style="font-family: monospace; font-size: 12px;">{{ $receipt->external_reference }}</span>
        </div>
        @endif
        <div class="detail-row">
            <span class="detail-label">Amount Paid</span>
            <span class="detail-value" style="font-size: 16px; color: #0284c7;">₱{{ number_format((float)$receipt->amount, 2) }}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Balance Remaining</span>
            <span class="detail-value" style="color: #059669;">₱0.00 (Fully Settled)</span>
        </div>
    </div>

    @if($invoice->lines && count($invoice->lines) > 0)
    <h3 style="font-size: 15px; margin-top: 24px; margin-bottom: 8px;">Itemized Dental Procedures</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
        <thead>
            <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
                <th style="padding: 8px;">Procedure</th>
                <th style="padding: 8px; text-align: center;">Qty</th>
                <th style="padding: 8px; text-align: right;">Unit Price</th>
                <th style="padding: 8px; text-align: right;">Total</th>
            </tr>
        </thead>
        <tbody>
            @foreach($invoice->lines as $line)
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px;"><strong>{{ $line->service_name }}</strong></td>
                <td style="padding: 8px; text-align: center;">{{ $line->quantity }}</td>
                <td style="padding: 8px; text-align: right;">₱{{ number_format((float)$line->unit_price, 2) }}</td>
                <td style="padding: 8px; text-align: right;">₱{{ number_format((float)$line->line_total, 2) }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
    @endif

    <p style="font-size: 13px; color: #64748b; margin-top: 16px;">
        This serves as your official electronic acknowledgment of payment. You can access and print your historical receipts anytime by logging into your patient portal.
    </p>
@endsection
